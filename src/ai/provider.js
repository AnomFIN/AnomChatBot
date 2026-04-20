import OpenAI from 'openai';

/**
 * Create an AI provider backed by the OpenAI SDK.
 * Supports both 'openai' and 'openai_compatible' (via baseURL override).
 *
 * Returns an object with: generateReply, testConnection, getStatus.
 */
export function createAIProvider(config) {
  const { provider, openaiApiKey, openaiBaseUrl, openaiModel } = config.ai;

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

  /**
   * Generate a reply from the AI model.
   * Supports multimodal content: messages may contain content arrays with
   * text + image_url parts (OpenAI vision format). If the model does not
   * support vision, falls back to text-only messages automatically.
   *
   * @param {Array<{role: string, content: string|Array}>} messages
   * @param {object} options — { model?, temperature?, max_tokens? }
   * @returns {{ content: string, tokenUsage: { prompt: number, completion: number, total: number } }}
   */
  async function generateReply(messages, options = {}) {
    const model = options.model || openaiModel;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.max_tokens ?? 1000;

    // Check if any message has multimodal content (array format)
    const hasMultimodal = messages.some(m => Array.isArray(m.content));

    let lastErr = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // Use longer timeout for multimodal (image processing takes time)
        const timeout = hasMultimodal ? 60000 : 30000;
        const response = await client.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }, { timeout });

        const choice = response.choices?.[0];
        const content = choice?.message?.content ?? '';
        const usage = response.usage ?? {};

        connected = true;
        lastError = null;

        return {
          content,
          tokenUsage: {
            prompt: usage.prompt_tokens ?? 0,
            completion: usage.completion_tokens ?? 0,
            total: usage.total_tokens ?? 0,
          },
        };
      } catch (err) {
        lastErr = err;

        // If multimodal failed (model doesn't support vision), fall back to text-only
        if (hasMultimodal && attempt === 0 && !isRateLimitError(err)) {
          const textOnlyMessages = stripMultimodalContent(messages);
          try {
            const fallbackResponse = await client.chat.completions.create({
              model,
              messages: textOnlyMessages,
              temperature,
              max_tokens: maxTokens,
            });

            const choice = fallbackResponse.choices?.[0];
            const content = choice?.message?.content ?? '';
            const usage = fallbackResponse.usage ?? {};

            connected = true;
            lastError = null;

            return {
              content,
              tokenUsage: {
                prompt: usage.prompt_tokens ?? 0,
                completion: usage.completion_tokens ?? 0,
                total: usage.total_tokens ?? 0,
              },
            };
          } catch (fallbackErr) {
            lastErr = fallbackErr;
            // Fall through to normal error handling
          }
        }

        // Retry on rate limit (429)
        if (isRateLimitError(err) && attempt < 2) {
          const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Classify and throw
        connected = false;
        lastError = classifyError(err);
        throw lastError;
      }
    }

    // Should not reach here, but just in case
    connected = false;
    lastError = classifyError(lastErr);
    throw lastError;
  }

  /**
   * Test the AI connection with a minimal call.
   * @returns {{ success: boolean, model: string, error?: string }}
   */
  async function testConnection() {
    try {
      const response = await client.chat.completions.create({
        model: openaiModel,
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 5,
      });

      connected = true;
      lastError = null;

      return {
        success: true,
        model: response.model || openaiModel,
      };
    } catch (err) {
      connected = false;
      lastError = classifyError(err);

      return {
        success: false,
        model: openaiModel,
        error: lastError.message,
      };
    }
  }

  /**
   * Get current provider status.
   */
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

/**
 * Classify an OpenAI SDK error into a structured AIError.
 */
function classifyError(err) {
  const status = err.status ?? err.statusCode ?? null;
  const message = err.message ?? String(err);

  let type;
  let msg;

  if (status === 401 || status === 403) {
    type = 'auth_error';
    msg = 'Authentication failed — check OPENAI_API_KEY';
  } else if (status === 429) {
    type = 'rate_limit';
    msg = 'Rate limit exceeded';
  } else if (status >= 500) {
    type = 'provider_error';
    msg = `Provider error: ${message}`;
  } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
    type = 'network';
    msg = `Network error: ${err.code}`;
  } else if (err.name === 'AbortError' || message.includes('timeout')) {
    type = 'timeout';
    msg = 'Request timed out';
  } else {
    type = 'provider_error';
    msg = message;
  }

  const error = new Error(msg);
  error.type = type;
  error.status = status;
  return error;
}

/**
 * Check if an error is a rate limit (429) error.
 */
function isRateLimitError(err) {
  return (err.status ?? err.statusCode) === 429;
}

/**
 * Strip multimodal content (image_url parts) from messages.
 * Converts array-format content back to plain text for non-vision models.
 */
function stripMultimodalContent(messages) {
  return messages.map(msg => {
    if (!Array.isArray(msg.content)) return msg;

    // Extract text parts, replace image parts with descriptions
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
