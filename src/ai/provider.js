// Security-first. Creator-ready. Future-proof.
import OpenAI from 'openai';

const LOCAL_PROVIDER = 'lmstudio';

/**
 * Create an AI provider backed by OpenAI cloud or Local AI / LM Studio.
 * Why this design: OpenAI keeps the SDK path; Local AI uses fetch so LM Studio
 * permission tokens never leak into OPENAI_API_KEY or cloud requests.
 */
export function createAIProvider(config) {
  const localAi = config.ai?.localAi ?? config.localAi ?? {};
  if (localAi.enabled) {
    return createLocalAIProvider(localAi);
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

function createLocalAIProvider(localAi) {
  const provider = localAi.provider || LOCAL_PROVIDER;
  const baseUrl = normalizeBaseUrl(localAi.baseUrl || '');
  const model = localAi.model || '';
  const usePermissionToken = Boolean(localAi.usePermissionToken);
  const permissionToken = localAi.permissionToken || '';

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
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: options.signal,
        headers: buildLocalAIHeaders({ usePermissionToken, permissionToken }),
        body: JSON.stringify({
          model: options.model || model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 1000,
        }),
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
        enabled: Boolean(localAi.mcpEnabled),
        configPath: localAi.mcpConfigPath || '.mcp.json',
        status: localAi.mcpEnabled ? 'configured_without_tool_loop' : 'disabled',
      },
      lastError: lastError?.message ?? null,
    };
  }

  return { generateReply, testConnection, getStatus };
}

export function buildLocalAIHeaders({ usePermissionToken, permissionToken }) {
  const headers = { 'Content-Type': 'application/json' };
  if (usePermissionToken && permissionToken) {
    headers.Authorization = `Bearer ${permissionToken}`;
  }
  return headers;
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
