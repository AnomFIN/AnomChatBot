import {
  getOrCreateConversation,
  getConversation,
  updateConversationSettings,
  touchConversation,
} from '../persistence/conversations.js';
import { addMessage, getRecentMessages, updateDeliveryStatus, updatePlatformMessageId, updateMessageMedia, addMediaMetadata } from '../persistence/messages.js';
import { getSettingsBulk } from '../persistence/settings.js';
import { buildMessages } from './promptBuilder.js';
import { createDelayManager } from './delayManager.js';
import { createPresenceManager } from './presenceManager.js';
import { createAIProvider } from '../ai/provider.js';
import { downloadAndStore } from '../media/storage.js';

/**
 * Create the conversation orchestrator.
 * Central message router: receive → persist → delay → AI → presence → send.
 *
 * @param {object} config — App config
 * @param {object} aiProvider — AI provider from createAIProvider
 * @param {object|null} io — Socket.IO server instance (may be null in tests)
 * @param {object} opts
 * @param {function} opts.getTransport — Returns the current transport adapter
 * @param {object} opts.logger — Pino logger
 * @returns {object} Orchestrator
 */
export function createOrchestrator(config, aiProvider, io, { getTransport, logger } = {}) {

  function emit(event, data) {
    if (io) io.emit(event, data);
  }

  function log(level, msg, meta) {
    if (logger) logger[level]({ ...meta }, `[orchestrator] ${msg}`);
    else if (level === 'error') console.error(`[orchestrator] ${msg}`);
  }

  // ── Presence manager ─────────────────────────────────────────────────
  const presenceManager = createPresenceManager({
    getTransport: getTransport ?? (() => null),
    logger,
  });

  // ── Delay manager ────────────────────────────────────────────────────
  const delayManager = createDelayManager({
    logger,
    onReady: async (conversationId, version) => {
      await _processDelayedReply(conversationId, version);
    },
  });

  // Store message keys per conversation for read receipts
  const pendingMessageKeys = new Map();

  // Cache per-conversation AI providers to avoid recreating each call
  const conversationProviders = new Map();

  /**
   * Get the AI provider for a conversation.
   * If the conversation has ai_provider/ai_base_url/ai_model overrides, use a
   * dedicated provider instance. Otherwise, use the global default.
   */
  function getAIProvider(conversation) {
    if (!conversation.ai_provider || !conversation.ai_model) {
      // Check global settings table for runtime AI overrides (set via GUI)
      return _getGlobalAIProvider() ?? aiProvider;
    }

    // Check cache (keyed by provider+baseUrl+model)
    const cacheKey = `${conversation.ai_provider}|${conversation.ai_base_url ?? ''}|${conversation.ai_model}`;
    if (conversationProviders.has(cacheKey)) {
      return conversationProviders.get(cacheKey);
    }

    // Create a per-conversation provider
    const overrideConfig = {
      ai: {
        provider: conversation.ai_provider,
        openaiApiKey: config.ai.openaiApiKey, // Use global key — per-conversation key not supported for security
        openaiBaseUrl: conversation.ai_base_url || '',
        openaiModel: conversation.ai_model,
      },
    };

    try {
      const provider = createAIProvider(overrideConfig);
      conversationProviders.set(cacheKey, provider);
      log('info', `Created per-conversation AI provider: ${cacheKey}`);
      return provider;
    } catch (err) {
      log('warn', `Failed to create per-conversation AI provider (${cacheKey}): ${err.message}`);
      return aiProvider;
    }
  }

  /**
   * Check global settings table for runtime AI overrides.
   * Returns a cached provider if global overrides are configured, or null.
   */
  function _getGlobalAIProvider() {
    const settings = getSettingsBulk(['ai_provider', 'ai_base_url', 'ai_model', 'ai_api_key']);
    if (!settings.ai_provider || !settings.ai_model) {
      return null;
    }

    const cacheKey = `global|${settings.ai_provider}|${settings.ai_base_url ?? ''}|${settings.ai_model}`;
    if (conversationProviders.has(cacheKey)) {
      return conversationProviders.get(cacheKey);
    }

    const overrideConfig = {
      ai: {
        provider: settings.ai_provider,
        openaiApiKey: settings.ai_api_key || config.ai.openaiApiKey,
        openaiBaseUrl: settings.ai_base_url || '',
        openaiModel: settings.ai_model,
      },
    };

    try {
      const provider = createAIProvider(overrideConfig);
      conversationProviders.set(cacheKey, provider);
      log('info', `Created global AI override provider: ${cacheKey}`);
      return provider;
    } catch (err) {
      log('warn', `Failed to create global AI override provider: ${err.message}`);
      return null;
    }
  }

  /**
   * Process a delayed AI reply after the delay timer expires.
   * Checks version token to prevent stale replies.
   */
  async function _processDelayedReply(conversationId, version) {
    // Version check — if newer messages arrived and reset the timer,
    // this version is stale and should be discarded
    if (!delayManager.isCurrentVersion(conversationId, version)) {
      log('info', `Stale reply discarded for ${conversationId} (v${version} is no longer current)`);
      return;
    }

    const conversation = getConversation(conversationId);
    if (!conversation) {
      log('warn', `Conversation ${conversationId} not found for delayed reply`);
      delayManager.complete(conversationId);
      return;
    }

    // Emit bot activity: reading/thinking
    emit('bot:activity', { conversationId, state: 'thinking' });

    // Build prompt with ALL recent messages (including any that arrived during delay)
    const recentMessages = getRecentMessages(
      conversationId,
      conversation.max_history ?? config.defaults.maxHistory,
    );

    const messages = buildMessages(conversation, recentMessages, config);

    let aiReply;
    try {
      const provider = getAIProvider(conversation);
      aiReply = await provider.generateReply(messages, {
        temperature: conversation.temperature,
        max_tokens: conversation.max_tokens,
      });
    } catch (err) {
      log('error', `AI error for ${conversationId}: ${err.message}`);
      delayManager.complete(conversationId);
      emit('bot:activity', { conversationId, state: 'idle' });
      return;
    }

    // Version check AGAIN after AI call (more messages may have arrived while waiting for AI)
    if (!delayManager.isCurrentVersion(conversationId, version)) {
      log('info', `Stale AI reply discarded for ${conversationId} (v${version} outdated after AI call)`);
      return;
    }

    // Persist AI response
    const aiMessage = addMessage(conversationId, 'assistant', aiReply.content, {
      token_count: aiReply.tokenUsage?.total ?? null,
      direction: 'outbound',
      delivery_status: 'queued',
    });

    emit('message:new', { conversationId, message: aiMessage });

    // Send via transport with presence simulation
    await _sendWithPresence(conversation, aiMessage, aiReply.content);

    touchConversation(conversationId);
    delayManager.complete(conversationId);
  }

  /**
   * Send a message via transport with presence simulation and delivery tracking.
   */
  async function _sendWithPresence(conversation, messageRow, content) {
    const transport = getTransport?.();
    if (!transport || !conversation.remote_id) {
      log('warn', `No transport or remote_id for conversation ${conversation.id}`);
      updateDeliveryStatus(messageRow.id, 'failed', 'No transport available');
      _emitMessageStatus(conversation.id, messageRow.id, 'failed', 'No transport available');
      emit('bot:activity', { conversationId: conversation.id, state: 'idle' });
      return;
    }

    // Update status to sending
    updateDeliveryStatus(messageRow.id, 'sending');
    _emitMessageStatus(conversation.id, messageRow.id, 'sending');
    emit('bot:activity', { conversationId: conversation.id, state: 'typing' });

    // Presence simulation: online → read → typing → (done, caller sends)
    const msgKeys = pendingMessageKeys.get(conversation.id) ?? [];
    await presenceManager.simulateBeforeSend(conversation.remote_id, content, msgKeys);
    pendingMessageKeys.delete(conversation.id);

    emit('bot:activity', { conversationId: conversation.id, state: 'sending' });

    // Actually send
    try {
      const sendResult = await transport.sendMessage(conversation.remote_id, content);

      if (sendResult.success) {
        updateDeliveryStatus(messageRow.id, 'sent');
        if (sendResult.platformMessageId) {
          updatePlatformMessageId(messageRow.id, sendResult.platformMessageId);
        }
        _emitMessageStatus(conversation.id, messageRow.id, 'sent');
        log('info', `Message sent to ${conversation.remote_id} (msg ${messageRow.id})`);
      } else {
        updateDeliveryStatus(messageRow.id, 'failed', sendResult.error);
        _emitMessageStatus(conversation.id, messageRow.id, 'failed', sendResult.error);
        log('warn', `Send failed to ${conversation.remote_id}: ${sendResult.error}`);
      }
    } catch (err) {
      updateDeliveryStatus(messageRow.id, 'failed', err.message);
      _emitMessageStatus(conversation.id, messageRow.id, 'failed', err.message);
      log('error', `Send error to ${conversation.remote_id}: ${err.message}`);
    }

    // Schedule going idle after send
    presenceManager.scheduleIdle(conversation.remote_id);
    emit('bot:activity', { conversationId: conversation.id, state: 'idle' });
  }

  /**
   * Emit delivery status update via Socket.IO.
   */
  function _emitMessageStatus(conversationId, messageId, status, error = null) {
    emit('message:status', { conversationId, messageId, status, error });
  }

  /**
   * Asynchronously download and store media for an inbound message.
   * Non-blocking: fire-and-forget from the main message flow.
   * On success: updates message row and inserts media_metadata, emits update to GUI.
   * On failure: logs error, message retains its placeholder content.
   */
  function _downloadMediaAsync(conversationId, messageId, mediaInfo, downloadFn) {
    downloadAndStore({
      download: downloadFn,
      mediaType: mediaInfo.media_type,
      mimeType: mediaInfo.media_mime_type,
      originalName: mediaInfo.original_name,
      messageId,
    }).then((stored) => {
      // Update message row with file path + resolved metadata
      const updated = updateMessageMedia(messageId, {
        media_path: stored.servePath,
        media_mime_type: stored.mimeType,
        media_size_bytes: stored.sizeBytes,
      });

      // Insert enriched metadata record
      addMediaMetadata(messageId, {
        media_type: mediaInfo.media_type,
        mime_type: stored.mimeType,
        file_size: stored.sizeBytes,
        file_path: stored.servePath,
        original_url: mediaInfo.media_url ?? null,
      });

      // Notify GUI that the message was updated with media
      if (updated) {
        emit('message:update', { conversationId, message: updated });
      }

      log('info', `Media stored for message ${messageId}: ${stored.fileName} (${stored.sizeBytes} bytes)`);
    }).catch((err) => {
      log('warn', `Media download failed for message ${messageId}: ${err.message}`);
      // Message retains placeholder content — no crash, no regression
    });
  }

  /**
   * Handle an incoming message from an external source (transport).
   * Creates conversation if new. Schedules delayed AI reply if auto_reply is enabled.
   *
   * Media handling is non-blocking:
   * 1. Message is persisted immediately with basic mediaInfo (type, platform ref)
   * 2. If downloadMedia function is provided, async download is kicked off
   * 3. On success, message row is updated with file path + metadata
   * 4. On failure, error is logged and message keeps its placeholder content
   *
   * @param {string} platform — 'whatsapp_baileys' | 'whatsapp_cloud'
   * @param {string} remoteId — phone number
   * @param {string} displayName — display name for the contact
   * @param {string} content — message text
   * @param {object} [mediaInfo] — optional { media_type, media_url, media_mime_type, media_size_bytes, original_name }
   * @param {Function} [downloadMedia] — async () => Buffer, provided by transport for media messages
   * @param {object} [rawMessageKey] — Baileys message key for read receipts
   * @returns {object} { conversation, userMessage, reason? }
   */
  async function handleIncomingMessage(platform, remoteId, displayName, content, mediaInfo, downloadMedia, rawMessageKey) {
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

    // 2. Persist user message immediately (non-blocking — media downloaded after)
    const userMessage = addMessage(conversation.id, 'user', content, {
      direction: 'inbound',
      media_type: mediaInfo?.media_type ?? null,
      media_url: mediaInfo?.media_url ?? null,
      media_path: mediaInfo?.media_path ?? null,
      media_mime_type: mediaInfo?.media_mime_type ?? null,
      media_size_bytes: mediaInfo?.media_size_bytes ?? null,
    });

    emit('message:new', { conversationId: conversation.id, message: userMessage });
    touchConversation(conversation.id);

    // 3. Async media download — fire-and-forget, updates message row on completion
    if (mediaInfo && typeof downloadMedia === 'function') {
      _downloadMediaAsync(conversation.id, userMessage.id, mediaInfo, downloadMedia);
    }

    // Store message key for read receipt simulation
    if (rawMessageKey) {
      const keys = pendingMessageKeys.get(conversation.id) ?? [];
      keys.push(rawMessageKey);
      pendingMessageKeys.set(conversation.id, keys);
    }

    // 4. Check auto_reply
    if (conversation.auto_reply === 0) {
      return {
        conversation,
        userMessage,
        aiReply: null,
        reason: 'auto_reply_disabled',
      };
    }

    // 5. Schedule delayed reply (resets timer if already pending — multi-message batching)
    delayManager.scheduleReply(conversation.id, conversation);

    return {
      conversation,
      userMessage,
      aiReply: null,
      reason: 'reply_scheduled',
    };
  }

  /**
   * Handle an operator-sent message (from admin GUI or API).
   * The operator IS the bot, so the message role is 'assistant'.
   * SENDS the message to WhatsApp via transport.
   * Flips auto_reply to 1 on the first operator message (first-message rule).
   *
   * @param {string} conversationId — existing conversation ID
   * @param {string} content — message text
   * @returns {object} { conversation, message, delivery }
   */
  async function handleOperatorMessage(conversationId, content) {
    const conversation = getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    // Cancel any pending AI reply — operator is taking over
    if (delayManager.hasPending(conversationId)) {
      delayManager.cancel(conversationId);
      emit('bot:activity', { conversationId, state: 'idle' });
      log('info', `Cancelled pending AI reply for ${conversationId} — operator message`);
    }

    // Persist operator message as 'assistant' (operator IS the bot persona)
    const message = addMessage(conversationId, 'assistant', content, {
      direction: 'outbound',
      delivery_status: 'queued',
    });

    emit('message:new', { conversationId, message });

    // First-message rule: flip auto_reply from 0 → 1 and mark manual first message
    if (conversation.auto_reply === 0) {
      updateConversationSettings(conversationId, {
        auto_reply: 1,
        first_message_sent_manually: 1,
      });
      const updated = getConversation(conversationId);
      emit('conversation:update', { conversation: updated });
    }

    // Send to WhatsApp via transport
    const transport = getTransport?.();
    let delivery = { status: 'queued' };

    if (transport && conversation.remote_id) {
      updateDeliveryStatus(message.id, 'sending');
      _emitMessageStatus(conversationId, message.id, 'sending');

      try {
        const sendResult = await transport.sendMessage(conversation.remote_id, content);

        if (sendResult.success) {
          updateDeliveryStatus(message.id, 'sent');
          if (sendResult.platformMessageId) {
            updatePlatformMessageId(message.id, sendResult.platformMessageId);
          }
          _emitMessageStatus(conversationId, message.id, 'sent');
          delivery = { status: 'sent', platformMessageId: sendResult.platformMessageId };
          log('info', `Operator message sent to ${conversation.remote_id} (msg ${message.id})`);
        } else {
          updateDeliveryStatus(message.id, 'failed', sendResult.error);
          _emitMessageStatus(conversationId, message.id, 'failed', sendResult.error);
          delivery = { status: 'failed', error: sendResult.error };
          log('warn', `Operator message send failed to ${conversation.remote_id}: ${sendResult.error}`);
        }
      } catch (err) {
        updateDeliveryStatus(message.id, 'failed', err.message);
        _emitMessageStatus(conversationId, message.id, 'failed', err.message);
        delivery = { status: 'failed', error: err.message };
        log('error', `Operator message send error to ${conversation.remote_id}: ${err.message}`);
      }
    } else {
      updateDeliveryStatus(message.id, 'failed', 'No transport or remote_id');
      _emitMessageStatus(conversationId, message.id, 'failed', 'No transport or remote_id');
      delivery = { status: 'failed', error: 'No transport available' };
      log('warn', `No transport for operator message in ${conversationId}`);
    }

    touchConversation(conversationId);

    return {
      conversation: getConversation(conversationId),
      message,
      delivery,
    };
  }

  /**
   * Get delay manager status (for status bar).
   */
  function getStatus() {
    return {
      pendingReplies: delayManager.getPendingCount(),
    };
  }

  /**
   * Shutdown delay and presence managers.
   */
  function shutdown() {
    delayManager.shutdown();
    presenceManager.shutdown();
  }

  return {
    handleIncomingMessage,
    handleOperatorMessage,
    getStatus,
    shutdown,
    // Expose for testing
    _delayManager: delayManager,
    _presenceManager: presenceManager,
  };
}
