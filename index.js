/**
 * AnomChatBot - Human-Controlled Chatbot Bridge
 * WhatsApp ↔ Telegram ↔ OpenAI
 * 
 * Production-ready chatbot system with operator control
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import WhatsAppBridge from './src/bridges/WhatsAppBridge.js';
import TelegramController from './src/bridges/TelegramController.js';
import AIEngine from './src/managers/AIEngine.js';
import ConversationManager from './src/managers/ConversationManager.js';
import MediaHandler from './src/handlers/MediaHandler.js';
import logger from './src/utils/logger.js';

// Load environment variables
dotenv.config();

class AnomChatBot {
  constructor() {
    this.validateEnvironment();
    
    // Initialize components
    this.conversationManager = new ConversationManager();
    this.aiEngine = new AIEngine(process.env.OPENAI_API_KEY);
    this.mediaHandler = new MediaHandler(this.aiEngine);
    
    this.whatsapp = new WhatsAppBridge(
      this.handleWhatsAppMessage.bind(this),
      this.handleWhatsAppReady.bind(this),
      this.handleWhatsAppDisconnected.bind(this)
    );
    
    this.telegram = new TelegramController(
      process.env.TELEGRAM_BOT_TOKEN,
      process.env.TELEGRAM_ADMIN_ID
    );
    
    this.isRunning = false;
  }

  /**
   * Validate required environment variables
   */
  validateEnvironment() {
    const required = ['OPENAI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_ID'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      logger.error(`Missing required environment variables: ${missing.join(', ')}`);
      logger.error('Please copy .env.example to .env and fill in the values');
      process.exit(1);
    }
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    const directories = [
      path.join(process.cwd(), 'logs'),
      path.join(process.cwd(), '.wwebjs_auth')
    ];
    
    directories.forEach(dir => {
      try {
        // Create directory with secure permissions
        // recursive:true creates parent dirs if needed and doesn't error if exists
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        // Ensure permissions are set correctly even if dir already existed
        fs.chmodSync(dir, 0o700);
        logger.debug(`Ensured directory exists with secure permissions: ${dir}`);
      } catch (error) {
        logger.error(`Failed to ensure directory ${dir}:`, error);
        throw error;
      }
    });
  }

  /**
   * Start the chatbot system
   */
  async start() {
    logger.info('🚀 Starting AnomChatBot...');
    
    try {
      // Ensure required directories exist
      this.ensureDirectories();
      
      // Initialize AI Engine
      logger.info('Connecting to OpenAI...');
      await this.aiEngine.initialize();
      
      // Initialize Telegram
      logger.info('Starting Telegram bot...');
      await this.telegram.initialize();
      this.telegram.setCallbacks({
        onManualResponse: this.handleManualResponse.bind(this),
        onEnableAI: this.handleEnableAI.bind(this),
        onDisableAI: this.handleDisableAI.bind(this),
        onGetStatus: this.getSystemStatus.bind(this),
        onListConversations: this.listConversations.bind(this)
      });
      
      // Initialize WhatsApp
      logger.info('Starting WhatsApp client...');
      logger.info('⚠️  Please scan QR code with your phone');
      await this.whatsapp.initialize();
      
      this.isRunning = true;
      logger.info('✅ AnomChatBot is running!');
      
      await this.telegram.sendNotification(
        '🎉 *AnomChatBot Started*\n\n' +
        'System is ready to handle WhatsApp messages.\n' +
        'Use /help for available commands.'
      );
      
    } catch (error) {
      logger.error('Failed to start AnomChatBot:', error);
      process.exit(1);
    }
  }

  /**
   * Handle incoming WhatsApp message
   */
  async handleWhatsAppMessage(message) {
    try {
      const chatId = message.from;
      const contact = await message.getContact();
      const contactName = contact.pushname || contact.number;
      
      logger.info(`Received WhatsApp message from: ${contactName} (${chatId})`);
      
      // Get or create conversation
      const conversation = this.conversationManager.getConversation(chatId);
      
      // Process media if present
      let messageText = message.body;
      let mediaInfo = null;
      
      if (message.hasMedia) {
        const media = await this.mediaHandler.processMedia(message);
        mediaInfo = this.mediaHandler.formatForTelegram(media);
        
        // Generate description if AI can analyze
        if (media && this.mediaHandler.isAnalyzable(media)) {
          const description = await this.mediaHandler.describeMedia(media);
          messageText = `[${media.type}] ${description}\n\nUser message: ${messageText || '(no caption)'}`;
        } else if (media) {
          messageText = `[${media.type}] ${messageText || '(no caption)'}`;
        }
      }
      
      // Add to conversation history
      this.conversationManager.addMessage(chatId, 'user', messageText);
      
      // Forward to Telegram
      await this.telegram.forwardMessage(chatId, messageText, {
        contact: contactName,
        timestamp: new Date().toLocaleString(),
        hasMedia: !!mediaInfo,
        mediaType: mediaInfo?.type
      });
      
      // Check if AI should respond
      if (conversation.aiEnabled && conversation.firstMessageSent) {
        await this.generateAIResponse(chatId);
      }
      
    } catch (error) {
      logger.error('Error handling WhatsApp message:', error);
    }
  }

  /**
   * Handle manual response from operator
   */
  async handleManualResponse(whatsappChatId, message) {
    try {
      logger.info(`Manual response for chat: ${whatsappChatId}`);
      
      // Send to WhatsApp
      await this.whatsapp.sendMessage(whatsappChatId, message);
      
      // Add to conversation history
      this.conversationManager.addMessage(whatsappChatId, 'assistant', message);
      
      // Mark first message as sent
      const conversation = this.conversationManager.getConversation(whatsappChatId);
      if (!conversation.firstMessageSent) {
        conversation.firstMessageSent = true;
      }
      
    } catch (error) {
      logger.error('Failed to send manual response:', error);
      await this.telegram.sendNotification('❌ Failed to send message to WhatsApp');
      throw error;
    }
  }

  /**
   * Enable AI for conversation
   */
  async handleEnableAI(whatsappChatId, systemPrompt) {
    try {
      const conversation = this.conversationManager.getConversation(whatsappChatId);
      
      if (!conversation.firstMessageSent) {
        await this.telegram.sendNotification(
          '⚠️ Please send the first message manually before enabling AI'
        );
        return;
      }
      
      // Set system prompt if provided
      if (systemPrompt) {
        this.conversationManager.setSystemPrompt(whatsappChatId, systemPrompt);
      } else {
        // Default system prompt
        const defaultPrompt = 
          'You are a young, authentic person chatting on WhatsApp. ' +
          'Respond naturally and casually, like a real human would. ' +
          'Keep responses brief and conversational. ' +
          'Do not act like an AI assistant.';
        this.conversationManager.setSystemPrompt(whatsappChatId, defaultPrompt);
      }
      
      // Enable AI
      this.conversationManager.setAiEnabled(whatsappChatId, true);
      
      logger.info(`AI enabled for conversation: ${whatsappChatId}`);
      
    } catch (error) {
      logger.error('Failed to enable AI:', error);
      throw error;
    }
  }

  /**
   * Disable AI for conversation
   */
  async handleDisableAI(whatsappChatId) {
    this.conversationManager.setAiEnabled(whatsappChatId, false);
    logger.info(`AI disabled for conversation: ${whatsappChatId}`);
  }

  /**
   * Generate AI response
   */
  async generateAIResponse(chatId) {
    try {
      const conversation = this.conversationManager.getConversation(chatId);
      
      if (!conversation.aiEnabled) {
        return;
      }
      
      // Get conversation history
      const messages = this.conversationManager.getHistoryForAI(chatId);
      
      // Generate response
      logger.info('Generating AI response...');
      const response = await this.aiEngine.generateResponse(
        messages,
        conversation.settings
      );
      
      // Send to WhatsApp
      await this.whatsapp.sendMessage(chatId, response);
      
      // Add to conversation history
      this.conversationManager.addMessage(chatId, 'assistant', response);
      
      // Notify operator
      await this.telegram.sendNotification(
        `🤖 AI Response sent to ${chatId}\n\n${response}`
      );
      
      logger.info('AI response sent successfully');
      
    } catch (error) {
      logger.error('Failed to generate AI response:', error);
      
      await this.telegram.sendNotification(
        `❌ AI response failed for ${chatId}\n\nError: ${error.message}`
      );
    }
  }

  /**
   * WhatsApp ready handler
   */
  async handleWhatsAppReady() {
    await this.telegram.sendNotification('✅ WhatsApp connected and ready');
  }

  /**
   * WhatsApp disconnected handler
   */
  async handleWhatsAppDisconnected(reason) {
    await this.telegram.sendNotification(
      `⚠️ WhatsApp disconnected: ${reason}\nAttempting to reconnect...`
    );
  }

  /**
   * Get system status
   */
  async getSystemStatus() {
    return {
      whatsapp: this.whatsapp.getStatus(),
      telegram: this.telegram.getStatus(),
      ai: this.aiEngine.getStatus(),
      activeConversations: this.conversationManager.getActiveConversations().length
    };
  }

  /**
   * List active conversations
   */
  async listConversations() {
    return this.conversationManager.getActiveConversations()
      .map(conv => this.conversationManager.getConversationSummary(conv.chatId));
  }

  /**
   * Shutdown gracefully
   */
  async shutdown() {
    logger.info('Shutting down AnomChatBot...');
    
    this.isRunning = false;
    
    await this.telegram.sendNotification('🛑 AnomChatBot shutting down...');
    
    try {
      await this.whatsapp.destroy();
      await this.telegram.stop();
      logger.info('✅ Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Main execution
const bot = new AnomChatBot();

// Handle graceful shutdown
process.on('SIGINT', () => bot.shutdown());
process.on('SIGTERM', () => bot.shutdown());

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  bot.shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Start the bot
bot.start().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
