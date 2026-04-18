import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { runMigrations } from './schema.js';

let db = null;

/**
 * Initialize SQLite database with WAL mode and foreign keys.
 * Creates parent directories if missing.
 * Runs schema migrations (creates tables, indexes).
 */
export function initDatabase(config) {
  const dbPath = config.databasePath;

  // Ensure parent directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  db = new Database(dbPath);

  // Performance and integrity pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Bootstrap metadata table — schema version tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS _meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Run full schema migrations (tables, indexes, version bump)
  runMigrations(db);

  return db;
}

/**
 * Get the current database instance. Returns null if not initialized.
 */
export function getDatabase() {
  return db;
}

/**
 * Close the database connection cleanly.
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
