import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAIProvider } from '../src/ai/provider.js';

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

describe('AI Provider — omitAuth (Local AI without token)', () => {
  it('does NOT add a custom fetch function when omitAuth is not set', async () => {
    vi.clearAllMocks();
    const OpenAI = (await import('openai')).default;
    createAIProvider(makeConfig());
    const constructorOpts = OpenAI.mock.calls[0][0];
    expect(constructorOpts.fetch).toBeUndefined();
  });

  it('adds a custom fetch function when omitAuth=true', async () => {
    vi.clearAllMocks();
    const OpenAI = (await import('openai')).default;
    createAIProvider(makeConfig({ omitAuth: true }));
    const constructorOpts = OpenAI.mock.calls[0][0];
    expect(typeof constructorOpts.fetch).toBe('function');
  });

  it('custom fetch strips the Authorization header but keeps other headers', async () => {
    vi.clearAllMocks();
    const OpenAI = (await import('openai')).default;
    createAIProvider(makeConfig({ omitAuth: true }));
    const { fetch: customFetch } = OpenAI.mock.calls[0][0];

    // Replace global fetch temporarily
    const capturedCalls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => {
      capturedCalls.push({ url, init });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    };

    await customFetch('http://localhost:1234/v1/chat', {
      headers: {
        authorization: 'Bearer no-auth-local-ai',
        'content-type': 'application/json',
        'x-custom': 'value',
      },
    });

    globalThis.fetch = originalFetch;

    expect(capturedCalls).toHaveLength(1);
    const sentHeaders = capturedCalls[0].init.headers;
    // Headers is a Headers instance; check via .get()
    expect(sentHeaders.get('authorization')).toBeNull();
    expect(sentHeaders.get('content-type')).toBe('application/json');
    expect(sentHeaders.get('x-custom')).toBe('value');
  });
});

describe('AI Provider — AbortSignal support', () => {
  let provider;
  let mockCreate;

  beforeEach(async () => {
    vi.clearAllMocks();
    const OpenAI = (await import('openai')).default;
    provider = createAIProvider(makeConfig());
    const instance = OpenAI.mock.results[0].value;
    mockCreate = instance.chat.completions.create;
  });

  it('passes AbortSignal to the API call', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'OK' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });

    const ctrl = new AbortController();
    await provider.generateReply([{ role: 'user', content: 'test' }], { signal: ctrl.signal });

    const requestOpts = mockCreate.mock.calls[0][1];
    expect(requestOpts.signal).toBe(ctrl.signal);
  });

  it('propagates AbortError without classifying or retrying', async () => {
    const abortErr = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    mockCreate.mockRejectedValueOnce(abortErr);

    const ctrl = new AbortController();
    ctrl.abort();

    await expect(
      provider.generateReply([{ role: 'user', content: 'test' }], { signal: ctrl.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });

    // Should NOT have retried
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
