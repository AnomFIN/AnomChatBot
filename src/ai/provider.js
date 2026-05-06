// Security-first. Creator-ready. Future-proof.
import OpenAI from 'openai';

const LOCAL_PROVIDER = 'lmstudio';
const MCP_MODE_DISABLED = 'disabled';
const MCP_MODE_LOCAL_CONFIG = 'local_config';
const MCP_MODE_EPHEMERAL = 'ephemeral';

/**
 * Create an AI provider backed by OpenAI cloud or Local AI / LM Studio.
 * Why this design: OpenAI keeps the SDK path; Local AI uses fetch so LM Studio
 * permission tokens never leak into OPENAI_API_KEY or cloud requests.
 */
export function createAIProvider(config) {
  const localAi = config.ai?.localAi ?? config.localAi ?? {};
  if (localAi.enabled) {
    return createLocalAIProvider(localAi, config.logger);
  }
  return createOpenAIProvider(config.ai);
}

function createOpenAIProvider(aiConfig) {
  const { provider, openaiApiKey, openaiBaseUrl, openaiModel } = aiConfig;

  const clientOpts = {
    apiKey: openaiApiKey || 'not-set',
    timeout: 30_000,
  };

  if (openaiBaseUrl) {
    clientOpts.baseURL = openaiBaseUrl;
  }

  const client = new OpenAI(clientOpts);

  let connected = false;
  let lastError = null;

  async function generateReply(messages, options = {}) {
    const model = options.model || openaiModel;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.max_tokens ?? 1000;
    const signal = options.signal;
    const hasMultimodal = messages.some(m => Array.isArray(m.content));

    let lastErr = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      throwIfAborted(signal);
      try {
        const timeout = hasMultimodal ? 60000 : 30000;
        const response = await client.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }, { timeout, signal });

        connected = true;
        lastError = null;
        return normalizeCompletion(response);
      } catch (err) {
        lastErr = err;
        if (isAbortError(err)) throw err;

        if (hasMultimodal && attempt === 0 && !isRateLimitError(err)) {
          const textOnlyMessages = stripMultimodalContent(messages);
          try {
            const fallbackResponse = await client.chat.completions.create({
              model,
              messages: textOnlyMessages,
              temperature,
              max_tokens: maxTokens,
            }, { signal });

            connected = true;
            lastError = null;
            return normalizeCompletion(fallbackResponse);
          } catch (fallbackErr) {
            lastErr = fallbackErr;
            if (isAbortError(fallbackErr)) throw fallbackErr;
          }
        }

        if (isRateLimitError(err) && attempt < 2) {
          const delay = Math.pow(2, attempt + 1) * 1000;
          await abortableSleep(delay, signal);
          continue;
        }

        connected = false;
        lastError = classifyOpenAIError(err);
        throw lastError;
      }
    }

    connected = false;
    lastError = classifyOpenAIError(lastErr);
    throw lastError;
  }

  async function testConnection() {
    try {
      const response = await client.chat.completions.create({
        model: openaiModel,
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 5,
      });

      connected = true;
      lastError = null;
      return { success: true, model: response.model || openaiModel };
    } catch (err) {
      connected = false;
      lastError = classifyOpenAIError(err);
      return { success: false, model: openaiModel, error: lastError.message };
    }
  }

  function getStatus() {
    return {
      connected,
      model: openaiModel,
      provider,
      lastError: lastError?.message ?? null,
    };
  }

  return { generateReply, testConnection, getStatus };
}

function createLocalAIProvider(localAi, logger = null) {
  const provider = localAi.provider || LOCAL_PROVIDER;
  const baseUrl = normalizeBaseUrl(localAi.baseUrl || '');
  const model = localAi.model || '';
  const usePermissionToken = parseBooleanFlag(localAi.usePermissionToken);
  const permissionToken = localAi.permissionToken || '';
  const mcpMode = normalizeMcpMode(localAi.mcpMode, localAi.mcpEnabled);
  const integrations = normalizeEphemeralMcpIntegrations(localAi.mcpIntegrations);

  let connected = false;
  let lastError = null;

  function validateLocalConfig() {
    if (provider !== LOCAL_PROVIDER) throw createAIError('config_error', `Unsupported Local AI provider: ${provider}`);
    if (!baseUrl) throw createAIError('config_error', 'Local AI Base URL is required');
    if (!model) throw createAIError('config_error', 'Local AI Model is required');
    if (usePermissionToken && !permissionToken) {
      throw createAIError('auth_error', 'LM Studio Permission Token is enabled but token is missing', 401);
    }
  }

  async function generateReply(messages, options = {}) {
    try {
      validateLocalConfig();
      const hasEphemeralIntegrations = mcpMode === MCP_MODE_EPHEMERAL && integrations.length > 0;
      const endpoint = `${baseUrl}/chat/completions`;
      const requestBody = buildLocalAIChatCompletionsBody({
        model: options.model || model,
        messages,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.max_tokens ?? 1000,
        integrations: hasEphemeralIntegrations ? integrations : [],
      });

      logLocalAIDebug(logger, {
        endpoint,
        integrationsCount: hasEphemeralIntegrations ? integrations.length : 0,
        mcpEnabled: mcpMode !== MCP_MODE_DISABLED,
        mcpMode,
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        signal: options.signal,
        headers: buildLocalAIHeaders({ usePermissionToken, permissionToken }),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw await createLocalHttpError(response);
      }

      const payload = await response.json();
      connected = true;
      lastError = null;
      return normalizeCompletion(payload);
    } catch (err) {
      if (isAbortError(err)) throw err;
      connected = false;
      lastError = classifyLocalAIError(err);
      throw lastError;
    }
  }

  async function testConnection() {
    try {
      const response = await generateReply([{ role: 'user', content: 'Say OK' }], { max_tokens: 5 });
      return { success: true, model, content: response.content };
    } catch (err) {
      return { success: false, model, error: err.message };
    }
  }

  function getStatus() {
    return {
      connected,
      model,
      provider: `local:${provider}`,
      localAi: true,
      mcp: {
        mode: mcpMode,
        enabled: mcpMode !== MCP_MODE_DISABLED,
        configPath: localAi.mcpConfigPath || '.mcp.json',
        integrations: integrations.map(({ server_label, server_url, allowed_tools }) => ({ server_label, server_url, allowed_tools })),
        status: getMcpStatus(mcpMode, integrations),
      },
      lastError: lastError?.message ?? null,
    };
  }

  return { generateReply, testConnection, getStatus };
}


export function normalizeMcpMode(value, legacyEnabled = false) {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === MCP_MODE_EPHEMERAL || mode === 'ephemeral_mcp') return MCP_MODE_EPHEMERAL;
  if (mode === MCP_MODE_LOCAL_CONFIG || mode === 'local' || mode === 'config') return MCP_MODE_LOCAL_CONFIG;
  if (mode === MCP_MODE_DISABLED) return MCP_MODE_DISABLED;
  return parseBooleanFlag(legacyEnabled) ? MCP_MODE_LOCAL_CONFIG : MCP_MODE_DISABLED;
}

export function normalizeEphemeralMcpIntegrations(value) {
  const raw = typeof value === 'string' ? parseJsonArray(value) : value;
  if (!Array.isArray(raw)) return [];

  // Use a Map keyed by label|url to dedupe by server identity and merge tool lists.
  const mergedMap = new Map();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const serverLabel = String(item.server_label ?? item.serverLabel ?? '').trim();
    const serverUrl = String(item.server_url ?? item.serverUrl ?? '').trim();
    const allowedToolsRaw = item.allowed_tools ?? item.allowedTools ?? [];
    const allowedTools = Array.isArray(allowedToolsRaw)
      ? allowedToolsRaw.map(tool => String(tool).trim()).filter(Boolean)
      : String(allowedToolsRaw).split(',').map(tool => tool.trim()).filter(Boolean);

    if (!serverLabel || !serverUrl || allowedTools.length === 0 || !isValidUrl(serverUrl)) continue;
    const key = `${serverLabel.toLowerCase()}|${serverUrl.toLowerCase()}`;
    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key);
      const mergedTools = [...new Set([...existing.allowed_tools, ...allowedTools])];
      mergedMap.set(key, { ...existing, allowed_tools: mergedTools });
    } else {
      mergedMap.set(key, {
        type: 'ephemeral_mcp',
        server_label: serverLabel,
        server_url: serverUrl,
        allowed_tools: [...new Set(allowedTools)],
      });
    }
  }

  return [...mergedMap.values()];
}

export function buildLocalAIChatCompletionsBody({ model, messages, temperature, maxTokens, integrations = [] }) {
  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  const normalizedIntegrations = normalizeEphemeralMcpIntegrations(integrations);
  if (normalizedIntegrations.length > 0) {
    body.integrations = normalizedIntegrations;
  }

  return body;
}

function logLocalAIDebug(logger, details) {
  if (!logger || typeof logger.debug !== 'function') return;
  logger.debug({ localAi: details }, 'Local AI request prepared');
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getMcpStatus(mode, integrations) {
  if (mode === MCP_MODE_EPHEMERAL) return integrations.length > 0 ? 'ephemeral_integrations_enabled' : 'ephemeral_empty_fallback';
  if (mode === MCP_MODE_LOCAL_CONFIG) return 'configuration_only_tool_loop_not_implemented';
  return 'disabled';
}

export function buildLocalAIHeaders({ usePermissionToken, permissionToken }) {
  const headers = { 'Content-Type': 'application/json' };
  if (usePermissionToken && permissionToken) {
    headers.Authorization = `Bearer ${permissionToken}`;
  }
  return headers;
}

function parseBooleanFlag(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function normalizeCompletion(response) {
  const choice = response.choices?.[0];
  const content = choice?.message?.content ?? '';
  const usage = response.usage ?? {};

  return {
    content,
    tokenUsage: {
      prompt: usage.prompt_tokens ?? 0,
      completion: usage.completion_tokens ?? 0,
      total: usage.total_tokens ?? 0,
    },
  };
}

async function createLocalHttpError(response) {
  let detail = '';
  try {
    const payload = await response.json();
    detail = payload.error?.message || payload.message || '';
  } catch {
    detail = await response.text().catch(() => '');
  }

  const msg = detail ? `LM Studio ${response.status}: ${detail}` : `LM Studio ${response.status}`;
  return createAIError(response.status === 401 || response.status === 403 ? 'auth_error' : 'provider_error', msg, response.status);
}

function classifyOpenAIError(err) {
  const status = err.status ?? err.statusCode ?? null;
  const message = err.message ?? String(err);

  if (status === 401 || status === 403) return createAIError('auth_error', 'Authentication failed — check OPENAI_API_KEY', status);
  if (status === 429) return createAIError('rate_limit', 'Rate limit exceeded', status);
  if (status >= 500) return createAIError('provider_error', `Provider error: ${message}`, status);
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') return createAIError('network', `Network error: ${err.code}`, status);
  if (err.name === 'AbortError' || message.includes('timeout')) return createAIError('timeout', 'Request timed out', status);
  return createAIError('provider_error', message, status);
}

function classifyLocalAIError(err) {
  if (err.type) return err;
  const message = err.message ?? String(err);
  if (err.name === 'AbortError') return createAIError('aborted', 'Generation cancelled');
  if (message.includes('fetch failed') || err.code === 'ECONNREFUSED') {
    return createAIError('network', 'LM Studio appears to be offline or unreachable');
  }
  return createAIError('provider_error', message);
}

function createAIError(type, message, status = null) {
  const error = new Error(message);
  error.type = type;
  error.status = status;
  return error;
}

function isRateLimitError(err) {
  return (err.status ?? err.statusCode) === 429;
}

function isAbortError(err) {
  return err?.name === 'AbortError' || err?.type === 'aborted';
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw createAIError('aborted', 'Generation cancelled');
  }
}

function abortableSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(createAIError('aborted', 'Generation cancelled'));
      }, { once: true });
    }
  });
}

function stripMultimodalContent(messages) {
  return messages.map(msg => {
    if (!Array.isArray(msg.content)) return msg;

    const textParts = [];
    for (const part of msg.content) {
      if (part.type === 'text') {
        textParts.push(part.text);
      } else if (part.type === 'image_url') {
        textParts.push('[Image sent — this model does not support vision]');
      }
    }

    return { ...msg, content: textParts.join('\n') };
  });
}
