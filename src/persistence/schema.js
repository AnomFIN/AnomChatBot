import { randomUUID } from 'node:crypto';

/**
 * Database schema and migrations.
 * All tables use CREATE TABLE IF NOT EXISTS for idempotent startup.
 * Schema v2: delivery tracking, presets, settings, media metadata, presence/delay config.
 */

export function runMigrations(db) {
  const schemaVersion = getSchemaVersion(db);

  // ── v1: Base tables ────────────────────────────────────────────────────
  runV1(db);

  // ── v2: Delivery tracking, presets, settings, extended fields ──────────
  if (schemaVersion < 2) {
    runV2(db);
  }

  // ── v3: per-conversation toggle flags (AI source + delay source) ─────
  if (schemaVersion < 3) {
    runV3(db);
  }

  // ── v4: per-conversation AI history mode (partial/full) ──────────────
  if (schemaVersion < 4) {
    runV4(db);
  }

  // ── v5: AI approach/follow-up feature ────────────────────────────────
  if (schemaVersion < 5) {
    runV5(db);
  }

  // ── update schema version ──────────────────────────────────────────────
  db.prepare(`
    INSERT OR REPLACE INTO _meta (key, value, updated_at)
    VALUES ('schema_version', '5', datetime('now'))
  `).run();
}

function getSchemaVersion(db) {
  try {
    const row = db.prepare("SELECT value FROM _meta WHERE key = 'schema_version'").get();
    return row ? parseInt(row.value, 10) : 0;
  } catch {
    return 0;
  }
}

// ── Schema v1 (original) ───────────────────────────────────────────────────

function runV1(db) {
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      details TEXT,
      source TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS transport_status (
      name TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      details TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id, created_at)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_platform
      ON conversations(platform, remote_id)
  `);
}

// ── Schema v2 (delivery tracking, presets, settings, extended fields) ──────

function runV2(db) {
  // Helper: add column if it doesn't exist
  function addColumn(table, column, definition) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch {
      // Column already exists — ignore
    }
  }

  // ── Extend conversations ───────────────────────────────────────────────
  addColumn('conversations', 'first_message_sent_manually', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('conversations', 'preset_id', 'TEXT');
  addColumn('conversations', 'ai_provider', 'TEXT');
  addColumn('conversations', 'ai_base_url', 'TEXT');
  addColumn('conversations', 'ai_model', 'TEXT');
  addColumn('conversations', 'profile_photo_url', 'TEXT');
  addColumn('conversations', 'reply_delay_min', 'INTEGER');
  addColumn('conversations', 'reply_delay_max', 'INTEGER');
  addColumn('conversations', 'last_message_at', "TEXT");

  // ── Extend messages ────────────────────────────────────────────────────
  addColumn('messages', 'direction', "TEXT NOT NULL DEFAULT 'inbound'");
  addColumn('messages', 'delivery_status', "TEXT");
  addColumn('messages', 'delivery_error', 'TEXT');
  addColumn('messages', 'media_path', 'TEXT');
  addColumn('messages', 'media_mime_type', 'TEXT');
  addColumn('messages', 'media_size_bytes', 'INTEGER');
  addColumn('messages', 'media_metadata', 'TEXT');

  // ── presets table ──────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      system_prompt TEXT NOT NULL DEFAULT '',
      tone TEXT NOT NULL DEFAULT 'friendly',
      flirt TEXT NOT NULL DEFAULT 'none',
      temperature REAL NOT NULL DEFAULT 0.7,
      max_tokens INTEGER NOT NULL DEFAULT 1000,
      reply_delay_min INTEGER,
      reply_delay_max INTEGER,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── settings table (global key-value) ──────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── media_metadata table ───────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS media_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL REFERENCES messages(id),
      media_type TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      file_path TEXT,
      original_url TEXT,
      thumbnail_path TEXT,
      transcription TEXT,
      analysis TEXT,
      duration_seconds REAL,
      width INTEGER,
      height INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_media_metadata_message
      ON media_metadata(message_id)
  `);

  // ── Seed built-in presets (only if presets table is empty) ──────────────
  const presetCount = db.prepare('SELECT COUNT(*) as count FROM presets').get().count;
  if (presetCount === 0) {
    seedPresets(db);
  }

  // ── Seed default settings (only if settings table is empty) ────────────
  const settingCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;
  if (settingCount === 0) {
    seedSettings(db);
  }
}

function runV3(db) {
  function addColumn(table, column, definition) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch {
      // Column already exists — ignore
    }
  }

  addColumn('conversations', 'use_global_ai', 'INTEGER NOT NULL DEFAULT 1');
  addColumn('conversations', 'use_global_delay', 'INTEGER NOT NULL DEFAULT 1');
}

function runV4(db) {
  try {
    db.exec("ALTER TABLE conversations ADD COLUMN ai_history_mode TEXT NOT NULL DEFAULT 'partial'");
  } catch {
    // Column already exists — ignore
  }
}

function runV5(db) {
  function addColumn(table, column, definition) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch {
      // Column already exists — ignore
    }
  }

  // AI approach/follow-up feature
  addColumn('conversations', 'ai_approach_enabled', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('conversations', 'ai_approach_max_messages', 'INTEGER NOT NULL DEFAULT 3');
  addColumn('conversations', 'ai_approach_delay_minutes', 'INTEGER NOT NULL DEFAULT 10');
}

function seedPresets(db) {
  const insert = db.prepare(`
    INSERT INTO presets (id, name, system_prompt, tone, flirt, temperature, max_tokens, reply_delay_min, reply_delay_max, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const presets = [
    {
      name: 'Myyntitykki',
      system_prompt: 'Olet huippumyyjä. Vastaat aina innostuneesti ja myönteisesti. Löydät jokaisesta tilanteesta myyntimahdollisuuden. Olet vakuuttava mutta et painostava. Käytät suomea.',
      tone: 'playful', flirt: 'subtle', temperature: 0.9, max_tokens: 1000,
      reply_delay_min: 4000, reply_delay_max: 8000, is_default: 0,
    },
    {
      name: 'Flirttailija',
      system_prompt: 'Olet charmantti ja flirttaileva keskustelukumppani. Olet älykäs, hauska ja hieman mysteerinen. Käytät suomea ja olet luonnollisen leikkisä.',
      tone: 'playful', flirt: 'high', temperature: 0.8, max_tokens: 1000,
      reply_delay_min: 5000, reply_delay_max: 12000, is_default: 0,
    },
    {
      name: 'Terapeutti',
      system_prompt: 'Olet empaattinen ja ymmärtäväinen keskustelukumppani. Kuuntelet tarkasti, kysyt avoimia kysymyksiä ja tuet toista ihmistä. Et anna lääketieteellisiä neuvoja. Käytät suomea.',
      tone: 'friendly', flirt: 'none', temperature: 0.6, max_tokens: 1200,
      reply_delay_min: 6000, reply_delay_max: 15000, is_default: 0,
    },
    {
      name: 'Ideoija',
      system_prompt: 'Olet luova ideakone. Tuotat aina useita vaihtoehtoja ja ajattelet laatikon ulkopuolelta. Olet innostunut ja energinen. Käytät suomea.',
      tone: 'casual', flirt: 'none', temperature: 1.0, max_tokens: 1500,
      reply_delay_min: 3000, reply_delay_max: 7000, is_default: 0,
    },
    {
      name: 'Neutraali',
      system_prompt: 'Olet avulias ja neutraali assistentti. Vastaat selkeästi ja ytimekkäästi. Käytät suomea.',
      tone: 'professional', flirt: 'none', temperature: 0.7, max_tokens: 1000,
      reply_delay_min: 3000, reply_delay_max: 6000, is_default: 1,
    },
  ];

  const insertMany = db.transaction(() => {
    for (const p of presets) {
      insert.run(randomUUID(), p.name, p.system_prompt, p.tone, p.flirt, p.temperature, p.max_tokens, p.reply_delay_min, p.reply_delay_max, p.is_default);
    }
  });

  insertMany();
}

function seedSettings(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);

  const defaults = [
    ['reply_delay_min', '3000'],
    ['reply_delay_max', '8000'],
    ['presence_enabled', '1'],
    ['presence_read_delay', '1500'],
    ['presence_typing_speed', '40'],
    ['presence_min_typing', '2000'],
    ['presence_max_typing', '10000'],
    ['presence_idle_after_send', '3000'],
  ];

  const insertMany = db.transaction(() => {
    for (const [key, value] of defaults) {
      insert.run(key, value);
    }
  });

  insertMany();
}
