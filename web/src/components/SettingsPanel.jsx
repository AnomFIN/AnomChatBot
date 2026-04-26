import { useState, useEffect } from 'react';
import { getSettings, updateSettings, getPresets, clearConversationHistory } from '../api/client.js';

const TONES = ['professional', 'friendly', 'casual', 'playful'];
const FLIRTS = ['none', 'subtle', 'moderate', 'high'];

export default function SettingsPanel({ conversationId, onClose }) {
  const [settings, setSettings] = useState(null);
  const [presets, setPresets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyKeepLast, setHistoryKeepLast] = useState(20);

  useEffect(() => {
    if (!conversationId) return;
    setError(null);
    setSaved(false);
    getSettings(conversationId)
      .then(data => setSettings(data))
      .catch(err => setError(err.message));
    getPresets()
      .then(setPresets)
      .catch(() => {}); // Non-critical
  }, [conversationId]);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handlePresetApply = (presetId) => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) {
      handleChange('preset_id', null);
      return;
    }

    setSettings(prev => ({
      ...prev,
      preset_id: preset.id,
      system_prompt: preset.system_prompt,
      tone: preset.tone,
      flirt: preset.flirt,
      temperature: preset.temperature,
      max_tokens: preset.max_tokens,
      reply_delay_min: preset.reply_delay_min,
      reply_delay_max: preset.reply_delay_max,
    }));
    setSaved(false);
  };

  const handleClearAI = () => {
    setSettings(prev => ({
      ...prev,
      ai_provider: null,
      ai_base_url: null,
      ai_model: null,
      use_global_ai: 1,
    }));
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

  const handleClearAllHistory = async () => {
    if (!window.confirm('Delete ALL messages in this chat history? This cannot be undone.')) {
      return;
    }

    setHistoryBusy(true);
    setError(null);
    try {
      await clearConversationHistory(conversationId, { mode: 'all' });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setHistoryBusy(false);
    }
  };

  const handleClearPartialHistory = async () => {
    const keep = Math.max(0, parseInt(historyKeepLast, 10) || 0);
    setHistoryBusy(true);
    setError(null);
    try {
      await clearConversationHistory(conversationId, { mode: 'partial', keep_last: keep });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setHistoryBusy(false);
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
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={(settings.use_global_ai ?? 1) === 1}
              onChange={e => handleChange('use_global_ai', e.target.checked ? 1 : 0)}
            />
            Use global AI settings
          </label>

          {/* Preset selector */}
          <label>
            Preset / Persona
            <select
              value={settings.preset_id || ''}
              onChange={e => handlePresetApply(e.target.value || null)}
            >
              <option value="">— No preset —</option>
              {presets.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.is_default ? ' (default)' : ''}</option>
              ))}
            </select>
            <span className="field-hint">Applying a preset overwrites prompt, tone, flirt, temp, tokens, delays</span>
          </label>

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
            <span className="field-hint">Used when AI history mode is Partial.</span>
          </label>

          <label>
            AI History Mode
            <select
              value={settings.ai_history_mode || 'partial'}
              onChange={e => handleChange('ai_history_mode', e.target.value)}
            >
              <option value="partial">Partial (last N messages)</option>
              <option value="full">Full (entire chat history)</option>
            </select>
            <span className="field-hint">Controls how much chat data is sent to AI together with this system prompt.</span>
          </label>

          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.auto_reply === 1}
              onChange={e => handleChange('auto_reply', e.target.checked ? 1 : 0)}
            />
            Auto-reply enabled
          </label>

          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.ai_approach_enabled === 1}
              onChange={e => handleChange('ai_approach_enabled', e.target.checked ? 1 : 0)}
            />
            Allow AI to approach (follow-up when user is quiet)
          </label>

          {/* AI approach parameters (only show when enabled) */}
          {settings.ai_approach_enabled === 1 && (
            <>
              <div className="settings-section-title">AI Approach Settings</div>

              <label>
                Max follow-up messages
                <select
                  value={settings.ai_approach_max_messages ?? 3}
                  onChange={e => handleChange('ai_approach_max_messages', parseInt(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <option key={num} value={num}>{num} message{num !== 1 ? 's' : ''}</option>
                  ))}
                </select>
                <span className="field-hint">How many follow-up messages AI can send when user doesn't reply</span>
              </label>

              <label>
                Delay between approaches (minutes)
                <select
                  value={settings.ai_approach_delay_minutes ?? 10}
                  onChange={e => handleChange('ai_approach_delay_minutes', parseInt(e.target.value))}
                >
                  {[5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440].map(minutes => (
                    <option key={minutes} value={minutes}>
                      {minutes < 60 ? `${minutes} min` : 
                       minutes < 1440 ? `${Math.floor(minutes/60)}h ${minutes%60 > 0 ? `${minutes%60}m` : ''}`.trim() :
                       `${Math.floor(minutes/1440)} day${Math.floor(minutes/1440) !== 1 ? 's' : ''}`}
                    </option>
                  ))}
                </select>
                <span className="field-hint">Time to wait before sending next follow-up message</span>
              </label>
            </>
          )}

          <label className="toggle-label">
            <input
              type="checkbox"
              checked={(settings.use_global_delay ?? 1) === 1}
              onChange={e => handleChange('use_global_delay', e.target.checked ? 1 : 0)}
            />
            Use global reply delay
          </label>

          {/* Reply delay overrides */}
          {(settings.use_global_delay ?? 1) !== 1 && (
            <>
              <div className="settings-section-title">Reply Delay Override</div>

              <label>
                Min Delay (ms)
                <input
                  type="number"
                  min="3000"
                  value={settings.reply_delay_min ?? ''}
                  placeholder="Use global default"
                  onChange={e => handleChange('reply_delay_min', e.target.value ? parseInt(e.target.value) : null)}
                />
              </label>

              <label>
                Max Delay (ms)
                <input
                  type="number"
                  min="3000"
                  value={settings.reply_delay_max ?? ''}
                  placeholder="Use global default"
                  onChange={e => handleChange('reply_delay_max', e.target.value ? parseInt(e.target.value) : null)}
                />
              </label>
            </>
          )}

          {/* Per-conversation AI override */}
          {(settings.use_global_ai ?? 1) !== 1 && (
            <>
              <div className="settings-section-title">Local AI Override</div>

              <span className="field-hint">
                Override the global AI provider for this conversation.
                Leave empty to use the global provider. Useful for LM Studio / Ollama testing.
              </span>

              <label>
                Provider
                <select
                  value={settings.ai_provider || ''}
                  onChange={e => handleChange('ai_provider', e.target.value || null)}
                >
                  <option value="">— Use global —</option>
                  <option value="openai">OpenAI</option>
                  <option value="openai_compatible">OpenAI-Compatible (LM Studio, Ollama, etc.)</option>
                </select>
              </label>

              <label>
                Base URL
                <input
                  type="text"
                  value={settings.ai_base_url || ''}
                  placeholder="e.g. http://localhost:1234/v1"
                  onChange={e => handleChange('ai_base_url', e.target.value || null)}
                />
                <span className="field-hint">LM Studio: http://localhost:1234/v1 · Ollama: http://localhost:11434/v1</span>
              </label>

              <label>
                Model
                <input
                  type="text"
                  value={settings.ai_model || ''}
                  placeholder="e.g. local-model"
                  onChange={e => handleChange('ai_model', e.target.value || null)}
                />
              </label>

              <button className="btn-ghost btn-sm btn-danger" onClick={handleClearAI}>
                Clear AI Override
              </button>
            </>
          )}

          <div className="settings-section-title">Chat History Cleanup</div>

          <label>
            Keep latest N messages
            <input
              type="number"
              min="0"
              max="10000"
              value={historyKeepLast}
              onChange={e => setHistoryKeepLast(parseInt(e.target.value, 10) || 0)}
            />
          </label>

          <div className="history-actions">
            <button
              className="btn-ghost btn-sm"
              onClick={handleClearPartialHistory}
              disabled={historyBusy}
            >
              {historyBusy ? 'Working…' : 'Delete older, keep latest'}
            </button>
            <button
              className="btn-ghost btn-sm btn-danger"
              onClick={handleClearAllHistory}
              disabled={historyBusy}
            >
              {historyBusy ? 'Working…' : 'Delete all history'}
            </button>
          </div>

          <button className="save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}
