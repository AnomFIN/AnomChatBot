import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAIProvider, normalizeLmStudioMessageContent, normalizeLmStudioApiChatResponse, normalizeEphemeralMcpIntegrations, serializeMessagesForLmStudioInput } from '../src/ai/provider.js';

// Mock the OpenAI module
vi.mock('openai', () => {
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  }));
  return { default: MockOpenAI };
});

function makeConfig(overrides = {}) {
  return {
    ai: {
      provider: 'openai',
      openaiApiKey: 'sk-test-key-123456',
      openaiBaseUrl: '',
      openaiModel: 'gpt-4o-mini',
      ...overrides,
    },
    defaults: {
      tone: 'friendly',
      flirt: 'none',
      temperature: 0.7,
      maxTokens: 1000,
      maxHistory: 50,
    },
  };
}

describe('AI Provider — creation', () => {
  it('creates a provider with required methods', () => {
    const provider = createAIProvider(makeConfig());
    expect(provider.generateReply).toBeInstanceOf(Function);
    expect(provider.testConnection).toBeInstanceOf(Function);
    expect(provider.getStatus).toBeInstanceOf(Function);
  });

  it('initial status shows not connected', () => {
    const provider = createAIProvider(makeConfig());
    const status = provider.getStatus();
    expect(status.connected).toBe(false);
    expect(status.model).toBe('gpt-4o-mini');
    expect(status.provider).toBe('openai');
    expect(status.lastError).toBeNull();
  });
});

describe('AI Provider — generateReply', () => {
  let provider;
  let mockCreate;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Import the mocked OpenAI to access the mock
    const OpenAI = (await import('openai')).default;

    provider = createAIProvider(makeConfig());

    // Get the mock create function from the instantiated client
    const instance = OpenAI.mock.results[0].value;
    mockCreate = instance.chat.completions.create;
  });

  it('returns content and token usage on success', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Hello!' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const result = await provider.generateReply(
      [{ role: 'user', content: 'Hi' }],
      { temperature: 0.7, max_tokens: 100 },
    );

    expect(result.content).toBe('Hello!');
    expect(result.tokenUsage).toEqual({ prompt: 10, completion: 5, total: 15 });
  });

  it('sets connected=true after success', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'OK' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });

    await provider.generateReply([{ role: 'user', content: 'test' }]);
    expect(provider.getStatus().connected).toBe(true);
  });

  it('handles missing usage gracefully', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Hi' } }],
    });

    const result = await provider.generateReply([{ role: 'user', content: 'test' }]);
    expect(result.tokenUsage).toEqual({ prompt: 0, completion: 0, total: 0 });
  });

  it('throws classified auth error on 401', async () => {
    mockCreate.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }));

    await expect(
      provider.generateReply([{ role: 'user', content: 'test' }])
    ).rejects.toMatchObject({ type: 'auth_error' });

    expect(provider.getStatus().connected).toBe(false);
  });

  it('throws classified rate_limit error on 429 after retries', async () => {
    vi.useFakeTimers();

    const err429 = Object.assign(new Error('Rate limited'), { status: 429 });
    mockCreate
      .mockRejectedValueOnce(err429)
      .mockRejectedValueOnce(err429)
      .mockRejectedValueOnce(err429);

    let caughtError;
    const promise = provider.generateReply([{ role: 'user', content: 'test' }])
      .catch(e => { caughtError = e; });

    // Advance past retry delays (2s + 4s)
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);
    await promise;

    expect(caughtError).toBeDefined();
    expect(caughtError.type).toBe('rate_limit');
    expect(mockCreate).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('retries on 429 and succeeds on second attempt', async () => {
    vi.useFakeTimers();

    mockCreate
      .mockRejectedValueOnce(Object.assign(new Error('Rate limited'), { status: 429 }))
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'OK' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });

    const promise = provider.generateReply([{ role: 'user', content: 'test' }]);
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;
    expect(result.content).toBe('OK');
    expect(mockCreate).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('throws classified provider_error on 500', async () => {
    mockCreate.mockRejectedValueOnce(Object.assign(new Error('Internal error'), { status: 500 }));

    await expect(
      provider.generateReply([{ role: 'user', content: 'test' }])
    ).rejects.toMatchObject({ type: 'provider_error' });
  });

  it('throws classified network error on ECONNREFUSED', async () => {
    mockCreate.mockRejectedValueOnce(Object.assign(new Error('connect failed'), { code: 'ECONNREFUSED' }));

    await expect(
      provider.generateReply([{ role: 'user', content: 'test' }])
    ).rejects.toMatchObject({ type: 'network' });
  });
});

describe('AI Provider — testConnection', () => {
  let provider;
  let mockCreate;

  beforeEach(async () => {
    vi.clearAllMocks();
    const OpenAI = (await import('openai')).default;
    provider = createAIProvider(makeConfig());
    const instance = OpenAI.mock.results[0].value;
    mockCreate = instance.chat.completions.create;
  });

  it('returns success on valid response', async () => {
    mockCreate.mockResolvedValueOnce({
      model: 'gpt-4o-mini',
      choices: [{ message: { content: 'OK' } }],
    });

    const result = await provider.testConnection();
    expect(result.success).toBe(true);
    expect(result.model).toBe('gpt-4o-mini');
    expect(provider.getStatus().connected).toBe(true);
  });

  it('returns failure with error message on exception', async () => {
    mockCreate.mockRejectedValueOnce(Object.assign(new Error('bad key'), { status: 401 }));

    const result = await provider.testConnection();
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(provider.getStatus().connected).toBe(false);
  });
});

describe('AI Provider — baseURL override', () => {
  it('accepts openai_compatible with custom base URL', async () => {
    vi.clearAllMocks();
    const config = makeConfig({
      provider: 'openai_compatible',
      openaiBaseUrl: 'http://localhost:1234/v1',
    });
    const provider = createAIProvider(config);
    expect(provider.getStatus().provider).toBe('openai_compatible');
  });
});

describe('AI Provider — Local AI / LM Studio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('does not send Authorization or instantiate OpenAI SDK when permission token is disabled', async () => {
    const OpenAI = (await import('openai')).default;
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'local ok' } }] }),
    });

    const provider = createAIProvider(makeConfig({
      localAi: {
        enabled: true,
        provider: 'lmstudio',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'local-model',
        usePermissionToken: 'false',
        permissionToken: 'secret-token',
      },
    }));

    const result = await provider.generateReply([{ role: 'user', content: 'Hi' }]);

    expect(result.content).toBe('local ok');
    expect(OpenAI).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:1234/v1/chat/completions',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('adds exact Authorization only for Local AI when permission token is enabled', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'token ok' } }] }),
    });

    const provider = createAIProvider(makeConfig({
      localAi: {
        enabled: true,
        provider: 'lmstudio',
        baseUrl: 'http://127.0.0.1:1234/v1/',
        model: 'local-model',
        usePermissionToken: true,
        permissionToken: 'lmstudio-token',
      },
    }));

    await provider.generateReply([{ role: 'user', content: 'Hi' }]);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:1234/v1/chat/completions',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer lmstudio-token',
        },
      }),
    );
  });



  it('does not send Local AI token through the OpenAI cloud SDK path', async () => {
    vi.clearAllMocks();
    const OpenAI = (await import('openai')).default;
    const provider = createAIProvider(makeConfig({
      openaiApiKey: 'sk-cloud-key',
      localAi: {
        enabled: false,
        provider: 'lmstudio',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'local-model',
        usePermissionToken: true,
        permissionToken: 'must-not-leak',
      },
    }));
    const instance = OpenAI.mock.results[0].value;
    instance.chat.completions.create.mockResolvedValueOnce({ choices: [{ message: { content: 'cloud ok' } }] });

    await provider.generateReply([{ role: 'user', content: 'Hi' }]);

    expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'sk-cloud-key' }));
    expect(OpenAI).not.toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'must-not-leak' }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fails clearly when token toggle is enabled but token is missing', async () => {
    const provider = createAIProvider(makeConfig({
      localAi: {
        enabled: true,
        provider: 'lmstudio',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'local-model',
        usePermissionToken: true,
        permissionToken: '',
      },
    }));

    await expect(provider.generateReply([{ role: 'user', content: 'Hi' }]))
      .rejects.toMatchObject({ type: 'auth_error' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses LM Studio /api/v1/chat with input and integrations for Ephemeral MCP mode', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ output: [{ type: 'message', content: 'ephemeral ok' }], usage: { input_tokens: 7, output_tokens: 3, total_tokens: 10 } }),
    });

    const provider = createAIProvider(makeConfig({
      localAi: {
        enabled: true,
        provider: 'lmstudio',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'ibm/granite-4-micro',
        usePermissionToken: true,
        permissionToken: 'lmstudio-token',
        mcpMode: 'ephemeral',
        mcpIntegrations: [{
          type: 'ephemeral_mcp',
          server_label: 'huggingface',
          server_url: 'https://huggingface.co/mcp',
          allowed_tools: ['hub_repo_search'],
        }],
      },
    }));

    const result = await provider.generateReply([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
      { role: 'user', content: 'Top model?' },
    ]);
    const [, request] = global.fetch.mock.calls[0];
    const body = JSON.parse(request.body);

    expect(result.content).toBe('ephemeral ok');
    expect(global.fetch).toHaveBeenCalledWith('http://127.0.0.1:1234/api/v1/chat', expect.any(Object));
    expect(request.headers.Authorization).toBe('Bearer lmstudio-token');
    expect(body.messages).toBeUndefined();
    expect(body.model).toBe('ibm/granite-4-micro');
    expect(body.max_tokens).toBe(300);
    expect(body.input).toContain('HuggingFace MCP is NOT a general web search engine.');
    expect(body.input).toContain('Conversation:\nUser: Hello\nAssistant: Hi!\nUser: Top model?');
    expect(body.integrations).toEqual([{
      type: 'ephemeral_mcp',
      server_label: 'huggingface',
      server_url: 'https://huggingface.co/mcp',
      allowed_tools: ['hub_repo_search'],
    }]);
  });


  it('parses LM Studio output arrays without leaking tool_call JSON', () => {
    expect(normalizeLmStudioMessageContent({ output: [{ type: 'message', content: '  Hei maailma  ' }] })).toBe('Hei maailma');
    expect(normalizeLmStudioMessageContent({ output: [
      { type: 'tool_call', tool: 'brave_web_search', output: '[{"raw":true}]' },
      { type: 'message', content: 'Lopullinen vastaus' },
    ] })).toBe('Lopullinen vastaus');
    expect(normalizeLmStudioMessageContent({ output: [
      { type: 'tool_call', tool: 'brave_web_search' },
      { type: 'message', content: '\n' },
    ] })).toBe('Haku ei tuottanut suoraa vastausta. Kokeile tarkentaa hakua.');
  });

  it('parses output strings and JSON-string message arrays', () => {
    expect(normalizeLmStudioMessageContent({ output: 'selkeä vastaus' })).toBe('selkeä vastaus');
    expect(normalizeLmStudioMessageContent('[{"type":"tool_call","tool":"x"},{"type":"message","content":"vain sisältö"}]')).toBe('vain sisältö');
    expect(normalizeLmStudioMessageContent({ output: [] })).toBe('En saanut muodostettua kunnollista vastausta. Kokeillaan uudelleen tarkemmalla kysymyksellä.');
  });

  it('routes sports and company queries to web search, not HuggingFace', async () => {
    for (const query of ['NHL tulokset tänään', 'Oy yrityksen hallitus']) {
      global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ output: [{ type: 'message', content: 'web ok' }] }) });
      const provider = createAIProvider(makeConfig({
        localAi: {
          enabled: true, provider: 'lmstudio', baseUrl: 'http://127.0.0.1:1234/v1', model: 'local-model', mcpMode: 'ephemeral',
          mcpIntegrations: [
            { server_label: 'brave-search', server_url: 'http://10.5.0.2:8000/mcp', allowed_tools: ['brave_web_search', 'brave_local_search', 'brave_news_search'] },
            { server_label: 'huggingface', server_url: 'https://huggingface.co/mcp', allowed_tools: ['hub_repo_search', 'hf_doc_search'] },
          ],
        },
      }));

      await provider.generateReply([{ role: 'user', content: query }]);
      const body = JSON.parse(global.fetch.mock.calls.at(-1)[1].body);
      expect(body.integrations).toHaveLength(1);
      expect(body.integrations[0].server_label).toBe('brave-search');
      expect(body.input).toContain('General web search handles news');
      expect(body.input).not.toContain('HuggingFace MCP is NOT a general web search engine.');
    }
  });

  it('routes HuggingFace model and docs queries to HuggingFace MCP', async () => {
    for (const query of ['Qwen3 model', 'Hugging Face docs embeddings']) {
      global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ output: [{ type: 'message', content: 'hf ok' }] }) });
      const provider = createAIProvider(makeConfig({
        localAi: {
          enabled: true, provider: 'lmstudio', baseUrl: 'http://127.0.0.1:1234/v1', model: 'local-model', mcpMode: 'ephemeral',
          mcpIntegrations: [
            { server_label: 'brave-search', server_url: 'http://10.5.0.2:8000/mcp', allowed_tools: ['brave_web_search'] },
            { server_label: 'huggingface', server_url: 'https://huggingface.co/mcp', allowed_tools: ['hub_repo_search', 'hf_doc_search'] },
          ],
        },
      }));

      await provider.generateReply([{ role: 'user', content: query }]);
      const body = JSON.parse(global.fetch.mock.calls.at(-1)[1].body);
      expect(body.integrations).toHaveLength(1);
      expect(body.integrations[0].server_label).toBe('huggingface');
      expect(body.input).toContain('HuggingFace MCP is NOT a general web search engine.');
    }
  });


  it('falls back to normal Local AI chat when only HuggingFace exists for a sports query', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: 'normal ok' } }] }) });
    const provider = createAIProvider(makeConfig({
      localAi: {
        enabled: true,
        provider: 'lmstudio',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'local-model',
        mcpMode: 'ephemeral',
        mcpIntegrations: [{ server_label: 'huggingface', server_url: 'https://huggingface.co/mcp', allowed_tools: ['hub_repo_search'] }],
      },
    }));

    await provider.generateReply([{ role: 'user', content: 'NHL tulokset' }]);
    const [, request] = global.fetch.mock.calls.at(-1);
    const body = JSON.parse(request.body);
    expect(global.fetch.mock.calls.at(-1)[0]).toBe('http://127.0.0.1:1234/v1/chat/completions');
    expect(body.integrations).toBeUndefined();
  });


  it('serializes system, user, and assistant history into LM Studio input', () => {
    expect(serializeMessagesForLmStudioInput([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
      { role: 'user', content: 'What are trending models on Hugging Face?' },
    ])).toBe(`System:
You are a helpful assistant.

Conversation:
User: Hello
Assistant: Hi!
User: What are trending models on Hugging Face?`);
  });


  it('logs Local AI request debug metadata without leaking permission tokens', async () => {
    const logger = { debug: vi.fn() };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'debug ok' } }] }),
    });

    const provider = createAIProvider({
      ...makeConfig({
        localAi: {
          enabled: true,
          provider: 'lmstudio',
          baseUrl: 'http://127.0.0.1:1234/v1',
          model: 'local-model',
          usePermissionToken: true,
          permissionToken: 'must-not-log',
          mcpMode: 'ephemeral',
          mcpIntegrations: [{
            type: 'ephemeral_mcp',
            server_label: 'huggingface',
            server_url: 'https://huggingface.co/mcp',
            allowed_tools: ['hub_repo_search'],
          }],
        },
      }),
      logger,
    });

    await provider.generateReply([{ role: 'user', content: 'Hugging Face docs' }]);

    expect(logger.debug).toHaveBeenCalledWith(
      {
        localAi: {
          endpoint: 'http://127.0.0.1:1234/api/v1/chat',
          usesLmStudioApi: true,
          mcpMode: 'ephemeral',
          integrationsCount: 1,
        },
      },
      'Local AI request prepared',
    );
    expect(JSON.stringify(logger.debug.mock.calls)).not.toContain('must-not-log');
  });

  it('uses existing Local AI path when MCP is not Ephemeral MCP', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'fallback ok' } }] }),
    });

    const provider = createAIProvider(makeConfig({
      localAi: {
        enabled: true,
        provider: 'lmstudio',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'local-model',
        usePermissionToken: false,
        mcpMode: 'local_config',
      },
    }));

    await provider.generateReply([{ role: 'user', content: 'Hi' }]);
    expect(global.fetch).toHaveBeenCalledWith('http://127.0.0.1:1234/v1/chat/completions', expect.any(Object));
  });

  it('normalizeLmStudioApiChatResponse computes total from prompt+completion when total_tokens is absent', () => {
    const result = normalizeLmStudioApiChatResponse({
      output: [{ type: 'message', content: 'hi' }],
      usage: { input_tokens: 8, output_tokens: 4 },
    });
    expect(result.tokenUsage).toEqual({ prompt: 8, completion: 4, total: 12 });
  });

  it('normalizeLmStudioApiChatResponse uses total_tokens when present', () => {
    const result = normalizeLmStudioApiChatResponse({
      output: [{ type: 'message', content: 'hi' }],
      usage: { input_tokens: 8, output_tokens: 4, total_tokens: 15 },
    });
    expect(result.tokenUsage).toEqual({ prompt: 8, completion: 4, total: 15 });
  });

  it('normalizeEphemeralMcpIntegrations merges allowed_tools for same server_label+server_url', () => {
    const result = normalizeEphemeralMcpIntegrations([
      { server_label: 'brave', server_url: 'http://localhost:8000/mcp', allowed_tools: ['brave_web_search'] },
      { server_label: 'brave', server_url: 'http://localhost:8000/mcp', allowed_tools: ['brave_news_search'] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].allowed_tools).toHaveLength(2);
    expect(result[0].allowed_tools).toEqual(expect.arrayContaining(['brave_web_search', 'brave_news_search']));
    expect(result[0].server_label).toBe('brave');
  });

  it('normalizeEphemeralMcpIntegrations keeps distinct entries with different label or url', () => {
    const result = normalizeEphemeralMcpIntegrations([
      { server_label: 'brave', server_url: 'http://localhost:8000/mcp', allowed_tools: ['brave_web_search'] },
      { server_label: 'huggingface', server_url: 'https://huggingface.co/mcp', allowed_tools: ['hub_repo_search'] },
    ]);
    expect(result).toHaveLength(2);
  });

});
