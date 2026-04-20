import { useState, useEffect } from 'react';
import { getSettings, updateSettings, getPresets } from '../api/client.js';

const TONES = ['professional', 'friendly', 'casual', 'playful'];
const FLIRTS = ['none', 'subtle', 'moderate', 'high'];

export default function SettingsPanel({ conversationId, onClose }) {
  const [settings, setSettings] = useState(null);
  const [presets, setPresets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [showAI, setShowAI] = useState(false);

  useEffect(() => {
    if (!conversationId) return;
    setError(null);
    setSaved(false);
    setShowAI(false);
    getSettings(conversationId)
      .then(data => {
        setSettings(data);
        setShowAI(!!(data.ai_provider || data.ai_base_url || data.ai_model));
      })
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
    }));
    setShowAI(false);
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
          </label>

          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.auto_reply === 1}
              onChange={e => handleChange('auto_reply', e.target.checked ? 1 : 0)}
            />
            Auto-reply enabled
          </label>

          {/* Reply delay overrides */}
          <div className="settings-section-title">Reply Delay</div>

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

          {/* Per-conversation AI override */}
          <div className="settings-section-title">
            AI Provider Override
            {!showAI && (
              <button className="btn-ghost btn-sm" onClick={() => setShowAI(true)}>Configure</button>
            )}
          </div>

          {showAI && (
            <>
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

          <button className="save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}
