import {
  listConversations,
  getConversation,
} from '../persistence/conversations.js';
import { getMessages, getMessageCount } from '../persistence/messages.js';

/**
 * Conversation API routes.
 *
 * GET  /api/conversations                — List all conversations
 * GET  /api/conversations/:id            — Get single conversation
 * GET  /api/conversations/:id/messages   — Get message history (paginated)
 * POST /api/conversations/:id/messages   — Operator sends a message
 */
export default async function conversationRoutes(fastify, opts) {
  const { orchestrator } = opts;

  // ── List conversations ─────────────────────────────────────────────────
  fastify.get('/api/conversations', async () => {
    const conversations = listConversations();
    return { success: true, data: conversations };
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
}
