/**
 * WhatsApp Bridge using Baileys
 * Handles WhatsApp connection and message routing
 */
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState, 
  downloadMediaMessage,
  jidDecode,
  proto,
  getContentType,
  isJidUser,
  isJidGroup
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

class WhatsAppBridge {
  constructor(onMessage, onReady, onDisconnected) {
    this.socket = null;
    this.ready = false;
    this.onMessage = onMessage;
    this.onReady = onReady;
    this.onDisconnected = onDisconnected;
    this.lastError = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.authDir = './data/whatsapp_session';
  }

  /**
   * Initialize WhatsApp client using Baileys
   */
  async initialize() {
    try {
      logger.info('Initializing WhatsApp with Baileys...');

      // Ensure auth directory exists
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      this.socket = makeWASocket({
        auth: state,
        printQRInTerminal: false, // We'll handle QR display ourselves
        logger: (await import('pino')).default({ level: 'warn' }), // Reduce Baileys logging
        browser: ['AnomChatBot', 'Chrome', '1.0.0'],
        defaultQueryTimeoutMs: 60000,
      });

      this.setupEventHandlers(saveCreds);
      
      return true;
    } catch (error) {
      this.lastError = error.message;
      logger.error('Failed to initialize WhatsApp:', error);
      return false;
    }
  }

  /**
   * Setup event handlers for Baileys
   */
  setupEventHandlers(saveCreds) {
    // Connection updates (includes QR, connection status, etc.)
    this.socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Handle QR code
      if (qr) {
        logger.info('WhatsApp QR Code received. Scan with your phone:');
        qrcode.generate(qr, { small: true });
        
        // Save QR to file
        try {
          const qrDir = './data/qr_codes';
          if (!fs.existsSync(qrDir)) {
            fs.mkdirSync(qrDir, { recursive: true });
          }
          // Could add QR image generation here if needed
        } catch (error) {
          logger.error('Failed to save QR code:', error);
        }
      }

      // Handle connection status
      if (connection === 'close') {
        this.ready = false;
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        logger.warn('WhatsApp connection closed. Should reconnect:', shouldReconnect);
        
        if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          setTimeout(() => this.initialize(), 5000);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.lastError = 'Max reconnection attempts reached';
          logger.error('Max reconnection attempts reached');
          if (this.onDisconnected) this.onDisconnected('max_reconnects');
        }
      } else if (connection === 'open') {
        this.ready = true;
        this.reconnectAttempts = 0;
        logger.info('WhatsApp connected successfully!');
        if (this.onReady) this.onReady();
      }
    });

    // Credentials update (save authentication)
    this.socket.ev.on('creds.update', saveCreds);

    // Messages
    this.socket.ev.on('messages.upsert', async (m) => {
      const messages = m.messages;
      
      for (const message of messages) {
        // Only process incoming messages (not from ourselves)
        if (!message.key.fromMe && message.message) {
          try {
            await this.handleIncomingMessage(message);
          } catch (error) {
            logger.error('Error handling incoming WhatsApp message:', error);
          }
        }
      }
    });

    // Presence updates (typing, online, etc.)
    this.socket.ev.on('presence.update', (presence) => {
      logger.debug('Presence update:', presence);
    });
  }

  /**
   * Handle incoming WhatsApp message
   */
  async handleIncomingMessage(message) {
    try {
      const messageType = getContentType(message.message);
      let messageContent = '';
      let hasMedia = false;
      let mediaType = '';

      // Extract message content based on type
      switch (messageType) {
        case 'conversation':
          messageContent = message.message.conversation;
          break;
        case 'extendedTextMessage':
          messageContent = message.message.extendedTextMessage.text;
          break;
        case 'imageMessage':
          hasMedia = true;
          mediaType = 'image';
          messageContent = message.message.imageMessage.caption || '[Image]';
          break;
        case 'videoMessage':
          hasMedia = true;
          mediaType = 'video';
          messageContent = message.message.videoMessage.caption || '[Video]';
          break;
        case 'audioMessage':
          hasMedia = true;
          mediaType = 'audio';
          messageContent = '[Audio]';
          break;
        case 'documentMessage':
          hasMedia = true;
          mediaType = 'document';
          messageContent = message.message.documentMessage.title || '[Document]';
          break;
        default:
          messageContent = `[${messageType}]`;
      }

      // Get sender info
      const fromJid = message.key.remoteJid;
      const isGroupMessage = isJidGroup(fromJid);
      
      let senderName = fromJid;
      if (isGroupMessage) {
        // For group messages, get the participant
        const participant = message.key.participant || message.participant;
        senderName = participant ? jidDecode(participant)?.user || participant : 'Unknown';
      } else {
        senderName = jidDecode(fromJid)?.user || fromJid;
      }

      // Create message object compatible with the existing system
      const processedMessage = {
        id: message.key.id,
        from: fromJid,
        author: senderName,
        body: messageContent,
        hasMedia: hasMedia,
        type: messageType,
        timestamp: new Date(message.messageTimestamp * 1000),
        isGroupMsg: isGroupMessage,
        chat: {
          id: fromJid,
          name: isGroupMessage ? 'Group' : senderName
        }
      };

      // Call the message handler
      if (this.onMessage) {
        await this.onMessage(processedMessage);
      }
    } catch (error) {
      logger.error('Error processing WhatsApp message:', error);
    }
  }

  /**
   * Send message to WhatsApp chat
   */
  async sendMessage(chatId, message, options = {}) {
    try {
      if (!this.ready || !this.socket) {
        throw new Error('WhatsApp not ready');
      }

      const result = await this.socket.sendMessage(chatId, { text: message });
      logger.debug(`Message sent to ${chatId}`);
      
      return {
        success: true,
        messageId: result?.key?.id
      };
    } catch (error) {
      this.lastError = error.message;
      logger.error('Failed to send WhatsApp message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get chat information
   */
  async getChatInfo(chatId) {
    try {
      if (!this.ready || !this.socket) {
        throw new Error('WhatsApp not ready');
      }

      const chatMetadata = await this.socket.groupMetadata(chatId).catch(() => null);
      
      return {
        id: chatId,
        name: chatMetadata?.subject || jidDecode(chatId)?.user || chatId,
        isGroup: isJidGroup(chatId),
        participants: chatMetadata?.participants || []
      };
    } catch (error) {
      logger.error('Failed to get chat info:', error);
      return null;
    }
  }

  /**
   * Download media from message
   */
  async downloadMedia(message) {
    try {
      if (!this.ready || !this.socket) {
        throw new Error('WhatsApp not ready');
      }

      const buffer = await downloadMediaMessage(
        message,
        'buffer',
        {},
        {
          logger: (await import('pino')).default({ level: 'silent' }),
          reuploadRequest: this.socket.updateMediaMessage
        }
      );

      return buffer;
    } catch (error) {
      logger.error('Failed to download media:', error);
      return null;
    }
  }

  /**
   * Close WhatsApp connection
   */
  async close() {
    try {
      if (this.socket) {
        await this.socket.logout();
        this.socket = null;
      }
      this.ready = false;
      logger.info('WhatsApp connection closed');
    } catch (error) {
      logger.error('Error closing WhatsApp connection:', error);
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      ready: this.ready,
      lastError: this.lastError,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Check if admin (for compatibility)
   */
  isAdmin(userId) {
    // This might need to be implemented based on your admin logic
    return true;
  }
}

export default WhatsAppBridge;
