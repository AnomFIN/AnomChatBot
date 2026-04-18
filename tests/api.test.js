import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rmSync } from 'node:fs';
import Fastify from 'fastify';
import formbody from '@fastify/formbody';
import { initDatabase, closeDatabase } from '../src/persistence/database.js';
import { createConversation } from '../src/persistence/conversations.js';
import { addMessage } from '../src/persistence/messages.js';
import healthRoutes from '../src/api/health.js';
import conversationRoutes from '../src/api/conversations.js';
import settingsRoutes from '../src/api/settings.js';

const TEST_DB_PATH = './data/test-api.db';

function cleanupTestDb() {
  try { rmSync(TEST_DB_PATH, { force: true }); } catch {}
  try { rmSync(TEST_DB_PATH + '-wal', { force: true }); } catch {}
  try { rmSync(TEST_DB_PATH + '-shm', { force: true }); } catch {}
}

const TEST_CONFIG = {
  version: '2.0.0',
  host: '127.0.0.1',
  port: 0,
  logLevel: 'silent',
  databasePath: TEST_DB_PATH,
  ai: { provider: 'openai', openaiApiKey: 'test', openaiBaseUrl: '', openaiModel: 'gpt-4o-mini' },
  whatsapp: { mode: 'baileys' },
  telegram: { enabled: false },
  defaults: { tone: 'friendly', flirt: 'none', temperature: 0.7, maxTokens: 1000, maxHistory: 50 },
};

function createMockAIProvider() {
  return {
    generateReply: vi.fn().mockResolvedValue({
      content: 'AI reply',
      tokenUsage: { prompt: 10, completion: 5, total: 15 },
    }),
    testConnection: vi.fn().mockResolvedValue({ success: true, model: 'gpt-4o-mini' }),
    getStatus: vi.fn().mockReturnValue({
      connected: true, model: 'gpt-4o-mini', provider: 'openai', lastError: null,
    }),
  };
}

function createMockOrchestrator() {
  return {
    handleIncomingMessage: vi.fn(),
    handleOperatorMessage: vi.fn().mockResolvedValue({
      conversation: { id: 'test-id', platform: 'api' },
      message: { id: 1, role: 'assistant', content: 'Hello', created_at: new Date().toISOString() },
    }),
  };
}

let fastify;
let mockAI;
let mockOrchestrator;
let mockIO;

async function buildApp() {
  cleanupTestDb();
  initDatabase(TEST_CONFIG);

  fastify = Fastify({ logger: false });
  await fastify.register(formbody);

  mockAI = createMockAIProvider();
  mockOrchestrator = createMockOrchestrator();
  mockIO = { emit: vi.fn() };

  await fastify.register(healthRoutes, { config: TEST_CONFIG, aiProvider: mockAI });
  await fastify.register(conversationRoutes, { orchestrator: mockOrchestrator });
  await fastify.register(settingsRoutes, { io: mockIO });

  await fastify.ready();
}

async function teardownApp() {
  await fastify.close();
  closeDatabase();
  cleanupTestDb();
}

// ── Health endpoint ────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  beforeEach(buildApp);
  afterEach(teardownApp);

  it('returns success with AI and DB status', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/health' });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.version).toBe('2.0.0');
    expect(body.data.database.initialized).toBe(true);
    expect(body.data.database.conversations).toBe(0);
    expect(body.data.database.messages).toBe(0);
    expect(body.data.ai.connected).toBe(true);
    expect(body.data.ai.model).toBe('gpt-4o-mini');
  });

  it('shows correct conversation and message counts', async () => {
    const conv = createConversation({ platform: 'api', remoteId: 'health-test' });
    addMessage(conv.id, 'user', 'Hello');
    addMessage(conv.id, 'assistant', 'Hi');

    const res = await fastify.inject({ method: 'GET', url: '/api/health' });
    const body = JSON.parse(res.body);

    expect(body.data.database.conversations).toBe(1);
    expect(body.data.database.messages).toBe(2);
  });
});

// ── Conversations endpoints ────────────────────────────────────────────────

describe('GET /api/conversations', () => {
  beforeEach(buildApp);
  afterEach(teardownApp);

  it('returns empty array when no conversations', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/conversations' });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('returns conversations when they exist', async () => {
    createConversation({ platform: 'api', remoteId: 'list-1' });
    createConversation({ platform: 'api', remoteId: 'list-2' });

    const res = await fastify.inject({ method: 'GET', url: '/api/conversations' });
    const body = JSON.parse(res.body);

    expect(body.data).toHaveLength(2);
  });
});

describe('GET /api/conversations/:id', () => {
  beforeEach(buildApp);
  afterEach(teardownApp);

  it('returns 404 for nonexistent conversation', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/conversations/fake-id' });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).success).toBe(false);
  });

  it('returns conversation when found', async () => {
    const conv = createConversation({ platform: 'api', remoteId: 'get-1' });
    const res = await fastify.inject({ method: 'GET', url: `/api/conversations/${conv.id}` });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.data.id).toBe(conv.id);
    expect(body.data.platform).toBe('api');
  });
});

describe('GET /api/conversations/:id/messages', () => {
  beforeEach(buildApp);
  afterEach(teardownApp);

  it('returns 404 for nonexistent conversation', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/conversations/fake-id/messages' });
    expect(res.statusCode).toBe(404);
  });

  it('returns messages with pagination', async () => {
    const conv = createConversation({ platform: 'api', remoteId: 'msgs-1' });
    addMessage(conv.id, 'user', 'Hello');
    addMessage(conv.id, 'assistant', 'Hi there');

    const res = await fastify.inject({
      method: 'GET',
      url: `/api/conversations/${conv.id}/messages?limit=10&offset=0`,
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.data.messages).toHaveLength(2);
    expect(body.data.pagination.total).toBe(2);
    expect(body.data.pagination.limit).toBe(10);
    expect(body.data.pagination.offset).toBe(0);
  });

  it('respects limit parameter', async () => {
    const conv = createConversation({ platform: 'api', remoteId: 'msgs-2' });
    for (let i = 0; i < 5; i++) {
      addMessage(conv.id, 'user', `msg-${i}`);
    }

    const res = await fastify.inject({
      method: 'GET',
      url: `/api/conversations/${conv.id}/messages?limit=2`,
    });
    const body = JSON.parse(res.body);

    expect(body.data.messages).toHaveLength(2);
    expect(body.data.pagination.total).toBe(5);
  });

  it('caps limit at 200', async () => {
    const conv = createConversation({ platform: 'api', remoteId: 'msgs-3' });

    const res = await fastify.inject({
      method: 'GET',
      url: `/api/conversations/${conv.id}/messages?limit=999`,
    });
    const body = JSON.parse(res.body);

    expect(body.data.pagination.limit).toBe(200);
  });
});

describe('POST /api/conversations/:id/messages', () => {
  beforeEach(buildApp);
  afterEach(teardownApp);

  it('calls orchestrator.handleOperatorMessage', async () => {
    const conv = createConversation({ platform: 'api', remoteId: 'post-1' });
    mockOrchestrator.handleOperatorMessage.mockResolvedValue({
      conversation: conv,
      message: { id: 1, role: 'assistant', content: 'Hello', created_at: new Date().toISOString() },
    });

    const res = await fastify.inject({
      method: 'POST',
      url: `/api/conversations/${conv.id}/messages`,
      payload: { content: 'Hello from operator' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockOrchestrator.handleOperatorMessage).toHaveBeenCalledWith(conv.id, 'Hello from operator');
  });

  it('returns 400 for empty content', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/conversations/any-id/messages',
      payload: { content: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for missing content', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/conversations/any-id/messages',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when conversation not found', async () => {
    mockOrchestrator.handleOperatorMessage.mockRejectedValue(new Error('Conversation not found: fake'));

    const res = await fastify.inject({
      method: 'POST',
      url: '/api/conversations/fake/messages',
      payload: { content: 'test' },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ── Settings endpoints ─────────────────────────────────────────────────────

describe('GET /api/conversations/:id/settings', () => {
  beforeEach(buildApp);
  afterEach(teardownApp);

  it('returns 404 for nonexistent conversation', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/conversations/fake/settings' });
    expect(res.statusCode).toBe(404);
  });

  it('returns settings for existing conversation', async () => {
    const conv = createConversation({ platform: 'api', remoteId: 'set-1' });
    const res = await fastify.inject({ method: 'GET', url: `/api/conversations/${conv.id}/settings` });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.data.tone).toBe('friendly');
    expect(body.data.flirt).toBe('none');
    expect(body.data.temperature).toBe(0.7);
    expect(body.data.auto_reply).toBe(0);
  });
});

describe('PUT /api/conversations/:id/settings', () => {
  beforeEach(buildApp);
  afterEach(teardownApp);

  it('returns 404 for nonexistent conversation', async () => {
    const res = await fastify.inject({
      method: 'PUT',
      url: '/api/conversations/fake/settings',
      payload: { tone: 'casual' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('updates valid settings', async () => {
    const conv = createConversation({ platform: 'api', remoteId: 'set-2' });
    const res = await fastify.inject({
      method: 'PUT',
      url: `/api/conversations/${conv.id}/settings`,
      payload: { tone: 'playful', flirt: 'subtle', temperature: 0.9 },
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.data.tone).toBe('playful');
    expect(body.data.flirt).toBe('subtle');
    expect(body.data.temperature).toBe(0.9);
  });

  it('rejects invalid tone', async () => {
    const conv = createConversation({ platform: 'api', remoteId: 'set-3' });
    const res = await fastify.inject({
      method: 'PUT',
      url: `/api/conversations/${conv.id}/settings`,
      payload: { tone: 'aggressive' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toContain('tone');
  });

  it('rejects invalid flirt', async () => {
    const conv = createConversation({ platform: 'api', remoteId: 'set-4' });
    const res = await fastify.inject({
      method: 'PUT',
      url: `/api/conversations/${conv.id}/settings`,
      payload: { flirt: 'extreme' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toContain('flirt');
  });

  it('rejects out-of-range temperature', async () => {
    const conv = createConversation({ platform: 'api', remoteId: 'set-5' });
    const res = await fastify.inject({
      method: 'PUT',
      url: `/api/conversations/${conv.id}/settings`,
      payload: { temperature: 5.0 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid auto_reply value', async () => {
    const conv = createConversation({ platform: 'api', remoteId: 'set-6' });
    const res = await fastify.inject({
      method: 'PUT',
      url: `/api/conversations/${conv.id}/settings`,
      payload: { auto_reply: 2 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns no changes when empty payload', async () => {
    const conv = createConversation({ platform: 'api', remoteId: 'set-7' });
    const res = await fastify.inject({
      method: 'PUT',
      url: `/api/conversations/${conv.id}/settings`,
      payload: {},
    });
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body.data.message).toBe('No changes');
  });

  it('emits conversation:update via Socket.IO', async () => {
    const conv = createConversation({ platform: 'api', remoteId: 'set-8' });
    await fastify.inject({
      method: 'PUT',
      url: `/api/conversations/${conv.id}/settings`,
      payload: { tone: 'casual' },
    });

    expect(mockIO.emit).toHaveBeenCalledWith('conversation:update', expect.any(Object));
  });
});
