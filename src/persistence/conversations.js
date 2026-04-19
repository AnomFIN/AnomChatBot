import { randomUUID } from 'node:crypto';
import { getDatabase } from './database.js';

/**
 * Valid platform values for conversations.
 * 'whatsapp' — added by WhatsApp transport (Phase 5)
 * 'api'      — operator-created via internal API
 */
export const VALID_PLATFORMS = ['whatsapp', 'api'];

/**
 * Create a new conversation. Returns the created row.
 */
export function createConversation({ platform, remoteId, displayName = '', defaults = {} }) {
  const db = getDatabase();
  const id = randomUUID();

  const stmt = db.prepare(`
    INSERT INTO conversations (id, platform, remote_id, display_name, system_prompt, tone, flirt, temperature, max_tokens, max_history, auto_reply)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    platform,
    remoteId,
    displayName,
    defaults.system_prompt ?? '',
    defaults.tone ?? 'friendly',
    defaults.flirt ?? 'none',
    defaults.temperature ?? 0.7,
    defaults.max_tokens ?? 1000,
    defaults.max_history ?? 50,
    defaults.auto_reply ?? 0,
  );

  return getConversation(id);
}

/**
 * Get a conversation by ID. Returns null if not found.
 */
export function getConversation(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) ?? null;
}

/**
 * Get or create a conversation by platform + remote_id.
 * Used by transports when a message arrives from an external source.
 */
export function getOrCreateConversation(platform, remoteId, displayName = '', defaults = {}) {
  const db = getDatabase();
  const existing = db.prepare(
    'SELECT * FROM conversations WHERE platform = ? AND remote_id = ?'
  ).get(platform, remoteId);

  if (existing) return { conversation: existing, created: false };

  const conversation = createConversation({ platform, remoteId, displayName, defaults });
  return { conversation, created: true };
}

/**
 * List all conversations, sorted by updated_at descending.
 */
export function listConversations() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all();
}

/**
 * Update conversation settings. Only updates provided fields.
 * Returns the updated conversation or null if not found.
 */
export function updateConversationSettings(id, settings) {
  const db = getDatabase();

  const allowed = [
    'system_prompt', 'tone', 'flirt', 'temperature',
    'max_tokens', 'max_history', 'auto_reply', 'display_name',
  ];

  const updates = [];
  const values = [];

  for (const key of allowed) {
    if (settings[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(settings[key]);
    }
  }

  if (updates.length === 0) return getConversation(id);

  updates.push("updated_at = datetime('now')");
  values.push(id);

  const sql = `UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`;
  const result = db.prepare(sql).run(...values);

  if (result.changes === 0) return null;
  return getConversation(id);
}

/**
 * Touch updated_at timestamp on a conversation.
 */
export function touchConversation(id) {
  const db = getDatabase();
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(id);
}

/**
 * Get conversation count.
 */
export function getConversationCount() {
  const db = getDatabase();
  return db.prepare('SELECT COUNT(*) as count FROM conversations').get().count;
}
