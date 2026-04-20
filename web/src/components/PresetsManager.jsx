import { useState, useEffect } from 'react';
import { getPresets, createPreset, updatePreset, deletePreset } from '../api/client.js';

const TONES = ['professional', 'friendly', 'casual', 'playful'];
const FLIRTS = ['none', 'subtle', 'moderate', 'high'];

const EMPTY_PRESET = {
  name: '',
  system_prompt: '',
  tone: 'friendly',
  flirt: 'none',
  temperature: 0.7,
  max_tokens: 1000,
  reply_delay_min: null,
  reply_delay_max: null,
  is_default: 0,
};

export default function PresetsManager() {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // preset obj or EMPTY for new
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    try {
      const data = await getPresets();
      setPresets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleNew = () => {
    setEditing({ ...EMPTY_PRESET });
    setError(null);
    setSaved(false);
  };

  const handleEdit = (preset) => {
    setEditing({ ...preset });
    setError(null);
    setSaved(false);
  };

  const handleCancel = () => {
    setEditing(null);
    setError(null);
    setSaved(false);
  };

  const handleChange = (key, value) => {
    setEditing(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setError(null);
    try {
      if (editing.id) {
        await updatePreset(editing.id, editing);
      } else {
        await createPreset(editing);
      }
      setSaved(true);
      await load();
      setTimeout(() => setEditing(null), 600);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (deleting === id) {
      // Second click → confirm
      try {
        await deletePreset(id);
        setDeleting(null);
        if (editing?.id === id) setEditing(null);
        await load();
      } catch (err) {
        setError(err.message);
        setDeleting(null);
      }
    } else {
      setDeleting(id);
      setTimeout(() => setDeleting(null), 3000); // auto-cancel
    }
  };

  if (loading) return <div className="presets-manager">Loading presets…</div>;

  return (
    <div className="presets-manager">
      <div className="presets-header">
        <h3>Presets / Personas</h3>
        <button className="btn-primary btn-sm" onClick={handleNew}>+ New Preset</button>
      </div>

      {error && <div className="settings-error">{error}</div>}

      {/* Preset list */}
      {!editing && (
        <div className="presets-list">
          {presets.length === 0 && <div className="presets-empty">No presets created yet</div>}
          {presets.map(p => (
            <div key={p.id} className="preset-card">
              <div className="preset-card-header">
                <span className="preset-name">
                  {p.name}
                  {p.is_default ? <span className="preset-default-badge">Default</span> : null}
                </span>
                <div className="preset-actions">
                  <button className="btn-ghost btn-sm" onClick={() => handleEdit(p)}>Edit</button>
                  <button
                    className={`btn-ghost btn-sm btn-danger ${deleting === p.id ? 'confirm' : ''}`}
                    onClick={() => handleDelete(p.id)}
                  >
                    {deleting === p.id ? 'Confirm?' : 'Delete'}
                  </button>
                </div>
              </div>
              <div className="preset-card-meta">
                <span>Tone: {p.tone}</span>
                <span>Flirt: {p.flirt}</span>
                <span>Temp: {p.temperature}</span>
                <span>Tokens: {p.max_tokens}</span>
              </div>
              {p.system_prompt && (
                <div className="preset-card-prompt">
                  {p.system_prompt.length > 120
                    ? p.system_prompt.slice(0, 120) + '…'
                    : p.system_prompt}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create form */}
      {editing && (
        <div className="preset-form">
          <div className="preset-form-title">
            {editing.id ? `Edit: ${editing.name}` : 'New Preset'}
          </div>

          {saved && <div className="settings-saved">Saved!</div>}

          <div className="settings-form">
            <label>
              Name
              <input type="text" value={editing.name} onChange={e => handleChange('name', e.target.value)} />
            </label>

            <label>
              System Prompt
              <textarea rows={5} value={editing.system_prompt || ''} onChange={e => handleChange('system_prompt', e.target.value)} />
            </label>

            <label>
              Tone
              <select value={editing.tone} onChange={e => handleChange('tone', e.target.value)}>
                {TONES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            <label>
              Flirt Level
              <select value={editing.flirt} onChange={e => handleChange('flirt', e.target.value)}>
                {FLIRTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>

            <label>
              Temperature ({editing.temperature})
              <input type="range" min="0" max="2" step="0.1" value={editing.temperature ?? 0.7}
                onChange={e => handleChange('temperature', parseFloat(e.target.value))} />
            </label>

            <label>
              Max Tokens
              <input type="number" min="1" max="16000" value={editing.max_tokens ?? 1000}
                onChange={e => handleChange('max_tokens', parseInt(e.target.value) || 1000)} />
            </label>

            <label>
              Reply Delay Min (ms, min 3000)
              <input type="number" min="3000" value={editing.reply_delay_min ?? ''}
                placeholder="Use global default"
                onChange={e => handleChange('reply_delay_min', e.target.value ? parseInt(e.target.value) : null)} />
            </label>

            <label>
              Reply Delay Max (ms, min 3000)
              <input type="number" min="3000" value={editing.reply_delay_max ?? ''}
                placeholder="Use global default"
                onChange={e => handleChange('reply_delay_max', e.target.value ? parseInt(e.target.value) : null)} />
            </label>

            <label className="toggle-label">
              <input type="checkbox" checked={editing.is_default === 1}
                onChange={e => handleChange('is_default', e.target.checked ? 1 : 0)} />
              Default preset for new conversations
            </label>

            <div className="preset-form-buttons">
              <button className="save-btn" onClick={handleSave}>
                {editing.id ? 'Update' : 'Create'}
              </button>
              <button className="btn-ghost" onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
