import { getDatabase } from './database.js';

/**
 * Get a single setting value. Returns string or null.
 */
export function getSetting(key) {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

/**
 * Get a setting as integer.
 */
export function getSettingInt(key, fallback = 0) {
  const val = getSetting(key);
  if (val === null) return fallback;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Get a setting as boolean (truthy: '1', 'true', 'yes').
 */
export function getSettingBool(key, fallback = false) {
  const val = getSetting(key);
  if (val === null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(val.toLowerCase());
}

/**
 * Set a single setting value.
 */
export function setSetting(key, value) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
  `).run(key, String(value));
}

/**
 * Get all settings as a key-value object.
 */
export function getAllSettings() {
  const db = getDatabase();
  const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all();
  const result = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

/**
 * Get multiple settings by key array. Returns object.
 */
export function getSettingsBulk(keys) {
  const db = getDatabase();
  const placeholders = keys.map(() => '?').join(',');
  const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`).all(...keys);
  const result = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

/**
 * Set multiple settings in a transaction.
 */
export function setSettingsBulk(settings) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
  `);

  const run = db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      stmt.run(key, String(value));
    }
  });

  run();
}

/**
 * Get delay settings resolved: global defaults with per-conversation overrides.
 * Returns { replyDelayMin, replyDelayMax } in ms.
 * Enforces minimum 3000ms.
 */
export function getDelaySettings(conversation = null) {
  const globalMin = getSettingInt('reply_delay_min', 3000);
  const globalMax = getSettingInt('reply_delay_max', 8000);

  let min = conversation?.reply_delay_min ?? globalMin;
  let max = conversation?.reply_delay_max ?? globalMax;

  // Enforce minimum 3 seconds
  if (min < 3000) min = 3000;
  if (max < min) max = min;

  return { replyDelayMin: min, replyDelayMax: max };
}

/**
 * Get presence simulation settings.
 */
export function getPresenceSettings() {
  return {
    enabled: getSettingBool('presence_enabled', true),
    readDelay: getSettingInt('presence_read_delay', 1500),
    typingSpeed: getSettingInt('presence_typing_speed', 40),
    minTyping: getSettingInt('presence_min_typing', 2000),
    maxTyping: getSettingInt('presence_max_typing', 10000),
    idleAfterSend: getSettingInt('presence_idle_after_send', 3000),
  };
}
