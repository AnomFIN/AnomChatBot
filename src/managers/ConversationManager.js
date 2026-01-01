/**
 * Conversation Manager
 * Handles conversation state, history, and settings for each chat
 */
import logger from '../utils/logger.js';

class ConversationManager {
  constructor() {
    // Store: chatId -> conversation data
    this.conversations = new Map();
  }

  /**
   * Get or create conversation
   */
  getConversation(chatId) {
    if (!this.conversations.has(chatId)) {
      this.conversations.set(chatId, {
        chatId,
        active: true,
        aiEnabled: false,
        systemPrompt: null,
        firstMessageSent: false,
        history: [],
        settings: {
          flirtLevel: 0.5,
          tone: 'friendly',
          responseSpeed: 'normal',
          aiAggressiveness: 0.5
        },
        metadata: {
          createdAt: new Date(),
          lastActivity: new Date(),
          messageCount: 0
        }
      });
      logger.info(`Created new conversation: ${chatId}`);
    }
    return this.conversations.get(chatId);
  }

  /**
   * Add message to conversation history
   */
  addMessage(chatId, role, content, metadata = {}) {
    const conversation = this.getConversation(chatId);
    
    const message = {
      role, // 'user', 'assistant', 'system'
      content,
      timestamp: new Date(),
      ...metadata
    };
    
    conversation.history.push(message);
    conversation.metadata.lastActivity = new Date();
    conversation.metadata.messageCount++;
    
    // Keep history manageable (last 100 messages)
    if (conversation.history.length > 100) {
      conversation.history = conversation.history.slice(-100);
    }
    
    return message;
  }

  /**
   * Set system prompt (defines AI personality)
   */
  setSystemPrompt(chatId, prompt) {
    const conversation = this.getConversation(chatId);
    conversation.systemPrompt = prompt;
    conversation.firstMessageSent = true;
    logger.info(`System prompt set for conversation: ${chatId}`);
  }

  /**
   * Enable/disable AI for conversation
   */
  setAiEnabled(chatId, enabled) {
    const conversation = this.getConversation(chatId);
    conversation.aiEnabled = enabled;
    logger.info(`AI ${enabled ? 'enabled' : 'disabled'} for conversation: ${chatId}`);
  }

  /**
   * Update conversation settings
   */
  updateSettings(chatId, settings) {
    const conversation = this.getConversation(chatId);
    conversation.settings = { ...conversation.settings, ...settings };
    logger.info(`Settings updated for conversation: ${chatId}`);
  }

  /**
   * Get conversation history for AI context
   */
  getHistoryForAI(chatId, maxMessages = 20) {
    const conversation = this.getConversation(chatId);
    
    const messages = [];
    
    // Add system prompt if exists
    if (conversation.systemPrompt) {
      messages.push({
        role: 'system',
        content: conversation.systemPrompt
      });
    }
    
    // Add recent history
    const recentHistory = conversation.history.slice(-maxMessages);
    messages.push(...recentHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    })));
    
    return messages;
  }

  /**
   * Get all active conversations
   */
  getActiveConversations() {
    return Array.from(this.conversations.values())
      .filter(conv => conv.active)
      .sort((a, b) => b.metadata.lastActivity - a.metadata.lastActivity);
  }

  /**
   * Get conversation summary for display
   */
  getConversationSummary(chatId) {
    const conversation = this.getConversation(chatId);
    const lastMessage = conversation.history[conversation.history.length - 1];
    
    return {
      chatId,
      active: conversation.active,
      aiEnabled: conversation.aiEnabled,
      hasSystemPrompt: !!conversation.systemPrompt,
      messageCount: conversation.metadata.messageCount,
      lastActivity: conversation.metadata.lastActivity,
      lastMessage: lastMessage ? {
        role: lastMessage.role,
        preview: lastMessage.content.substring(0, 50) + '...',
        timestamp: lastMessage.timestamp
      } : null
    };
  }

  /**
   * Clear conversation history
   */
  clearHistory(chatId) {
    const conversation = this.getConversation(chatId);
    conversation.history = [];
    logger.info(`History cleared for conversation: ${chatId}`);
  }

  /**
   * Delete conversation
   */
  deleteConversation(chatId) {
    this.conversations.delete(chatId);
    logger.info(`Conversation deleted: ${chatId}`);
  }
}

export default ConversationManager;
