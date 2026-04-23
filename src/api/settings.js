import { getConversation, updateConversationSettings } from '../persistence/conversations.js';
import { getAllSettings, setSettingsBulk } from '../persistence/settings.js';
import { VALID_TONES, VALID_FLIRTS, redactSecret } from '../config/index.js';

/**
 * Settings API routes.
 *
 * GET  /api/conversations/:id/settings  — Get conversation settings
 * PUT  /api/conversations/:id/settings  — Update conversation settings
 * GET  /api/settings                    — Get global settings
 * PUT  /api/settings                    — Update global settings
 */
export default async function settingsRoutes(fastify, opts) {
  const { io } = opts;

  // ── Get global settings ────────────────────────────────────────────────
  fastify.get('/api/settings', async () => {
    const settings = getAllSettings();
    // Redact any secret values
    const redacted = { ...settings };
    if (redacted.ai_api_key) {
      redacted.ai_api_key = redactSecret(redacted.ai_api_key);
    }
    return { success: true, data: redacted };
  });

  // ── Update global settings ─────────────────────────────────────────────
  fastify.put('/api/settings', async (request, reply) => {
    const body = request.body || {};
    const errors = [];

    // Validate delay settings
    if (body.reply_delay_min !== undefined) {
      const val = parseInt(body.reply_delay_min, 10);
      if (isNaN(val) || val < 3000) {
        errors.push('reply_delay_min must be >= 3000 ms');
      }
    }
    if (body.reply_delay_max !== undefined) {
      const val = parseInt(body.reply_delay_max, 10);
      if (isNaN(val) || val < 3000) {
        errors.push('reply_delay_max must be >= 3000 ms');
      }
    }

    // Validate presence settings
    if (body.presence_typing_speed !== undefined) {
      const val = parseInt(body.presence_typing_speed, 10);
      if (isNaN(val) || val < 1) {
        errors.push('presence_typing_speed must be a positive integer (chars/sec)');
      }
    }

    if (errors.length > 0) {
      reply.code(400);
      return { success: false, error: errors.join('; ') };
    }

    // Allowed global setting keys
    const allowedKeys = [
      'reply_delay_min', 'reply_delay_max',
      'presence_enabled', 'presence_read_delay', 'presence_typing_speed',
      'presence_min_typing', 'presence_max_typing', 'presence_idle_after_send',
      'ai_provider', 'ai_base_url', 'ai_model', 'ai_api_key',
    ];

    const updates = {};
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    // Prevent saving redacted API keys back to DB
    if (updates.ai_api_key && updates.ai_api_key.includes('...')) {
      delete updates.ai_api_key;
    }

    if (Object.keys(updates).length === 0) {
      return { success: true, data: { message: 'No changes' } };
    }

    setSettingsBulk(updates);

    const allSettings = getAllSettings();
    if (allSettings.ai_api_key) {
      allSettings.ai_api_key = redactSecret(allSettings.ai_api_key);
    }

    return { success: true, data: allSettings };
  });

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
        preset_id: conversation.preset_id,
        ai_provider: conversation.ai_provider,
        ai_base_url: conversation.ai_base_url,
        ai_model: conversation.ai_model,
        reply_delay_min: conversation.reply_delay_min,
        reply_delay_max: conversation.reply_delay_max,
        first_message_sent_manually: conversation.first_message_sent_manually,
        use_global_ai: conversation.use_global_ai ?? 1,
        use_global_delay: conversation.use_global_delay ?? 1,
        ai_history_mode: conversation.ai_history_mode || 'partial',
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

    if (body.use_global_ai !== undefined) {
      if (body.use_global_ai !== 0 && body.use_global_ai !== 1) {
        errors.push('use_global_ai must be 0 or 1');
      }
    }

    if (body.use_global_delay !== undefined) {
      if (body.use_global_delay !== 0 && body.use_global_delay !== 1) {
        errors.push('use_global_delay must be 0 or 1');
      }
    }

    if (body.system_prompt !== undefined) {
      if (typeof body.system_prompt !== 'string') {
        errors.push('system_prompt must be a string');
      }
    }

    if (body.ai_history_mode !== undefined) {
      if (!['partial', 'full'].includes(body.ai_history_mode)) {
        errors.push('ai_history_mode must be partial or full');
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
      'preset_id', 'ai_provider', 'ai_base_url', 'ai_model',
      'reply_delay_min', 'reply_delay_max', 'use_global_ai', 'use_global_delay',
      'ai_history_mode',
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
