/**
 * Telegram Controller
 * Handles Telegram bot for operator control panel
 */
import TelegramBot from 'node-telegram-bot-api';
import logger from '../utils/logger.js';

class TelegramController {
  constructor(token, adminId) {
    this.bot = new TelegramBot(token, { polling: true });
    this.adminId = adminId;
    this.ready = false;
    this.lastError = null;
    
    // Store for awaiting responses
    this.pendingResponses = new Map();
    this.conversationMapping = new Map(); // Telegram chatId -> WhatsApp chatId
  }

  /**
   * Initialize Telegram bot
   */
  async initialize() {
    try {
      const me = await this.bot.getMe();
      this.ready = true;
      logger.info(`Telegram bot initialized: @${me.username}`);
      this.setupCommands();
      return true;
    } catch (error) {
      this.lastError = error.message;
      logger.error('Failed to initialize Telegram:', error);
      return false;
    }
  }

  /**
   * Setup bot commands
   */
  setupCommands() {
    // Start command
    this.bot.onText(/\/start/, async (msg) => {
      if (!this.isAdmin(msg.from.id)) return;
      
      await this.bot.sendMessage(msg.chat.id, 
        '🤖 *AnomChatBot Control Panel*\n\n' +
        'Available Commands:\n' +
        '/status - System status\n' +
        '/conversations - List active chats\n' +
        '/help - Show help\n\n' +
        'To respond to messages:\n' +
        '1. Reply to forwarded message\n' +
        '2. Use /ai to enable AI for conversation',
        { parse_mode: 'Markdown' }
      );
    });

    // Status command
    this.bot.onText(/\/status/, async (msg) => {
      if (!this.isAdmin(msg.from.id)) return;
      await this.sendStatusUpdate(msg.chat.id);
    });

    // Conversations command
    this.bot.onText(/\/conversations/, async (msg) => {
      if (!this.isAdmin(msg.from.id)) return;
      
      if (this.onListConversations) {
        const conversations = await this.onListConversations();
        await this.sendConversationsList(msg.chat.id, conversations);
      }
    });

    // Help command
    this.bot.onText(/\/help/, async (msg) => {
      if (!this.isAdmin(msg.from.id)) return;
      
      await this.bot.sendMessage(msg.chat.id,
        '📖 *Help Guide*\n\n' +
        '*Manual Response:*\n' +
        'Reply to any forwarded message\n\n' +
        '*AI Response:*\n' +
        '1. Send first message manually\n' +
        '2. Use format: /ai [system_prompt]\n' +
        '   Example: /ai You are a friendly 22-year-old\n' +
        '3. AI will handle subsequent messages\n\n' +
        '*Settings:*\n' +
        '/set_flirt [0.1-1.0] - Set flirt level\n' +
        '/set_tone [friendly/distant/playful] - Set tone\n\n' +
        '*Control:*\n' +
        '/stop_ai - Disable AI for current chat\n' +
        '/clear - Clear conversation history',
        { parse_mode: 'Markdown' }
      );
    });

    // AI activation command
    this.bot.onText(/\/ai(?:\s+(.+))?/, async (msg, match) => {
      if (!this.isAdmin(msg.from.id)) return;
      
      const systemPrompt = match[1];
      const replyTo = msg.reply_to_message;
      
      if (!replyTo || !replyTo.forward_from_chat) {
        await this.bot.sendMessage(msg.chat.id, 
          '⚠️ Reply to a WhatsApp message to enable AI'
        );
        return;
      }
      
      const whatsappChatId = this.conversationMapping.get(replyTo.message_id);
      
      if (!whatsappChatId) {
        await this.bot.sendMessage(msg.chat.id, 
          '⚠️ Could not identify WhatsApp chat'
        );
        return;
      }
      
      if (this.onEnableAI) {
        await this.onEnableAI(whatsappChatId, systemPrompt);
        await this.bot.sendMessage(msg.chat.id, 
          '✅ AI enabled for this conversation'
        );
      }
    });

    // Stop AI command
    this.bot.onText(/\/stop_ai/, async (msg) => {
      if (!this.isAdmin(msg.from.id)) return;
      
      const replyTo = msg.reply_to_message;
      if (!replyTo) {
        await this.bot.sendMessage(msg.chat.id, 
          '⚠️ Reply to a WhatsApp message'
        );
        return;
      }
      
      const whatsappChatId = this.conversationMapping.get(replyTo.message_id);
      
      if (whatsappChatId && this.onDisableAI) {
        await this.onDisableAI(whatsappChatId);
        await this.bot.sendMessage(msg.chat.id, 
          '🛑 AI disabled for this conversation'
        );
      }
    });

    // Handle replies to forwarded messages
    this.bot.on('message', async (msg) => {
      if (!this.isAdmin(msg.from.id)) return;
      if (msg.text && msg.text.startsWith('/')) return; // Skip commands
      
      const replyTo = msg.reply_to_message;
      
      if (replyTo && this.conversationMapping.has(replyTo.message_id)) {
        const whatsappChatId = this.conversationMapping.get(replyTo.message_id);
        
        if (this.onManualResponse) {
          await this.onManualResponse(whatsappChatId, msg.text);
          await this.bot.sendMessage(msg.chat.id, '✅ Message sent');
        }
      }
    });

    // Error handling
    this.bot.on('polling_error', (error) => {
      this.lastError = error.message;
      logger.error('Telegram polling error:', error);
    });
  }

  /**
   * Forward WhatsApp message to Telegram
   */
  async forwardMessage(whatsappChatId, message, metadata = {}) {
    try {
      const formattedMessage = this.formatWhatsAppMessage(message, metadata);
      
      const sent = await this.bot.sendMessage(
        this.adminId,
        formattedMessage,
        { parse_mode: 'Markdown' }
      );
      
      // Store mapping for replies
      this.conversationMapping.set(sent.message_id, whatsappChatId);
      
      logger.info(`Message forwarded to Telegram from: ${whatsappChatId}`);
      return true;
    } catch (error) {
      this.lastError = error.message;
      logger.error('Failed to forward message to Telegram:', error);
      return false;
    }
  }

  /**
   * Format WhatsApp message for Telegram display
   */
  formatWhatsAppMessage(message, metadata = {}) {
    const { contact, timestamp, hasMedia, mediaType } = metadata;
    
    let formatted = `📱 *WhatsApp Message*\n`;
    formatted += `From: ${contact || 'Unknown'}\n`;
    formatted += `Time: ${timestamp || new Date().toLocaleString()}\n`;
    
    if (hasMedia) {
      formatted += `Media: ${mediaType || 'attachment'}\n`;
    }
    
    formatted += `\n${message}`;
    
    return formatted;
  }

  /**
   * Send status update
   */
  async sendStatusUpdate(chatId) {
    if (this.onGetStatus) {
      const status = await this.onGetStatus();
      
      let statusText = '📊 *System Status*\n\n';
      
      // WhatsApp status
      statusText += `WhatsApp: ${status.whatsapp.ready ? '✅ Connected' : '❌ Disconnected'}\n`;
      if (status.whatsapp.lastError) {
        statusText += `  Error: ${status.whatsapp.lastError}\n`;
      }
      
      // Telegram status
      statusText += `Telegram: ${status.telegram.ready ? '✅ Connected' : '❌ Disconnected'}\n`;
      
      // OpenAI status
      statusText += `OpenAI: ${status.ai.connected ? '✅ Connected' : '❌ Disconnected'}\n`;
      if (status.ai.lastError) {
        statusText += `  Error: ${status.ai.lastError}\n`;
      }
      
      // Active conversations
      statusText += `\nActive Chats: ${status.activeConversations || 0}`;
      
      await this.bot.sendMessage(chatId, statusText, { parse_mode: 'Markdown' });
    }
  }

  /**
   * Send conversations list
   */
  async sendConversationsList(chatId, conversations) {
    if (!conversations || conversations.length === 0) {
      await this.bot.sendMessage(chatId, 'No active conversations');
      return;
    }
    
    let list = '💬 *Active Conversations*\n\n';
    
    conversations.forEach((conv, index) => {
      list += `${index + 1}. ${conv.chatId}\n`;
      list += `   AI: ${conv.aiEnabled ? '✅' : '❌'} | `;
      list += `Messages: ${conv.messageCount}\n`;
      list += `   Last: ${conv.lastActivity.toLocaleString()}\n\n`;
    });
    
    await this.bot.sendMessage(chatId, list, { parse_mode: 'Markdown' });
  }

  /**
   * Send notification
   */
  async sendNotification(message) {
    try {
      await this.bot.sendMessage(this.adminId, message);
      return true;
    } catch (error) {
      logger.error('Failed to send Telegram notification:', error);
      return false;
    }
  }

  /**
   * Check if user is admin
   */
  isAdmin(userId) {
    return userId.toString() === this.adminId.toString();
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      ready: this.ready,
      lastError: this.lastError
    };
  }

  /**
   * Set callback handlers
   */
  setCallbacks(callbacks) {
    this.onManualResponse = callbacks.onManualResponse;
    this.onEnableAI = callbacks.onEnableAI;
    this.onDisableAI = callbacks.onDisableAI;
    this.onGetStatus = callbacks.onGetStatus;
    this.onListConversations = callbacks.onListConversations;
  }

  /**
   * Stop bot
   */
  async stop() {
    if (this.bot) {
      await this.bot.stopPolling();
      this.ready = false;
      logger.info('Telegram bot stopped');
    }
  }
}

export default TelegramController;
