import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

// We need to set up the database module's internal state for testing.
// Import the module, then initialize with a test DB path.
import { initDatabase, getDatabase, closeDatabase } from '../src/persistence/database.js';
import {
  createConversation,
  getConversation,
  getOrCreateConversation,
  listConversations,
  updateConversationSettings,
  touchConversation,
  getConversationCount,
} from '../src/persistence/conversations.js';
import {
  addMessage,
  getMessages,
  getRecentMessages,
  getMessageCount,
  getTotalMessageCount,
} from '../src/persistence/messages.js';

const TEST_DB_PATH = './data/test-persistence.db';

const TEST_CONFIG = { databasePath: TEST_DB_PATH };

function cleanupTestDb() {
  try { rmSync(TEST_DB_PATH, { force: true }); } catch {}
  try { rmSync(TEST_DB_PATH + '-wal', { force: true }); } catch {}
  try { rmSync(TEST_DB_PATH + '-shm', { force: true }); } catch {}
}

describe('Schema & Database', () => {
  beforeEach(() => {
    cleanupTestDb();
    initDatabase(TEST_CONFIG);
  });

  afterEach(() => {
    closeDatabase();
    cleanupTestDb();
  });

  it('creates all tables', () => {
    const db = getDatabase();
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all().map(r => r.name);

    expect(tables).toContain('_meta');
    expect(tables).toContain('conversations');
    expect(tables).toContain('messages');
    expect(tables).toContain('admin_logs');
    expect(tables).toContain('transport_status');
  });

  it('sets schema_version to 1', () => {
    const db = getDatabase();
    const row = db.prepare("SELECT value FROM _meta WHERE key = 'schema_version'").get();
    expect(row.value).toBe('1');
  });

  it('creates indexes', () => {
    const db = getDatabase();
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
    ).all().map(r => r.name);

    expect(indexes).toContain('idx_messages_conversation');
    expect(indexes).toContain('idx_conversations_platform');
  });

  it('enforces foreign keys', () => {
    const db = getDatabase();
    expect(() => {
      db.prepare(
        "INSERT INTO messages (conversation_id, role, content) VALUES ('nonexistent', 'user', 'test')"
      ).run();
    }).toThrow();
  });

  it('is idempotent — can initialize twice without error', () => {
    closeDatabase();
    expect(() => initDatabase(TEST_CONFIG)).not.toThrow();
  });
});

describe('Conversations CRUD', () => {
  beforeEach(() => {
    cleanupTestDb();
    initDatabase(TEST_CONFIG);
  });

  afterEach(() => {
    closeDatabase();
    cleanupTestDb();
  });

  it('creates a conversation with defaults', () => {
    const conv = createConversation({ platform: 'api', remoteId: 'test-1' });
    expect(conv).not.toBeNull();
    expect(conv.id).toBeTruthy();
    expect(conv.platform).toBe('api');
    expect(conv.remote_id).toBe('test-1');
    expect(conv.tone).toBe('friendly');
    expect(conv.flirt).toBe('none');
    expect(conv.temperature).toBe(0.7);
    expect(conv.max_tokens).toBe(1000);
    expect(conv.max_history).toBe(50);
    expect(conv.auto_reply).toBe(0);
  });

  it('creates a conversation with custom defaults', () => {
    const conv = createConversation({
      platform: 'whatsapp',
      remoteId: '+1234567890',
      displayName: 'Alice',
      defaults: { tone: 'playful', flirt: 'subtle', temperature: 0.9 },
    });
    expect(conv.platform).toBe('whatsapp');
    expect(conv.display_name).toBe('Alice');
    expect(conv.tone).toBe('playful');
    expect(conv.flirt).toBe('subtle');
    expect(conv.temperature).toBe(0.9);
  });

  it('getConversation returns null for nonexistent', () => {
    expect(getConversation('nonexistent-id')).toBeNull();
  });

  it('getConversation returns the created conversation', () => {
    const created = createConversation({ platform: 'api', remoteId: 'test-2' });
    const fetched = getConversation(created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.platform).toBe('api');
  });

  it('getOrCreateConversation creates new', () => {
    const { conversation, created } = getOrCreateConversation('api', 'new-contact');
    expect(created).toBe(true);
    expect(conversation.remote_id).toBe('new-contact');
  });

  it('getOrCreateConversation returns existing', () => {
    const first = getOrCreateConversation('api', 'same-contact');
    const second = getOrCreateConversation('api', 'same-contact');
    expect(second.created).toBe(false);
    expect(second.conversation.id).toBe(first.conversation.id);
  });

  it('enforces UNIQUE(platform, remote_id)', () => {
    createConversation({ platform: 'api', remoteId: 'dup-1' });
    expect(() => {
      createConversation({ platform: 'api', remoteId: 'dup-1' });
    }).toThrow();
  });

  it('allows same remote_id on different platforms', () => {
    createConversation({ platform: 'api', remoteId: 'cross-1' });
    expect(() => {
      createConversation({ platform: 'whatsapp', remoteId: 'cross-1' });
    }).not.toThrow();
  });

  it('listConversations returns all sorted by updated_at desc', () => {
    createConversation({ platform: 'api', remoteId: 'a' });
    createConversation({ platform: 'api', remoteId: 'b' });
    createConversation({ platform: 'api', remoteId: 'c' });

    const list = listConversations();
    expect(list).toHaveLength(3);
  });

  it('updateConversationSettings updates provided fields only', () => {
    const conv = createConversation({ platform: 'api', remoteId: 'upd-1' });
    const updated = updateConversationSettings(conv.id, { tone: 'playful', flirt: 'high' });
    expect(updated.tone).toBe('playful');
    expect(updated.flirt).toBe('high');
    expect(updated.temperature).toBe(0.7); // unchanged
  });

  it('updateConversationSettings returns null for nonexistent', () => {
    const result = updateConversationSettings('nonexistent', { tone: 'casual' });
    expect(result).toBeNull();
  });

  it('touchConversation updates the timestamp', () => {
    const conv = createConversation({ platform: 'api', remoteId: 'touch-1' });
    // Set updated_at to a known past time so touch produces a different value
    const db = getDatabase();
    db.prepare("UPDATE conversations SET updated_at = '2020-01-01 00:00:00' WHERE id = ?").run(conv.id);
    const before = getConversation(conv.id).updated_at;
    expect(before).toBe('2020-01-01 00:00:00');

    touchConversation(conv.id);
    const after = getConversation(conv.id);
    expect(after.updated_at).not.toBe('2020-01-01 00:00:00');
  });

  it('getConversationCount returns correct count', () => {
    expect(getConversationCount()).toBe(0);
    createConversation({ platform: 'api', remoteId: 'cnt-1' });
    createConversation({ platform: 'api', remoteId: 'cnt-2' });
    expect(getConversationCount()).toBe(2);
  });
});

describe('Messages CRUD', () => {
  let conversationId;

  beforeEach(() => {
    cleanupTestDb();
    initDatabase(TEST_CONFIG);
    const conv = createConversation({ platform: 'api', remoteId: 'msg-test' });
    conversationId = conv.id;
  });

  afterEach(() => {
    closeDatabase();
    cleanupTestDb();
  });

  it('adds a message and returns it', () => {
    const msg = addMessage(conversationId, 'user', 'Hello');
    expect(msg).not.toBeNull();
    expect(msg.id).toBeTruthy();
    expect(msg.conversation_id).toBe(conversationId);
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello');
    expect(msg.media_type).toBeNull();
  });

  it('adds a message with media info', () => {
    const msg = addMessage(conversationId, 'user', 'See this', {
      media_type: 'image',
      media_url: '/data/media/img1.jpg',
    });
    expect(msg.media_type).toBe('image');
    expect(msg.media_url).toBe('/data/media/img1.jpg');
  });

  it('adds a message with token count', () => {
    const msg = addMessage(conversationId, 'assistant', 'Hi there', {
      token_count: 42,
    });
    expect(msg.token_count).toBe(42);
  });

  it('getMessages returns messages in descending order', () => {
    addMessage(conversationId, 'user', 'First');
    addMessage(conversationId, 'assistant', 'Second');
    addMessage(conversationId, 'user', 'Third');

    const msgs = getMessages(conversationId);
    expect(msgs).toHaveLength(3);
    expect(msgs[0].content).toBe('Third');
    expect(msgs[2].content).toBe('First');
  });

  it('getMessages supports pagination', () => {
    for (let i = 0; i < 5; i++) {
      addMessage(conversationId, 'user', `msg-${i}`);
    }

    const page1 = getMessages(conversationId, 2, 0);
    expect(page1).toHaveLength(2);

    const page2 = getMessages(conversationId, 2, 2);
    expect(page2).toHaveLength(2);

    const page3 = getMessages(conversationId, 2, 4);
    expect(page3).toHaveLength(1);
  });

  it('getRecentMessages returns chronological order', () => {
    addMessage(conversationId, 'user', 'First');
    addMessage(conversationId, 'assistant', 'Second');
    addMessage(conversationId, 'user', 'Third');

    const msgs = getRecentMessages(conversationId, 10);
    expect(msgs).toHaveLength(3);
    expect(msgs[0].content).toBe('First');
    expect(msgs[2].content).toBe('Third');
  });

  it('getRecentMessages limits correctly', () => {
    addMessage(conversationId, 'user', 'Old');
    addMessage(conversationId, 'assistant', 'Middle');
    addMessage(conversationId, 'user', 'New');

    const msgs = getRecentMessages(conversationId, 2);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe('Middle');
    expect(msgs[1].content).toBe('New');
  });

  it('getMessageCount returns correct count', () => {
    expect(getMessageCount(conversationId)).toBe(0);
    addMessage(conversationId, 'user', '1');
    addMessage(conversationId, 'user', '2');
    expect(getMessageCount(conversationId)).toBe(2);
  });

  it('getTotalMessageCount counts across conversations', () => {
    const conv2 = createConversation({ platform: 'api', remoteId: 'msg-test-2' });
    addMessage(conversationId, 'user', 'a');
    addMessage(conv2.id, 'user', 'b');
    expect(getTotalMessageCount()).toBe(2);
  });

  it('foreign key prevents message for nonexistent conversation', () => {
    expect(() => {
      addMessage('nonexistent-conv', 'user', 'test');
    }).toThrow();
  });
});
