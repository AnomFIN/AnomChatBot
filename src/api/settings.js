import { getConversation, updateConversationSettings } from '../persistence/conversations.js';
import { getAllSettings, setSettingsBulk } from '../persistence/settings.js';
import { VALID_TONES, VALID_FLIRTS, VALID_AI_APPROACH_MAX_MESSAGES, VALID_AI_APPROACH_DELAY_MINUTES, VALID_LOCAL_AI_MCP_MODES, VALID_WEB_SEARCH_PROVIDERS, redactSecret } from '../config/index.js';

const MAX_LOGO_DATA_BYTES = 3 * 1024 * 1024;
const MAX_BACKGROUND_DATA_BYTES = 5 * 1024 * 1024;
const LOGO_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const BACKGROUND_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

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
    if (redacted.local_ai_permission_token) {
      redacted.local_ai_permission_token = redactSecret(redacted.local_ai_permission_token);
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

    // Validate Local AI / LM Studio settings
    const localEnabled = body.local_ai_enabled === true || body.local_ai_enabled === 'true' || body.local_ai_enabled === '1';
    const tokenEnabled = body.local_ai_use_permission_token === true || body.local_ai_use_permission_token === 'true' || body.local_ai_use_permission_token === '1';
    const mcpMode = normalizeMcpMode(body.local_ai_mcp_mode, body.local_ai_mcp_enabled);

    if (body.local_ai_provider !== undefined && body.local_ai_provider !== '' && body.local_ai_provider !== 'lmstudio') {
      errors.push('local_ai_provider must be lmstudio');
    }
    if (localEnabled && body.local_ai_base_url !== undefined && !String(body.local_ai_base_url).trim()) {
      errors.push('Local AI Base URL is required when Local AI is enabled');
    }
    if (localEnabled && body.local_ai_model !== undefined && !String(body.local_ai_model).trim()) {
      errors.push('Local AI Model is required when Local AI is enabled');
    }
    if (localEnabled && tokenEnabled && body.local_ai_permission_token !== undefined && !String(body.local_ai_permission_token).trim()) {
      errors.push('LM Studio Permission Token is required when token usage is enabled');
    }
    if (body.default_web_search_provider !== undefined && !VALID_WEB_SEARCH_PROVIDERS.includes(String(body.default_web_search_provider).toLowerCase())) {
      errors.push(`Default Web Search Provider must be one of: ${VALID_WEB_SEARCH_PROVIDERS.join(', ')}`);
    }
    if (body.local_ai_mcp_mode !== undefined && !VALID_LOCAL_AI_MCP_MODES.includes(mcpMode)) {
      errors.push(`MCP Mode must be one of: ${VALID_LOCAL_AI_MCP_MODES.join(', ')}`);
    }
    if (localEnabled && mcpMode === 'local_config' && body.local_ai_mcp_config_path !== undefined && !String(body.local_ai_mcp_config_path).trim()) {
      errors.push('MCP config path is required when Local MCP Config mode is enabled');
    }
    if (localEnabled && mcpMode === 'ephemeral') {
      const integrationErrors = validateEphemeralMcpIntegrations(body.local_ai_mcp_integrations);
      errors.push(...integrationErrors);
    }

    validateBrandingDataUrl(body.branding_top_bar_logo, 'branding_top_bar_logo', LOGO_MIME_TYPES, MAX_LOGO_DATA_BYTES, errors);
    validateBrandingDataUrl(body.branding_chat_background, 'branding_chat_background', BACKGROUND_MIME_TYPES, MAX_BACKGROUND_DATA_BYTES, errors);

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
      'local_ai_enabled', 'local_ai_provider', 'local_ai_base_url', 'local_ai_model',
      'local_ai_use_permission_token', 'local_ai_permission_token',
      'local_ai_mcp_enabled', 'local_ai_mcp_mode', 'local_ai_mcp_config_path', 'local_ai_mcp_integrations',
      'default_web_search_provider', 'web_search_enabled',
      'branding_top_bar_logo', 'branding_chat_background',
    ];

    const updates = {};
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    // Prevent saving redacted API keys back to DB
    if (updates.ai_api_key && (updates.ai_api_key.includes('...') || updates.ai_api_key === '***')) {
      delete updates.ai_api_key;
    }
    if (updates.local_ai_permission_token && (updates.local_ai_permission_token.includes('...') || updates.local_ai_permission_token === '***')) {
      delete updates.local_ai_permission_token;
    }

    if (Object.keys(updates).length === 0) {
      return { success: true, data: { message: 'No changes' } };
    }

    if (updates.local_ai_mcp_mode !== undefined) {
      updates.local_ai_mcp_enabled = updates.local_ai_mcp_mode === 'disabled' ? 'false' : 'true';
    }
    if (updates.local_ai_mcp_integrations !== undefined && typeof updates.local_ai_mcp_integrations !== 'string') {
      updates.local_ai_mcp_integrations = JSON.stringify(updates.local_ai_mcp_integrations);
    }

    setSettingsBulk(updates);

    const allSettings = getAllSettings();
    if (allSettings.ai_api_key) {
      allSettings.ai_api_key = redactSecret(allSettings.ai_api_key);
    }
    if (allSettings.local_ai_permission_token) {
      allSettings.local_ai_permission_token = redactSecret(allSettings.local_ai_permission_token);
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
        ai_approach_enabled: conversation.ai_approach_enabled ?? 0,
        ai_approach_max_messages: conversation.ai_approach_max_messages ?? 3,
        ai_approach_delay_minutes: conversation.ai_approach_delay_minutes ?? 10,
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

    // Validate AI approach fields
    if (body.ai_approach_enabled !== undefined) {
      if (body.ai_approach_enabled !== 0 && body.ai_approach_enabled !== 1) {
        errors.push('ai_approach_enabled must be 0 or 1');
      }
    }

    if (body.ai_approach_max_messages !== undefined) {
      if (!VALID_AI_APPROACH_MAX_MESSAGES.includes(body.ai_approach_max_messages)) {
        errors.push(`ai_approach_max_messages must be one of: ${VALID_AI_APPROACH_MAX_MESSAGES.join(', ')}`);
      }
    }

    if (body.ai_approach_delay_minutes !== undefined) {
      if (!VALID_AI_APPROACH_DELAY_MINUTES.includes(body.ai_approach_delay_minutes)) {
        errors.push(`ai_approach_delay_minutes must be one of: ${VALID_AI_APPROACH_DELAY_MINUTES.join(', ')}`);
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
      'ai_history_mode', 'ai_approach_enabled', 'ai_approach_max_messages', 'ai_approach_delay_minutes',
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


function validateBrandingDataUrl(value, key, allowedMimeTypes, maxBytes, errors) {
  if (value === undefined || value === '') return;
  if (typeof value !== 'string') {
    errors.push(`${key} must be a string data URL`);
    return;
  }

  const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    errors.push(`${key} must be a base64 image data URL`);
    return;
  }

  const [, mimeType, payload] = match;
  if (!allowedMimeTypes.has(mimeType)) {
    errors.push(`${key} has unsupported image type`);
    return;
  }

  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  const byteLength = Math.floor((payload.length * 3) / 4) - padding;
  if (byteLength > maxBytes) {
    errors.push(`${key} must be ${Math.round(maxBytes / 1024 / 1024)}MB or smaller`);
  }
}


function normalizeMcpMode(mode, legacyEnabled) {
  const normalized = String(mode || '').trim().toLowerCase();
  if (normalized) return normalized;
  return legacyEnabled === true || legacyEnabled === 'true' || legacyEnabled === '1' ? 'local_config' : 'disabled';
}

function validateEphemeralMcpIntegrations(value) {
  const errors = [];
  const integrations = parseIntegrationArray(value, errors);
  if (errors.length > 0) return errors;
  if (integrations.length === 0) return ['At least one Ephemeral MCP integration is required'];

  const seen = new Set();
  integrations.forEach((integration, index) => {
    const prefix = `Integration ${index + 1}`;
    const serverLabel = String(integration?.server_label ?? integration?.serverLabel ?? '').trim();
    const serverUrl = String(integration?.server_url ?? integration?.serverUrl ?? '').trim();
    const allowedTools = Array.isArray(integration?.allowed_tools ?? integration?.allowedTools)
      ? (integration.allowed_tools ?? integration.allowedTools).map(tool => String(tool).trim()).filter(Boolean)
      : String(integration?.allowed_tools ?? integration?.allowedTools ?? '').split(',').map(tool => tool.trim()).filter(Boolean);
    const hasServerLabel = Boolean(serverLabel);
    const hasServerUrl = Boolean(serverUrl);
    const hasValidServerUrl = hasServerUrl && isValidHttpUrl(serverUrl);

    if (!hasServerLabel) errors.push(`${prefix}: server label is required`);
    if (!hasServerUrl) errors.push(`${prefix}: server URL is required`);
    else if (!hasValidServerUrl) errors.push(`${prefix}: server_url must be a valid http(s) URL`);
    if (allowedTools.length === 0) errors.push(`${prefix}: allowed_tools must not be empty`);

    if (hasServerLabel && hasValidServerUrl) {
      const key = `${serverLabel.toLowerCase()}|${serverUrl.toLowerCase()}`;
      if (seen.has(key)) errors.push(`${prefix}: duplicate integration for this server label and URL`);
      seen.add(key);
    }
  });

  return errors;
}

function parseIntegrationArray(value, errors) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  if (typeof value !== 'string') {
    errors.push('local_ai_mcp_integrations must be a JSON array');
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      errors.push('local_ai_mcp_integrations must be a JSON array');
      return [];
    }
    return parsed;
  } catch {
    errors.push('local_ai_mcp_integrations must be valid JSON');
    return [];
  }
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
