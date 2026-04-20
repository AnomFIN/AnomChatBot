import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rmSync } from 'node:fs';
import { initDatabase, closeDatabase } from '../src/persistence/database.js';
import { getConversation, getConversationCount } from '../src/persistence/conversations.js';
import { getMessageCount, getRecentMessages } from '../src/persistence/messages.js';
import { createOrchestrator } from '../src/conversation/orchestrator.js';

const TEST_DB_PATH = './data/test-orchestrator.db';
const TEST_CONFIG = {
  databasePath: TEST_DB_PATH,
  ai: { provider: 'openai', openaiApiKey: 'test', openaiBaseUrl: '', openaiModel: 'gpt-4o-mini' },
  defaults: {
    tone: 'friendly',
    flirt: 'none',
    temperature: 0.7,
    maxTokens: 1000,
    maxHistory: 50,
  },
};

function cleanupTestDb() {
  try { rmSync(TEST_DB_PATH, { force: true }); } catch {}
  try { rmSync(TEST_DB_PATH + '-wal', { force: true }); } catch {}
  try { rmSync(TEST_DB_PATH + '-shm', { force: true }); } catch {}
}

// Mock AI provider
function createMockAIProvider(reply = 'AI says hello') {
  return {
    generateReply: vi.fn().mockResolvedValue({
      content: reply,
      tokenUsage: { prompt: 10, completion: 5, total: 15 },
    }),
    testConnection: vi.fn().mockResolvedValue({ success: true, model: 'gpt-4o-mini' }),
    getStatus: vi.fn().mockReturnValue({ connected: true, model: 'gpt-4o-mini', provider: 'openai' }),
  };
}

// Mock Socket.IO
function createMockIO() {
  return { emit: vi.fn() };
}

describe('Orchestrator — handleIncomingMessage', () => {
  let orchestrator;
  let mockAI;
  let mockIO;

  beforeEach(() => {
    cleanupTestDb();
    initDatabase(TEST_CONFIG);
    mockAI = createMockAIProvider();
    mockIO = createMockIO();
    orchestrator = createOrchestrator(TEST_CONFIG, mockAI, mockIO);
  });

  afterEach(() => {
    orchestrator.shutdown();
    closeDatabase();
    cleanupTestDb();
  });

  it('creates a new conversation on first message', async () => {
    expect(getConversationCount()).toBe(0);

    const result = await orchestrator.handleIncomingMessage('api', 'user-1', 'User One', 'Hello');

    expect(getConversationCount()).toBe(1);
    expect(result.conversation).not.toBeNull();
    expect(result.conversation.platform).toBe('api');
    expect(result.conversation.remote_id).toBe('user-1');
    expect(result.userMessage).not.toBeNull();
    expect(result.userMessage.content).toBe('Hello');
  });

  it('emits conversation:new for new conversations', async () => {
    await orchestrator.handleIncomingMessage('api', 'user-new', 'New User', 'Hi');
    expect(mockIO.emit).toHaveBeenCalledWith('conversation:new', expect.any(Object));
  });

  it('does not create duplicate conversations for same platform+remoteId', async () => {
    await orchestrator.handleIncomingMessage('api', 'user-dup', 'User', 'First');
    await orchestrator.handleIncomingMessage('api', 'user-dup', 'User', 'Second');
    expect(getConversationCount()).toBe(1);
  });

  it('returns auto_reply_disabled when auto_reply=0', async () => {
    const result = await orchestrator.handleIncomingMessage('api', 'user-no-auto', 'User', 'Hello');
    expect(result.aiReply).toBeNull();
    expect(result.reason).toBe('auto_reply_disabled');
    expect(mockAI.generateReply).not.toHaveBeenCalled();
  });

  it('persists user message even when auto_reply is off', async () => {
    const result = await orchestrator.handleIncomingMessage('api', 'user-persist', 'User', 'Stored');
    expect(result.userMessage.content).toBe('Stored');
    expect(getMessageCount(result.conversation.id)).toBe(1);
  });

  it('emits message:new for user message', async () => {
    await orchestrator.handleIncomingMessage('api', 'user-emit', 'User', 'Hi');
    expect(mockIO.emit).toHaveBeenCalledWith('message:new', expect.objectContaining({
      message: expect.objectContaining({ role: 'user', content: 'Hi' }),
    }));
  });
});

describe('Orchestrator — first-message rule', () => {
  let orchestrator;
  let mockAI;
  let mockIO;

  beforeEach(() => {
    cleanupTestDb();
    initDatabase(TEST_CONFIG);
    mockAI = createMockAIProvider();
    mockIO = createMockIO();
    orchestrator = createOrchestrator(TEST_CONFIG, mockAI, mockIO);
  });

  afterEach(() => {
    orchestrator.shutdown();
    closeDatabase();
    cleanupTestDb();
  });

  it('new conversation starts with auto_reply=0', async () => {
    const result = await orchestrator.handleIncomingMessage('api', 'rule-1', 'User', 'Hello');
    expect(result.conversation.auto_reply).toBe(0);
  });

  it('operator message flips auto_reply to 1', async () => {
    // Create conversation via incoming message
    const incoming = await orchestrator.handleIncomingMessage('api', 'rule-2', 'User', 'Hello');
    expect(incoming.conversation.auto_reply).toBe(0);

    // Operator sends first message
    const opResult = await orchestrator.handleOperatorMessage(incoming.conversation.id, 'Hey there!');
    expect(opResult.conversation.auto_reply).toBe(1);
  });

  it('after operator message, incoming schedules delayed AI reply', async () => {
    // Create conversation
    const incoming = await orchestrator.handleIncomingMessage('api', 'rule-3', 'User', 'Hello');

    // Operator sends first message (flips auto_reply)
    await orchestrator.handleOperatorMessage(incoming.conversation.id, 'Hey!');

    // Now incoming message should schedule a delayed AI reply (not immediate)
    const second = await orchestrator.handleIncomingMessage('api', 'rule-3', 'User', 'How are you?');
    expect(second.aiReply).toBeNull();
    expect(second.reason).toBe('reply_scheduled');
    // AI is NOT called immediately — it fires after the delay timer
    expect(mockAI.generateReply).not.toHaveBeenCalled();
  });

  it('persists user and operator messages immediately (AI reply is delayed)', async () => {
    const incoming = await orchestrator.handleIncomingMessage('api', 'rule-4', 'User', 'Hey');
    await orchestrator.handleOperatorMessage(incoming.conversation.id, 'Hi!');
    await orchestrator.handleIncomingMessage('api', 'rule-4', 'User', 'Question?');

    // Messages: user "Hey", assistant "Hi!" (operator), user "Question?"
    // AI reply is delayed via timer, NOT persisted yet
    expect(getMessageCount(incoming.conversation.id)).toBe(3);
  });
});

describe('Orchestrator — handleOperatorMessage', () => {
  let orchestrator;
  let mockAI;
  let mockIO;

  beforeEach(() => {
    cleanupTestDb();
    initDatabase(TEST_CONFIG);
    mockAI = createMockAIProvider();
    mockIO = createMockIO();
    orchestrator = createOrchestrator(TEST_CONFIG, mockAI, mockIO);
  });

  afterEach(() => {
    orchestrator.shutdown();
    closeDatabase();
    cleanupTestDb();
  });

  it('persists operator message with role=assistant', async () => {
    const incoming = await orchestrator.handleIncomingMessage('api', 'op-1', 'User', 'Hello');
    const result = await orchestrator.handleOperatorMessage(incoming.conversation.id, 'Operator reply');

    expect(result.message.role).toBe('assistant');
    expect(result.message.content).toBe('Operator reply');
  });

  it('throws for nonexistent conversation', async () => {
    await expect(
      orchestrator.handleOperatorMessage('nonexistent-id', 'test')
    ).rejects.toThrow('not found');
  });

  it('emits conversation:update when auto_reply flips', async () => {
    const incoming = await orchestrator.handleIncomingMessage('api', 'op-2', 'User', 'Hi');
    mockIO.emit.mockClear();

    await orchestrator.handleOperatorMessage(incoming.conversation.id, 'Reply');

    expect(mockIO.emit).toHaveBeenCalledWith('conversation:update', expect.any(Object));
  });

  it('does not re-flip auto_reply if already 1', async () => {
    const incoming = await orchestrator.handleIncomingMessage('api', 'op-3', 'User', 'Hi');
    await orchestrator.handleOperatorMessage(incoming.conversation.id, 'First reply');
    mockIO.emit.mockClear();

    await orchestrator.handleOperatorMessage(incoming.conversation.id, 'Second reply');

    // conversation:update should NOT be emitted since auto_reply is already 1
    const updateCalls = mockIO.emit.mock.calls.filter(c => c[0] === 'conversation:update');
    expect(updateCalls).toHaveLength(0);
  });
});

describe('Orchestrator — AI error handling', () => {
  let mockIO;

  beforeEach(() => {
    cleanupTestDb();
    initDatabase(TEST_CONFIG);
    mockIO = createMockIO();
  });

  afterEach(() => {
    closeDatabase();
    cleanupTestDb();
  });

  it('schedules reply instead of calling AI immediately (errors handled during delay)', async () => {
    const failingAI = {
      generateReply: vi.fn().mockRejectedValue(new Error('API down')),
      testConnection: vi.fn(),
      getStatus: vi.fn(),
    };

    const orchestrator = createOrchestrator(TEST_CONFIG, failingAI, mockIO);

    // Create conversation and enable auto_reply
    const incoming = await orchestrator.handleIncomingMessage('api', 'err-1', 'User', 'Hello');
    await orchestrator.handleOperatorMessage(incoming.conversation.id, 'Hi!');

    // Now incoming should schedule a delayed reply (AI errors happen asynchronously)
    const result = await orchestrator.handleIncomingMessage('api', 'err-1', 'User', 'Question?');
    expect(result.aiReply).toBeNull();
    expect(result.reason).toBe('reply_scheduled');
    // AI was NOT called yet — it will be called when the delay timer fires
    expect(failingAI.generateReply).not.toHaveBeenCalled();

    // Clean up: shutdown to clear pending timers
    orchestrator.shutdown();
  });
});
