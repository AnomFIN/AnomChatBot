// Security-first. Creator-ready. Future-proof.
import OpenAI from 'openai';
import { buildMcpRoutingInstruction, selectEphemeralMcpIntegrations } from '../core/mcpIntegrations.js';

const LOCAL_PROVIDER = 'lmstudio';
const MCP_MODE_DISABLED = 'disabled';
const MCP_MODE_LOCAL_CONFIG = 'local_config';
const MCP_MODE_EPHEMERAL = 'ephemeral';
const LOCAL_AI_QUALITY_INSTRUCTION = 'Vastaa selkeällä, luonnollisella suomen kielellä. Älä keksi tietoja. Jos et tiedä, sano ettet tiedä. Älä toista samoja lauseita. Älä käytä rikkinäisiä ilmauksia. Älä täytä vastausta turhalla jaarittelulla. Jos lähdettä ei ole, sano se suoraan.';
const MCP_MAX_OUTPUT_TOKENS = 300;
const LOCAL_AI_DEFAULT_MAX_TOKENS = 300;
const LOCAL_AI_DEFAULT_TEMPERATURE = 0.35;

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
      const isEphemeralMcp = mcpMode === MCP_MODE_EPHEMERAL;
      const selectedIntegrations = isEphemeralMcp ? selectEphemeralMcpIntegrations(integrations, messages) : [];
      const usesLmStudioApi = isEphemeralMcp && selectedIntegrations.length > 0;
      const endpoint = usesLmStudioApi ? buildLmStudioApiChatUrl(baseUrl) : `${baseUrl}/chat/completions`;
      const requestBody = usesLmStudioApi
        ? buildLmStudioApiChatBody({
          model: options.model || model,
          messages,
          integrations: selectedIntegrations,
          maxTokens: Math.min(options.max_tokens ?? MCP_MAX_OUTPUT_TOKENS, MCP_MAX_OUTPUT_TOKENS),
        })
        : buildLocalAIChatCompletionsBody({
          model: options.model || model,
          messages: addLocalAIQualityInstruction(messages),
          temperature: options.temperature ?? LOCAL_AI_DEFAULT_TEMPERATURE,
          maxTokens: Math.min(options.max_tokens ?? LOCAL_AI_DEFAULT_MAX_TOKENS, LOCAL_AI_DEFAULT_MAX_TOKENS),
        });

      logLocalAIDebug(logger, {
        endpoint,
        usesLmStudioApi,
        mcpMode,
        integrationsCount: usesLmStudioApi ? selectedIntegrations.length : 0,
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
      return usesLmStudioApi ? normalizeLmStudioApiChatResponse(payload) : normalizeCompletion(payload);
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
  const seen = new Set();
  const normalized = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const serverLabel = String(item.server_label ?? item.serverLabel ?? '').trim();
    const serverUrl = String(item.server_url ?? item.serverUrl ?? '').trim();
    const allowedToolsRaw = item.allowed_tools ?? item.allowedTools ?? [];
    const allowedTools = Array.isArray(allowedToolsRaw)
      ? allowedToolsRaw.map(tool => String(tool).trim()).filter(Boolean)
      : String(allowedToolsRaw).split(',').map(tool => tool.trim()).filter(Boolean);

    if (!serverLabel || !serverUrl || allowedTools.length === 0 || !isValidUrl(serverUrl)) continue;
    const dedupedTools = [...new Set(allowedTools)];
    const key = `${serverLabel.toLowerCase()}|${serverUrl.toLowerCase()}|${dedupedTools.map(t => t.toLowerCase()).sort().join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      type: 'ephemeral_mcp',
      server_label: serverLabel,
      server_url: serverUrl,
      allowed_tools: dedupedTools,
    });
  }

  return normalized;
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

export function buildLmStudioApiChatUrl(baseUrl) {
  try {
    return `${new URL(normalizeBaseUrl(baseUrl)).origin}/api/v1/chat`;
  } catch {
    return `${normalizeBaseUrl(baseUrl).replace(/\/v1$/i, '')}/api/v1/chat`;
  }
}

export function buildLmStudioApiChatBody({ model, messages, integrations, maxTokens = MCP_MAX_OUTPUT_TOKENS }) {
  const normalizedIntegrations = normalizeEphemeralMcpIntegrations(integrations);
  return {
    model,
    input: serializeMessagesForLmStudioInput(messages, {
      maxChars: 6000,
      extraInstruction: buildMcpRoutingInstruction(normalizedIntegrations, messages),
    }),
    integrations: normalizedIntegrations,
    max_tokens: Math.min(maxTokens, MCP_MAX_OUTPUT_TOKENS),
  };
}

export function serializeMessagesForLmStudioInput(messages, options = {}) {
  if (!Array.isArray(messages) || messages.length === 0) return options.extraInstruction || '';

  const maxChars = Number.isInteger(options.maxChars) ? options.maxChars : Infinity;
  const systemParts = [];
  const conversationParts = [];

  for (const message of messages) {
    const role = typeof message?.role === 'string' ? message.role.toLowerCase() : 'user';
    const content = serializeMessageContent(message?.content);
    if (!content) continue;

    if (role === 'system') {
      systemParts.push(stripRawToolJson(content));
      continue;
    }

    if (role === 'tool') continue;
    const cleanContent = stripRawToolJson(content);
    if (!cleanContent) continue;
    conversationParts.push(`${formatConversationRole(role)}: ${cleanContent}`);
  }

  if (options.extraInstruction) systemParts.unshift(options.extraInstruction);
  const sections = [];
  if (systemParts.length > 0) sections.push(`System:\n${systemParts.join('\n')}`);
  if (conversationParts.length > 0) sections.push(`Conversation:\n${conversationParts.join('\n')}`);
  const serialized = sections.join('\n\n');
  return serialized.length > maxChars ? serialized.slice(-maxChars).trimStart() : serialized;
}

function addLocalAIQualityInstruction(messages) {
  if (!Array.isArray(messages)) return [{ role: 'system', content: LOCAL_AI_QUALITY_INSTRUCTION }];
  return [{ role: 'system', content: LOCAL_AI_QUALITY_INSTRUCTION }, ...messages];
}

function stripRawToolJson(content) {
  const normalized = normalizeLmStudioMessageContent(content, { toolFallback: '' });
  return normalized === EMPTY_RESPONSE_FALLBACK ? '' : normalized;
}

function serializeMessageContent(content) {
  if (Array.isArray(content)) {
    return stripMultimodalContent([{ role: 'user', content }])[0].content.trim();
  }
  return String(content ?? '').trim();
}

function formatConversationRole(role) {
  if (role === 'assistant') return 'Assistant';
  if (role === 'user') return 'User';
  if (role === 'tool') return 'Tool';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

const EMPTY_RESPONSE_FALLBACK = 'En saanut muodostettua kunnollista vastausta. Kokeillaan uudelleen tarkemmalla kysymyksellä.';
const TOOL_ONLY_RESPONSE_FALLBACK = 'Haku ei tuottanut suoraa vastausta. Kokeile tarkentaa hakua.';

export function normalizeLmStudioApiChatResponse(response) {
  const content = normalizeLmStudioMessageContent(response);
  const usage = response?.usage ?? {};
  return {
    content,
    tokenUsage: {
      prompt: usage.prompt_tokens ?? usage.input_tokens ?? 0,
      completion: usage.completion_tokens ?? usage.output_tokens ?? 0,
      total: usage.total_tokens ?? 0,
    },
  };
}

export function normalizeLmStudioMessageContent(response, { toolFallback = TOOL_ONLY_RESPONSE_FALLBACK } = {}) {
  const direct = extractDirectMessageContent(response);
  if (direct) return direct;

  const output = response?.output ?? response;
  const fromOutput = extractOutputContent(output, toolFallback);
  if (fromOutput) return fromOutput;

  if (typeof response === 'string') {
    const parsed = parseJsonSafely(response);
    if (parsed !== null) return normalizeLmStudioMessageContent(parsed, { toolFallback });
    return response.trim() || EMPTY_RESPONSE_FALLBACK;
  }

  return EMPTY_RESPONSE_FALLBACK;
}

function extractDirectMessageContent(response) {
  const candidates = [
    response?.output_text,
    response?.message?.content,
    response?.choices?.[0]?.message?.content,
    response?.response,
  ];
  for (const candidate of candidates) {
    const content = normalizeContentCandidate(candidate);
    if (content) return content;
  }
  return '';
}

function extractOutputContent(output, toolFallback) {
  if (Array.isArray(output)) {
    const messages = output
      .filter(item => item?.type === 'message')
      .map(item => normalizeContentCandidate(item.content))
      .filter(Boolean);
    if (messages.length > 0) return messages.join('\n').trim();
    const hadToolCalls = output.some(item => item?.type === 'tool_call' || item?.type === 'invalid_tool_call');
    return hadToolCalls ? toolFallback : '';
  }
  return normalizeContentCandidate(output);
}

function normalizeContentCandidate(candidate) {
  if (candidate === undefined || candidate === null) return '';
  if (Array.isArray(candidate)) return extractOutputContent(candidate, '');
  if (typeof candidate === 'object' && candidate !== null) {
    if (candidate.type === 'message') return normalizeContentCandidate(candidate.content);
    if (candidate.message?.content !== undefined) return normalizeContentCandidate(candidate.message.content);
    if (candidate.content !== undefined && candidate.type !== 'tool_call' && candidate.type !== 'invalid_tool_call') return normalizeContentCandidate(candidate.content);
    return '';
  }
  const text = String(candidate).trim();
  if (!text) return '';
  const parsed = parseJsonSafely(text);
  if (parsed !== null) {
    const parsedContent = normalizeLmStudioMessageContent(parsed, { toolFallback: '' });
    return parsedContent === EMPTY_RESPONSE_FALLBACK ? '' : parsedContent;
  }
  return looksLikeRawToolJson(text) ? '' : text;
}

function parseJsonSafely(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || !['[', '{'].includes(trimmed[0])) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function looksLikeRawToolJson(value) {
  return /^\[?\{\s*"type"\s*:\s*"(?:tool_call|invalid_tool_call|message)"/.test(value.trim());
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
