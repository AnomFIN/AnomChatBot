import {
  getOrCreateConversation,
  getConversation,
  updateConversationSettings,
  touchConversation,
} from '../persistence/conversations.js';
import { addMessage, getRecentMessages } from '../persistence/messages.js';
import { buildMessages } from './promptBuilder.js';

/**
 * Create the conversation orchestrator.
 * Central message router: receive → persist → AI → persist → respond.
 *
 * @param {object} config — App config
 * @param {object} aiProvider — AI provider from createAIProvider
 * @param {object|null} io — Socket.IO server instance (may be null in tests)
 * @returns {object} Orchestrator with handleIncomingMessage, handleOperatorMessage
 */
export function createOrchestrator(config, aiProvider, io) {

  function emit(event, data) {
    if (io) io.emit(event, data);
  }

  /**
   * Handle an incoming message from an external source (transport or API test).
   * Creates conversation if new. Triggers AI reply if auto_reply is enabled.
   *
   * @param {string} platform — 'whatsapp' | 'api'
   * @param {string} remoteId — phone number, chat ID, or test identifier
   * @param {string} displayName — display name for the contact
   * @param {string} content — message text
   * @param {object} [mediaInfo] — optional { media_type, media_url }
   * @returns {object} { conversation, userMessage, aiReply, reason? }
   */
  async function handleIncomingMessage(platform, remoteId, displayName, content, mediaInfo) {
    // 1. Get or create conversation
    const defaults = {
      tone: config.defaults.tone,
      flirt: config.defaults.flirt,
      temperature: config.defaults.temperature,
      max_tokens: config.defaults.maxTokens,
      max_history: config.defaults.maxHistory,
    };

    const { conversation, created } = getOrCreateConversation(platform, remoteId, displayName, defaults);

    if (created) {
      emit('conversation:new', { conversation });
    }

    // 2. Persist user message
    const userMessage = addMessage(conversation.id, 'user', content, {
      media_type: mediaInfo?.media_type ?? null,
      media_url: mediaInfo?.media_url ?? null,
    });

    emit('message:new', { conversationId: conversation.id, message: userMessage });

    // 3. Check auto_reply
    if (conversation.auto_reply === 0) {
      return {
        conversation,
        userMessage,
        aiReply: null,
        reason: 'auto_reply_disabled',
      };
    }

    // 4. Build prompt and call AI
    const recentMessages = getRecentMessages(
      conversation.id,
      conversation.max_history ?? config.defaults.maxHistory,
    );

    const messages = buildMessages(conversation, recentMessages, config);

    let aiReply;
    try {
      aiReply = await aiProvider.generateReply(messages, {
        temperature: conversation.temperature,
        max_tokens: conversation.max_tokens,
      });
    } catch (err) {
      // AI failure — return without reply, don't crash
      return {
        conversation,
        userMessage,
        aiReply: null,
        reason: 'ai_error',
        error: err.message ?? String(err),
      };
    }

    // 5. Persist AI response
    const aiMessage = addMessage(conversation.id, 'assistant', aiReply.content, {
      token_count: aiReply.tokenUsage?.total ?? null,
    });

    // 6. Touch conversation updated_at
    touchConversation(conversation.id);

    emit('message:new', { conversationId: conversation.id, message: aiMessage });

    // 7. Return full result
    return {
      conversation: getConversation(conversation.id),
      userMessage,
      aiReply: aiMessage,
    };
  }

  /**
   * Handle an operator-sent message (from admin GUI or API).
   * The operator IS the bot, so the message role is 'assistant'.
   * Flips auto_reply to 1 on the first operator message (first-message rule).
   *
   * @param {string} conversationId — existing conversation ID
   * @param {string} content — message text
   * @returns {object} { conversation, message }
   */
  async function handleOperatorMessage(conversationId, content) {
    const conversation = getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    // Persist operator message as 'assistant' (operator IS the bot persona)
    const message = addMessage(conversationId, 'assistant', content);

    emit('message:new', { conversationId, message });

    // First-message rule: flip auto_reply from 0 → 1
    if (conversation.auto_reply === 0) {
      updateConversationSettings(conversationId, { auto_reply: 1 });
      const updated = getConversation(conversationId);
      emit('conversation:update', { conversation: updated });
    }

    touchConversation(conversationId);

    return {
      conversation: getConversation(conversationId),
      message,
    };
  }

  return { handleIncomingMessage, handleOperatorMessage };
}
