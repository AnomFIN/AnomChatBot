import { getDatabase } from './database.js';

/**
 * Add a message to a conversation. Returns the inserted row.
 */
export function addMessage(conversationId, role, content, opts = {}) {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO messages (conversation_id, role, content, media_type, media_url, token_count, platform_message_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    conversationId,
    role,
    content,
    opts.media_type ?? null,
    opts.media_url ?? null,
    opts.token_count ?? null,
    opts.platform_message_id ?? null,
  );

  return db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);
}

/**
 * Get messages for a conversation with pagination.
 * Returns newest first (descending) for display.
 */
export function getMessages(conversationId, limit = 50, offset = 0) {
  const db = getDatabase();
  return db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?'
  ).all(conversationId, limit, offset);
}

/**
 * Get recent messages in chronological order (oldest first).
 * Used for prompt assembly — returns the last N messages in conversation order.
 */
export function getRecentMessages(conversationId, limit = 50) {
  const db = getDatabase();
  // Subquery gets the N newest, outer query re-sorts chronologically
  return db.prepare(`
    SELECT * FROM (
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    ) sub ORDER BY created_at ASC, id ASC
  `).all(conversationId, limit);
}

/**
 * Get message count for a conversation.
 */
export function getMessageCount(conversationId) {
  const db = getDatabase();
  return db.prepare(
    'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?'
  ).get(conversationId).count;
}

/**
 * Get total message count across all conversations.
 */
export function getTotalMessageCount() {
  const db = getDatabase();
  return db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
}
