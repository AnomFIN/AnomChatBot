import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../api/client.js';

const TONES = ['professional', 'friendly', 'casual', 'playful'];
const FLIRTS = ['none', 'subtle', 'moderate', 'high'];

export default function SettingsPanel({ conversationId, onClose }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!conversationId) return;
    setError(null);
    setSaved(false);
    getSettings(conversationId)
      .then(setSettings)
      .catch(err => setError(err.message));
  }, [conversationId]);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateSettings(conversationId, settings);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!conversationId) return null;

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h3>Conversation Settings</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      {error && <div className="settings-error">{error}</div>}
      {saved && <div className="settings-saved">Settings saved</div>}

      {!settings ? (
        <div className="settings-loading">Loading…</div>
      ) : (
        <div className="settings-form">
          <label>
            Display Name
            <input
              type="text"
              value={settings.display_name || ''}
              onChange={e => handleChange('display_name', e.target.value)}
            />
          </label>

          <label>
            System Prompt
            <textarea
              rows={4}
              value={settings.system_prompt || ''}
              onChange={e => handleChange('system_prompt', e.target.value)}
            />
          </label>

          <label>
            Tone
            <select
              value={settings.tone || 'friendly'}
              onChange={e => handleChange('tone', e.target.value)}
            >
              {TONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label>
            Flirt Level
            <select
              value={settings.flirt || 'none'}
              onChange={e => handleChange('flirt', e.target.value)}
            >
              {FLIRTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>

          <label>
            Temperature ({settings.temperature})
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature ?? 0.7}
              onChange={e => handleChange('temperature', parseFloat(e.target.value))}
            />
          </label>

          <label>
            Max Tokens
            <input
              type="number"
              min="1"
              max="16000"
              value={settings.max_tokens ?? 1000}
              onChange={e => handleChange('max_tokens', parseInt(e.target.value) || 1000)}
            />
          </label>

          <label>
            Max History
            <input
              type="number"
              min="1"
              max="500"
              value={settings.max_history ?? 50}
              onChange={e => handleChange('max_history', parseInt(e.target.value) || 50)}
            />
          </label>

          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.auto_reply === 1}
              onChange={e => handleChange('auto_reply', e.target.checked ? 1 : 0)}
            />
            Auto-reply enabled
          </label>

          <button className="save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}
