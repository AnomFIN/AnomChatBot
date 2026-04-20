import { listPresets, getPreset, createPreset, updatePreset, deletePreset } from '../persistence/presets.js';
import { VALID_TONES, VALID_FLIRTS } from '../config/index.js';

/**
 * Presets API routes.
 *
 * GET    /api/presets       — List all presets
 * POST   /api/presets       — Create a preset
 * GET    /api/presets/:id   — Get a preset
 * PUT    /api/presets/:id   — Update a preset
 * DELETE /api/presets/:id   — Delete a preset
 */
export default async function presetRoutes(fastify) {

  // ── List presets ───────────────────────────────────────────────────────
  fastify.get('/api/presets', async () => {
    const presets = listPresets();
    return { success: true, data: presets };
  });

  // ── Get preset ─────────────────────────────────────────────────────────
  fastify.get('/api/presets/:id', async (request, reply) => {
    const preset = getPreset(request.params.id);
    if (!preset) {
      reply.code(404);
      return { success: false, error: 'Preset not found' };
    }
    return { success: true, data: preset };
  });

  // ── Create preset ──────────────────────────────────────────────────────
  fastify.post('/api/presets', async (request, reply) => {
    const body = request.body || {};
    const errors = [];

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      errors.push('name is required');
    }
    if (body.tone !== undefined && !VALID_TONES.includes(body.tone)) {
      errors.push(`tone must be one of: ${VALID_TONES.join(', ')}`);
    }
    if (body.flirt !== undefined && !VALID_FLIRTS.includes(body.flirt)) {
      errors.push(`flirt must be one of: ${VALID_FLIRTS.join(', ')}`);
    }
    if (body.temperature !== undefined && (typeof body.temperature !== 'number' || body.temperature < 0 || body.temperature > 2)) {
      errors.push('temperature must be 0-2');
    }
    if (body.reply_delay_min !== undefined) {
      const val = parseInt(body.reply_delay_min, 10);
      if (isNaN(val) || val < 3000) errors.push('reply_delay_min must be >= 3000');
    }
    if (body.reply_delay_max !== undefined) {
      const val = parseInt(body.reply_delay_max, 10);
      if (isNaN(val) || val < 3000) errors.push('reply_delay_max must be >= 3000');
    }

    if (errors.length > 0) {
      reply.code(400);
      return { success: false, error: errors.join('; ') };
    }

    try {
      const preset = createPreset({
        name: body.name.trim(),
        system_prompt: body.system_prompt ?? '',
        tone: body.tone ?? 'friendly',
        flirt: body.flirt ?? 'none',
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens ?? 1000,
        reply_delay_min: body.reply_delay_min ?? null,
        reply_delay_max: body.reply_delay_max ?? null,
        is_default: body.is_default ? 1 : 0,
      });
      return { success: true, data: preset };
    } catch (err) {
      if (err.message?.includes('UNIQUE constraint')) {
        reply.code(409);
        return { success: false, error: 'A preset with that name already exists' };
      }
      throw err;
    }
  });

  // ── Update preset ──────────────────────────────────────────────────────
  fastify.put('/api/presets/:id', async (request, reply) => {
    const body = request.body || {};
    const errors = [];

    if (body.tone !== undefined && !VALID_TONES.includes(body.tone)) {
      errors.push(`tone must be one of: ${VALID_TONES.join(', ')}`);
    }
    if (body.flirt !== undefined && !VALID_FLIRTS.includes(body.flirt)) {
      errors.push(`flirt must be one of: ${VALID_FLIRTS.join(', ')}`);
    }
    if (body.temperature !== undefined && (typeof body.temperature !== 'number' || body.temperature < 0 || body.temperature > 2)) {
      errors.push('temperature must be 0-2');
    }

    if (errors.length > 0) {
      reply.code(400);
      return { success: false, error: errors.join('; ') };
    }

    const updated = updatePreset(request.params.id, body);
    if (!updated) {
      reply.code(404);
      return { success: false, error: 'Preset not found' };
    }

    return { success: true, data: updated };
  });

  // ── Delete preset ──────────────────────────────────────────────────────
  fastify.delete('/api/presets/:id', async (request, reply) => {
    const deleted = deletePreset(request.params.id);
    if (!deleted) {
      reply.code(404);
      return { success: false, error: 'Preset not found' };
    }
    return { success: true };
  });
}
