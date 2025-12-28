/**
 * WhatsApp Bridge
 * Handles WhatsApp connection and message routing
 */
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import logger from '../utils/logger.js';

class WhatsAppBridge {
  constructor(onMessage, onReady, onDisconnected) {
    this.client = null;
    this.ready = false;
    this.onMessage = onMessage;
    this.onReady = onReady;
    this.onDisconnected = onDisconnected;
    this.lastError = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Initialize WhatsApp client
   */
  async initialize() {
    try {
      logger.info('Initializing WhatsApp client...');

      this.client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        }
      });

      this.setupEventHandlers();
      await this.client.initialize();

      return true;
    } catch (error) {
      this.lastError = error.message;
      logger.error('Failed to initialize WhatsApp:', error);
      return false;
    }
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // QR Code for authentication
    this.client.on('qr', (qr) => {
      logger.info('WhatsApp QR Code received. Scan with your phone:');
      qrcode.generate(qr, { small: true });
    });

    // Client ready
    this.client.on('ready', () => {
      this.ready = true;
      this.reconnectAttempts = 0;
      logger.info('WhatsApp client is ready!');
      if (this.onReady) this.onReady();
    });

    // Authenticated
    this.client.on('authenticated', () => {
      logger.info('WhatsApp authenticated');
    });

    // Authentication failure
    this.client.on('auth_failure', (msg) => {
      this.lastError = 'Authentication failed';
      logger.error('WhatsApp authentication failed:', msg);
    });

    // Disconnected
    this.client.on('disconnected', async (reason) => {
      this.ready = false;
      this.lastError = `Disconnected: ${reason}`;
      logger.warn('WhatsApp disconnected:', reason);
      
      if (this.onDisconnected) this.onDisconnected(reason);
      
      // Auto-reconnect
      await this.handleReconnect();
    });

    // Incoming messages
    this.client.on('message', async (message) => {
      try {
        if (this.onMessage) {
          await this.onMessage(message);
        }
      } catch (error) {
        logger.error('Error handling WhatsApp message:', error);
      }
    });
  }

  /**
   * Handle reconnection logic
   */
  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnect attempts reached. Manual restart required.');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    logger.info(`Attempting to reconnect in ${delay / 1000}s... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        logger.error('Reconnection failed:', error);
      }
    }, delay);
  }

  /**
   * Send message to WhatsApp
   */
  async sendMessage(chatId, message) {
    if (!this.ready) {
      throw new Error('WhatsApp client not ready');
    }

    try {
      await this.client.sendMessage(chatId, message);
      logger.info(`Message sent to WhatsApp chat: ${chatId}`);
      return true;
    } catch (error) {
      this.lastError = error.message;
      logger.error('Failed to send WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Send media to WhatsApp
   */
  async sendMedia(chatId, media) {
    if (!this.ready) {
      throw new Error('WhatsApp client not ready');
    }

    try {
      await this.client.sendMessage(chatId, media);
      logger.info(`Media sent to WhatsApp chat: ${chatId}`);
      return true;
    } catch (error) {
      this.lastError = error.message;
      logger.error('Failed to send WhatsApp media:', error);
      throw error;
    }
  }

  /**
   * Get chat by ID
   */
  async getChat(chatId) {
    if (!this.ready) {
      throw new Error('WhatsApp client not ready');
    }

    try {
      return await this.client.getChatById(chatId);
    } catch (error) {
      logger.error('Failed to get WhatsApp chat:', error);
      return null;
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
   * Destroy client
   */
  async destroy() {
    if (this.client) {
      await this.client.destroy();
      this.ready = false;
      logger.info('WhatsApp client destroyed');
    }
  }
}

export default WhatsAppBridge;
