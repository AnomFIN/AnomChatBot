import { randomUUID } from 'node:crypto';
import { getDatabase } from './database.js';

/**
 * Valid platform values for conversations.
 * WhatsApp-only transport values — Telegram is admin-only, not a conversation platform.
 */
export const VALID_PLATFORMS = ['whatsapp_baileys', 'whatsapp_cloud'];

/**
 * Create a new conversation. Returns the created row.
 */
export function createConversation({ platform, remoteId, displayName = '', defaults = {} }) {
  const db = getDatabase();
  const id = randomUUID();

  const stmt = db.prepare(`
    INSERT INTO conversations (id, platform, remote_id, display_name, system_prompt, tone, flirt, temperature, max_tokens, max_history, auto_reply, preset_id, first_message_sent_manually, last_message_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
    defaults.auto_reply ?? 1,
    defaults.preset_id ?? null,
    0,
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
 * Find conversation by platform and remote_id.
 */
export function findConversationByRemote(platform, remoteId) {
  const db = getDatabase();
  return db.prepare(
    'SELECT * FROM conversations WHERE platform = ? AND remote_id = ?'
  ).get(platform, remoteId) ?? null;
}

/**
 * List all conversations, sorted by last_message_at descending (with updated_at fallback).
 */
export function listConversations() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM conversations ORDER BY COALESCE(last_message_at, updated_at) DESC').all();
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
    'preset_id', 'ai_provider', 'ai_base_url', 'ai_model',
    'profile_photo_url', 'reply_delay_min', 'reply_delay_max',
    'first_message_sent_manually', 'use_global_ai', 'use_global_delay', 'ai_history_mode',
    'ai_approach_enabled', 'ai_approach_max_messages', 'ai_approach_delay_minutes',
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
 * Touch updated_at and last_message_at timestamps on a conversation.
 */
export function touchConversation(id) {
  const db = getDatabase();
  db.prepare("UPDATE conversations SET updated_at = datetime('now'), last_message_at = datetime('now') WHERE id = ?").run(id);
}

/**
 * Get conversation count.
 */
export function getConversationCount() {
  const db = getDatabase();
  return db.prepare('SELECT COUNT(*) as count FROM conversations').get().count;
}

/**
 * Refresh conversation activity timestamps from current message history.
 * last_message_at becomes latest message timestamp or null if no messages remain.
 */
export function refreshConversationActivityFromMessages(id) {
  const db = getDatabase();
  db.prepare(`
    UPDATE conversations
    SET
      updated_at = datetime('now'),
      last_message_at = (
        SELECT MAX(created_at) FROM messages WHERE conversation_id = ?
      )
    WHERE id = ?
  `).run(id, id);

  return getConversation(id);
}
