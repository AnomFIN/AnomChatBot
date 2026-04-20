import { useState, useEffect } from 'react';
import { getGlobalSettings, updateGlobalSettings } from '../api/client.js';

export default function GlobalSettings({ status }) {
  const [settings, setSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getGlobalSettings();
      setSettings(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateGlobalSettings(settings);
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!status) return <div className="global-settings">Loading…</div>;

  return (
    <div className="global-settings">
      <h3>System Overview</h3>

      <div className="gs-section">
        <h4>Server</h4>
        <table>
          <tbody>
            <tr><td>Version</td><td>{status.version || '?'}</td></tr>
            <tr><td>Uptime</td><td>{formatUptime(status.uptime)}</td></tr>
            <tr><td>Node.js</td><td>{status.environment?.nodeVersion || '?'}</td></tr>
            <tr><td>Platform</td><td>{status.environment?.platform || '?'}</td></tr>
            <tr><td>Log Level</td><td>{status.environment?.logLevel || '?'}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="gs-section">
        <h4>Database</h4>
        <table>
          <tbody>
            <tr><td>Initialized</td><td>{status.database?.initialized ? 'Yes' : 'No'}</td></tr>
            <tr><td>Conversations</td><td>{status.database?.conversations ?? 0}</td></tr>
            <tr><td>Messages</td><td>{status.database?.messages ?? 0}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="gs-section">
        <h4>AI Provider</h4>
        <table>
          <tbody>
            <tr><td>Provider</td><td>{status.modes?.aiProvider || '?'}</td></tr>
            <tr><td>Model</td><td>{status.ai?.model || '?'}</td></tr>
            <tr><td>Connected</td><td>{status.ai?.connected ? 'Yes' : 'No'}</td></tr>
            {status.ai?.lastError && (
              <tr><td>Last Error</td><td className="text-red">{status.ai.lastError}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="gs-section">
        <h4>WhatsApp</h4>
        <table>
          <tbody>
            <tr><td>Mode</td><td>{status.whatsapp?.mode || status.modes?.whatsappMode || '?'}</td></tr>
            <tr><td>Status</td><td>{status.whatsapp?.status || '?'}</td></tr>
            <tr><td>Details</td><td>{status.whatsapp?.details || '—'}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="gs-section">
        <h4>Telegram</h4>
        <table>
          <tbody>
            <tr><td>Enabled</td><td>{status.modes?.telegramEnabled ? 'Yes' : 'No'}</td></tr>
          </tbody>
        </table>
      </div>

      {status.orchestrator && (
        <div className="gs-section">
          <h4>Orchestrator</h4>
          <table>
            <tbody>
              <tr><td>Pending Replies</td><td>{status.orchestrator.pendingReplies ?? 0}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Editable settings */}
      <h3 className="gs-editable-header">Global Settings</h3>

      {error && <div className="settings-error">{error}</div>}
      {saved && <div className="settings-saved">Settings saved</div>}

      {loadingSettings ? (
        <div>Loading settings…</div>
      ) : settings && (
        <div className="settings-form gs-form">

          <div className="gs-section">
            <h4>AI Provider Override</h4>
            <span className="field-hint">
              Change the global AI provider. These override the .env configuration at runtime.
              API keys are redacted in the UI for security.
            </span>

            <label>
              Provider
              <select
                value={settings.ai_provider || ''}
                onChange={e => handleChange('ai_provider', e.target.value || '')}
              >
                <option value="">— Use .env default —</option>
                <option value="openai">OpenAI</option>
                <option value="openai_compatible">OpenAI-Compatible</option>
              </select>
            </label>

            <label>
              Base URL
              <input
                type="text"
                value={settings.ai_base_url || ''}
                placeholder="e.g. http://localhost:1234/v1"
                onChange={e => handleChange('ai_base_url', e.target.value)}
              />
              <span className="field-hint">
                LM Studio: http://localhost:1234/v1 · Ollama: http://localhost:11434/v1
              </span>
            </label>

            <label>
              Model
              <input
                type="text"
                value={settings.ai_model || ''}
                placeholder="e.g. gpt-4-turbo or local-model"
                onChange={e => handleChange('ai_model', e.target.value)}
              />
            </label>

            <label>
              API Key
              <input
                type="password"
                value={settings.ai_api_key || ''}
                placeholder="Set via .env (redacted for security)"
                onChange={e => handleChange('ai_api_key', e.target.value)}
              />
              <span className="field-hint">
                For local providers (LM Studio, Ollama), any non-empty value works. Key is stored securely and redacted in UI.
              </span>
            </label>
          </div>

          <div className="gs-section">
            <h4>Reply Delay</h4>
            <span className="field-hint">
              Human-like delay before AI replies. Multi-message batching resets the timer on each new message.
            </span>

            <label>
              Min Delay (ms)
              <input type="number" min="3000" value={settings.reply_delay_min || ''}
                placeholder="3000"
                onChange={e => handleChange('reply_delay_min', e.target.value)} />
            </label>

            <label>
              Max Delay (ms)
              <input type="number" min="3000" value={settings.reply_delay_max || ''}
                placeholder="8000"
                onChange={e => handleChange('reply_delay_max', e.target.value)} />
            </label>
          </div>

          <div className="gs-section">
            <h4>Presence Simulation</h4>
            <span className="field-hint">
              Simulates online/typing/read status via Baileys. Does NOT control "last seen" — WhatsApp controls that.
            </span>

            <label className="toggle-label">
              <input type="checkbox"
                checked={settings.presence_enabled === 'true' || settings.presence_enabled === true}
                onChange={e => handleChange('presence_enabled', e.target.checked ? 'true' : 'false')} />
              Enable presence simulation
            </label>

            <label>
              Typing Speed (chars/sec)
              <input type="number" min="1" value={settings.presence_typing_speed || ''}
                placeholder="40"
                onChange={e => handleChange('presence_typing_speed', e.target.value)} />
            </label>

            <label>
              Read Delay (ms)
              <input type="number" min="0" value={settings.presence_read_delay || ''}
                placeholder="1500"
                onChange={e => handleChange('presence_read_delay', e.target.value)} />
            </label>

            <label>
              Min Typing Duration (ms)
              <input type="number" min="0" value={settings.presence_min_typing || ''}
                placeholder="2000"
                onChange={e => handleChange('presence_min_typing', e.target.value)} />
            </label>

            <label>
              Max Typing Duration (ms)
              <input type="number" min="0" value={settings.presence_max_typing || ''}
                placeholder="15000"
                onChange={e => handleChange('presence_max_typing', e.target.value)} />
            </label>

            <label>
              Idle After Send (ms)
              <input type="number" min="0" value={settings.presence_idle_after_send || ''}
                placeholder="5000"
                onChange={e => handleChange('presence_idle_after_send', e.target.value)} />
            </label>
          </div>

          <button className="save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Global Settings'}
          </button>
        </div>
      )}
    </div>
  );
}

function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return '?';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
