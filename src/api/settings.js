import { getConversation, updateConversationSettings } from '../persistence/conversations.js';
import { VALID_TONES, VALID_FLIRTS } from '../config/index.js';

/**
 * Conversation settings API routes.
 *
 * GET /api/conversations/:id/settings  — Get conversation settings
 * PUT /api/conversations/:id/settings  — Update conversation settings
 */
export default async function settingsRoutes(fastify, opts) {
  const { io } = opts;

  // ── Get settings ───────────────────────────────────────────────────────
  fastify.get('/api/conversations/:id/settings', async (request, reply) => {
    const conversation = getConversation(request.params.id);
    if (!conversation) {
      reply.code(404);
      return { success: false, error: 'Conversation not found' };
    }

    return {
      success: true,
      data: {
        system_prompt: conversation.system_prompt,
        tone: conversation.tone,
        flirt: conversation.flirt,
        temperature: conversation.temperature,
        max_tokens: conversation.max_tokens,
        max_history: conversation.max_history,
        auto_reply: conversation.auto_reply,
        display_name: conversation.display_name,
      },
    };
  });

  // ── Update settings ────────────────────────────────────────────────────
  fastify.put('/api/conversations/:id/settings', async (request, reply) => {
    const conversation = getConversation(request.params.id);
    if (!conversation) {
      reply.code(404);
      return { success: false, error: 'Conversation not found' };
    }

    const body = request.body || {};
    const errors = [];

    // Validate enum fields if provided
    if (body.tone !== undefined) {
      if (!VALID_TONES.includes(body.tone)) {
        errors.push(`tone must be one of: ${VALID_TONES.join(', ')}`);
      }
    }

    if (body.flirt !== undefined) {
      if (!VALID_FLIRTS.includes(body.flirt)) {
        errors.push(`flirt must be one of: ${VALID_FLIRTS.join(', ')}`);
      }
    }

    if (body.temperature !== undefined) {
      if (typeof body.temperature !== 'number' || body.temperature < 0 || body.temperature > 2) {
        errors.push('temperature must be a number between 0 and 2');
      }
    }

    if (body.max_tokens !== undefined) {
      if (!Number.isInteger(body.max_tokens) || body.max_tokens < 1) {
        errors.push('max_tokens must be a positive integer');
      }
    }

    if (body.max_history !== undefined) {
      if (!Number.isInteger(body.max_history) || body.max_history < 1) {
        errors.push('max_history must be a positive integer');
      }
    }

    if (body.auto_reply !== undefined) {
      if (body.auto_reply !== 0 && body.auto_reply !== 1) {
        errors.push('auto_reply must be 0 or 1');
      }
    }

    if (body.system_prompt !== undefined) {
      if (typeof body.system_prompt !== 'string') {
        errors.push('system_prompt must be a string');
      }
    }

    if (body.display_name !== undefined) {
      if (typeof body.display_name !== 'string') {
        errors.push('display_name must be a string');
      }
    }

    if (errors.length > 0) {
      reply.code(400);
      return { success: false, error: errors.join('; ') };
    }

    // Build update object from allowed fields only
    const allowedKeys = [
      'system_prompt', 'tone', 'flirt', 'temperature',
      'max_tokens', 'max_history', 'auto_reply', 'display_name',
    ];
    const updates = {};
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return { success: true, data: { message: 'No changes' } };
    }

    const updated = updateConversationSettings(request.params.id, updates);

    if (io) {
      io.emit('conversation:update', { conversation: updated });
    }

    return { success: true, data: updated };
  });
}
