import { getDatabase } from './database.js';

/**
 * Add a message to a conversation. Returns the inserted row.
 */
export function addMessage(conversationId, role, content, opts = {}) {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO messages (conversation_id, role, content, direction, media_type, media_url, media_path, media_mime_type, media_size_bytes, media_metadata, token_count, platform_message_id, delivery_status, delivery_error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const direction = opts.direction ?? (role === 'user' ? 'inbound' : 'outbound');
  const deliveryStatus = opts.delivery_status ?? (direction === 'outbound' ? 'queued' : null);

  const info = stmt.run(
    conversationId,
    role,
    content,
    direction,
    opts.media_type ?? null,
    opts.media_url ?? null,
    opts.media_path ?? null,
    opts.media_mime_type ?? null,
    opts.media_size_bytes ?? null,
    opts.media_metadata ? JSON.stringify(opts.media_metadata) : null,
    opts.token_count ?? null,
    opts.platform_message_id ?? null,
    deliveryStatus,
    opts.delivery_error ?? null,
  );

  return db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);
}

/**
 * Update delivery status for a message.
 */
export function updateDeliveryStatus(messageId, status, error = null) {
  const db = getDatabase();
  db.prepare(
    'UPDATE messages SET delivery_status = ?, delivery_error = ? WHERE id = ?'
  ).run(status, error, messageId);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) ?? null;
}

/**
 * Update platform_message_id after successful send.
 */
export function updatePlatformMessageId(messageId, platformMessageId) {
  const db = getDatabase();
  db.prepare(
    'UPDATE messages SET platform_message_id = ? WHERE id = ?'
  ).run(platformMessageId, messageId);
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

/**
 * Update media fields on a message after async download completes.
 * @param {number} messageId
 * @param {object} media — { media_path, media_mime_type, media_size_bytes }
 */
export function updateMessageMedia(messageId, media) {
  const db = getDatabase();
  db.prepare(`
    UPDATE messages
    SET media_path = ?, media_mime_type = ?, media_size_bytes = ?
    WHERE id = ?
  `).run(
    media.media_path ?? null,
    media.media_mime_type ?? null,
    media.media_size_bytes ?? null,
    messageId,
  );
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) ?? null;
}

/**
 * Insert a record into media_metadata for enriched media info.
 */
export function addMediaMetadata(messageId, metadata) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO media_metadata (
      message_id, media_type, mime_type, file_size, file_path,
      original_url, thumbnail_path, transcription, analysis,
      duration_seconds, width, height
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    messageId,
    metadata.media_type ?? null,
    metadata.mime_type ?? null,
    metadata.file_size ?? null,
    metadata.file_path ?? null,
    metadata.original_url ?? null,
    metadata.thumbnail_path ?? null,
    metadata.transcription ?? null,
    metadata.analysis ?? null,
    metadata.duration_seconds ?? null,
    metadata.width ?? null,
    metadata.height ?? null,
  );

  return db.prepare('SELECT * FROM media_metadata WHERE id = ?').get(info.lastInsertRowid);
}

/**
 * Get media metadata for a message.
 */
export function getMediaMetadata(messageId) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM media_metadata WHERE message_id = ?').get(messageId) ?? null;
}
