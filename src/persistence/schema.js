/**
 * Database schema and migrations.
 * All tables use CREATE TABLE IF NOT EXISTS for idempotent startup.
 */

export function runMigrations(db) {
  // ── conversations ──────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      remote_id TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      system_prompt TEXT NOT NULL DEFAULT '',
      tone TEXT NOT NULL DEFAULT 'friendly',
      flirt TEXT NOT NULL DEFAULT 'none',
      temperature REAL NOT NULL DEFAULT 0.7,
      max_tokens INTEGER NOT NULL DEFAULT 1000,
      max_history INTEGER NOT NULL DEFAULT 50,
      auto_reply INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(platform, remote_id)
    )
  `);

  // ── messages ───────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      media_type TEXT,
      media_url TEXT,
      token_count INTEGER,
      platform_message_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── admin_logs ─────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      details TEXT,
      source TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── transport_status ───────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS transport_status (
      name TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      details TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── indexes ────────────────────────────────────────────────────────────
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id, created_at)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_platform
      ON conversations(platform, remote_id)
  `);

  // ── update schema version ──────────────────────────────────────────────
  db.prepare(`
    INSERT OR REPLACE INTO _meta (key, value, updated_at)
    VALUES ('schema_version', '1', datetime('now'))
  `).run();
}
