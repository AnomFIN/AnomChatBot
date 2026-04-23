import {
  listConversations,
  getConversation,
  createConversation,
  findConversationByRemote,
  refreshConversationActivityFromMessages,
} from '../persistence/conversations.js';
import {
  getMessages,
  getMessageCount,
  deleteAllMessages,
  deleteMessagesKeepLatest,
} from '../persistence/messages.js';
import { getDefaultPreset } from '../persistence/presets.js';

/**
 * Conversation API routes.
 *
 * GET  /api/conversations                — List all conversations
 * POST /api/conversations                — Create a new conversation
 * GET  /api/conversations/:id            — Get single conversation
 * GET  /api/conversations/:id/messages   — Get message history (paginated)
 * POST /api/conversations/:id/messages   — Operator sends a message
 */
export default async function conversationRoutes(fastify, opts) {
  const { orchestrator, config, io } = opts;

  // ── List conversations ─────────────────────────────────────────────────
  fastify.get('/api/conversations', async () => {
    const conversations = listConversations();
    return { success: true, data: conversations };
  });

  // ── Create new conversation ────────────────────────────────────────────
  fastify.post('/api/conversations', async (request, reply) => {
    const { phone_number, display_name } = request.body || {};

    if (!phone_number || typeof phone_number !== 'string' || phone_number.trim().length === 0) {
      reply.code(400);
      return { success: false, error: 'phone_number is required' };
    }

    // Normalize: strip spaces, dashes, plus sign prefix
    const normalized = phone_number.trim().replace(/[\s\-\+]/g, '');
    if (!/^\d{7,15}$/.test(normalized)) {
      reply.code(400);
      return { success: false, error: 'phone_number must be 7-15 digits' };
    }

    // Determine platform based on current whatsapp mode
    const platform = config.whatsapp.mode === 'cloud_api' ? 'whatsapp_cloud' : 'whatsapp_baileys';

    // Check if conversation already exists
    const existing = findConversationByRemote(platform, normalized);
    if (existing) {
      return { success: true, data: existing, existed: true };
    }

    // Get default preset for initial settings
    const defaultPreset = getDefaultPreset();
    const defaults = {
      tone: defaultPreset?.tone ?? config.defaults.tone,
      flirt: defaultPreset?.flirt ?? config.defaults.flirt,
      temperature: defaultPreset?.temperature ?? config.defaults.temperature,
      max_tokens: defaultPreset?.max_tokens ?? config.defaults.maxTokens,
      max_history: config.defaults.maxHistory,
      preset_id: defaultPreset?.id ?? null,
      system_prompt: defaultPreset?.system_prompt ?? '',
    };

    const conversation = createConversation({
      platform,
      remoteId: normalized,
      displayName: (display_name || '').trim() || normalized,
      defaults,
    });

    return { success: true, data: conversation, existed: false };
  });

  // ── Get single conversation ────────────────────────────────────────────
  fastify.get('/api/conversations/:id', async (request, reply) => {
    const conversation = getConversation(request.params.id);
    if (!conversation) {
      reply.code(404);
      return { success: false, error: 'Conversation not found' };
    }
    return { success: true, data: conversation };
  });

  // ── Fetch profile photo ────────────────────────────────────────────────
  fastify.get('/api/conversations/:id/photo', async (request, reply) => {
    const { transportManager } = opts;
    const conversation = getConversation(request.params.id);
    if (!conversation) {
      reply.code(404);
      return { success: false, error: 'Conversation not found' };
    }

    const transport = transportManager?.getTransport();
    if (!transport || !conversation.remote_id) {
      return { success: true, data: { url: null } };
    }

    try {
      const url = await transport.fetchProfilePhoto(conversation.remote_id);
      return { success: true, data: { url } };
    } catch {
      return { success: true, data: { url: null } };
    }
  });

  // ── Get messages ───────────────────────────────────────────────────────
  fastify.get('/api/conversations/:id/messages', async (request, reply) => {
    const conversation = getConversation(request.params.id);
    if (!conversation) {
      reply.code(404);
      return { success: false, error: 'Conversation not found' };
    }

    const limit = Math.min(parseInt(request.query.limit) || 50, 200);
    const offset = parseInt(request.query.offset) || 0;

    const messages = getMessages(conversation.id, limit, offset);
    const total = getMessageCount(conversation.id);

    return {
      success: true,
      data: {
        messages,
        pagination: { limit, offset, total },
      },
    };
  });

  // ── Operator sends a message ───────────────────────────────────────────
  fastify.post('/api/conversations/:id/messages', async (request, reply) => {
    const { content } = request.body || {};

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      reply.code(400);
      return { success: false, error: 'content is required and must be a non-empty string' };
    }

    try {
      const result = await orchestrator.handleOperatorMessage(
        request.params.id,
        content.trim(),
      );

      return {
        success: true,
        data: result,
      };
    } catch (err) {
      if (err.message?.includes('not found')) {
        reply.code(404);
        return { success: false, error: 'Conversation not found' };
      }
      throw err;
    }
  });

  // ── Delete message history (full or partial) ─────────────────────────
  fastify.delete('/api/conversations/:id/messages', async (request, reply) => {
    const conversation = getConversation(request.params.id);
    if (!conversation) {
      reply.code(404);
      return { success: false, error: 'Conversation not found' };
    }

    const { mode = 'all', keep_last } = request.body || {};

    if (!['all', 'partial'].includes(mode)) {
      reply.code(400);
      return { success: false, error: 'mode must be all or partial' };
    }

    if (mode === 'partial') {
      const keep = parseInt(keep_last, 10);
      if (!Number.isInteger(keep) || keep < 0) {
        reply.code(400);
        return { success: false, error: 'keep_last must be an integer >= 0 when mode=partial' };
      }
    }

    const deletedCount = mode === 'all'
      ? deleteAllMessages(conversation.id)
      : deleteMessagesKeepLatest(conversation.id, keep_last);

    const updatedConversation = refreshConversationActivityFromMessages(conversation.id);
    const remaining = getMessageCount(conversation.id);

    if (io) {
      io.emit('conversation:update', { conversation: updatedConversation });
      io.emit('conversation:history_cleared', {
        conversationId: conversation.id,
        mode,
        deletedCount,
        remaining,
      });
    }

    return {
      success: true,
      data: {
        conversation_id: conversation.id,
        mode,
        deleted_count: deletedCount,
        remaining_count: remaining,
      },
    };
  });
}
