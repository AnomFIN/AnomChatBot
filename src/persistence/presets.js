import { randomUUID } from 'node:crypto';
import { getDatabase } from './database.js';

/**
 * List all presets, sorted by name.
 */
export function listPresets() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM presets ORDER BY name').all();
}

/**
 * Get a preset by ID. Returns null if not found.
 */
export function getPreset(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM presets WHERE id = ?').get(id) ?? null;
}

/**
 * Get the default preset. Returns null if none marked as default.
 */
export function getDefaultPreset() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM presets WHERE is_default = 1 LIMIT 1').get() ?? null;
}

/**
 * Create a new preset. Returns the created row.
 */
export function createPreset({ name, system_prompt = '', tone = 'friendly', flirt = 'none', temperature = 0.7, max_tokens = 1000, reply_delay_min = null, reply_delay_max = null, is_default = 0 }) {
  const db = getDatabase();
  const id = randomUUID();

  // If setting as default, unset other defaults first
  if (is_default) {
    db.prepare('UPDATE presets SET is_default = 0 WHERE is_default = 1').run();
  }

  db.prepare(`
    INSERT INTO presets (id, name, system_prompt, tone, flirt, temperature, max_tokens, reply_delay_min, reply_delay_max, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, system_prompt, tone, flirt, temperature, max_tokens, reply_delay_min, reply_delay_max, is_default);

  return getPreset(id);
}

/**
 * Update a preset. Only updates provided fields.
 * Returns updated row or null if not found.
 */
export function updatePreset(id, fields) {
  const db = getDatabase();

  const allowed = ['name', 'system_prompt', 'tone', 'flirt', 'temperature', 'max_tokens', 'reply_delay_min', 'reply_delay_max', 'is_default'];
  const updates = [];
  const values = [];

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }

  if (updates.length === 0) return getPreset(id);

  // If setting as default, unset other defaults first
  if (fields.is_default) {
    db.prepare('UPDATE presets SET is_default = 0 WHERE is_default = 1 AND id != ?').run(id);
  }

  updates.push("updated_at = datetime('now')");
  values.push(id);

  const result = db.prepare(`UPDATE presets SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  if (result.changes === 0) return null;

  return getPreset(id);
}

/**
 * Delete a preset by ID. Returns true if deleted.
 */
export function deletePreset(id) {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM presets WHERE id = ?').run(id);
  return result.changes > 0;
}
