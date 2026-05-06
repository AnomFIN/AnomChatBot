import { useState, useEffect, useRef } from 'react';
import {
  getGlobalSettings, updateGlobalSettings,
  getBranding, uploadBrandingLogo, resetBrandingLogo,
  uploadBrandingBackground, resetBrandingBackground,
} from '../api/client.js';

const LOGO_ACCEPT = '.png,.jpg,.jpeg,.webp,.svg';
const BG_ACCEPT = '.png,.jpg,.jpeg,.webp';
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const BG_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export default function GlobalSettings({ status }) {
  const [settings, setSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  // Branding state
  const [branding, setBranding] = useState({ logo_url: null, background_url: null });
  const [brandingError, setBrandingError] = useState(null);
  const [brandingUploading, setBrandingUploading] = useState({ logo: false, bg: false });
  const [logoPreview, setLogoPreview] = useState(null);
  const [bgPreview, setBgPreview] = useState(null);
  const logoInputRef = useRef(null);
  const bgInputRef = useRef(null);

  useEffect(() => {
    loadSettings();
    loadBranding();
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

  const loadBranding = async () => {
    try {
      const data = await getBranding();
      setBranding(data);
    } catch {}
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

  const validateBrandingFile = (file, allowedTypes) => {
    if (!allowedTypes.includes(file.type)) {
      return `Unsupported file type: ${file.type}. Allowed: ${allowedTypes.join(', ')}`;
    }
    if (file.size > MAX_SIZE) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: 5 MB`;
    }
    return null;
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBrandingError(null);
    const err = validateBrandingFile(file, LOGO_TYPES);
    if (err) { setBrandingError(err); return; }
    setLogoPreview(URL.createObjectURL(file));
    setBrandingUploading(p => ({ ...p, logo: true }));
    try {
      const data = await uploadBrandingLogo(file);
      setBranding(p => ({ ...p, logo_url: data.url }));
    } catch (err) {
      setBrandingError(err.message);
      setLogoPreview(null);
    } finally {
      setBrandingUploading(p => ({ ...p, logo: false }));
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleLogoReset = async () => {
    setBrandingError(null);
    try {
      await resetBrandingLogo();
      setBranding(p => ({ ...p, logo_url: null }));
      setLogoPreview(null);
    } catch (err) {
      setBrandingError(err.message);
    }
  };

  const handleBgUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBrandingError(null);
    const err = validateBrandingFile(file, BG_TYPES);
    if (err) { setBrandingError(err); return; }
    setBgPreview(URL.createObjectURL(file));
    setBrandingUploading(p => ({ ...p, bg: true }));
    try {
      const data = await uploadBrandingBackground(file);
      setBranding(p => ({ ...p, background_url: data.url }));
    } catch (err) {
      setBrandingError(err.message);
      setBgPreview(null);
    } finally {
      setBrandingUploading(p => ({ ...p, bg: false }));
      if (bgInputRef.current) bgInputRef.current.value = '';
    }
  };

  const handleBgReset = async () => {
    setBrandingError(null);
    try {
      await resetBrandingBackground();
      setBranding(p => ({ ...p, background_url: null }));
      setBgPreview(null);
    } catch (err) {
      setBrandingError(err.message);
    }
  };

  if (!status) return <div className="global-settings">Loading…</div>;

  const currentLogoUrl = logoPreview || branding.logo_url;
  const currentBgUrl = bgPreview || branding.background_url;

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
            <h4>Local AI / LM Studio Settings</h4>
            <span className="field-hint">
              Configure a local AI provider (LM Studio). When enabled, Local AI takes priority over the
              standard AI Provider settings above for all conversations. OpenAI settings remain
              available and will be used again when Local AI is disabled.
            </span>

            <label className="toggle-label">
              <input
                type="checkbox"
                checked={settings.local_ai_enabled === 'true' || settings.local_ai_enabled === true}
                onChange={e => handleChange('local_ai_enabled', e.target.checked ? 'true' : 'false')}
              />
              Enable Local AI
            </label>

            <label>
              Local AI Provider
              <select
                value={settings.local_ai_provider || 'lmstudio'}
                onChange={e => handleChange('local_ai_provider', e.target.value)}
              >
                <option value="lmstudio">LM Studio</option>
              </select>
            </label>

            <label>
              Local AI Base URL
              <input
                type="text"
                value={settings.local_ai_base_url || ''}
                placeholder="http://127.0.0.1:1234/v1"
                onChange={e => handleChange('local_ai_base_url', e.target.value)}
              />
              <span className="field-hint">Default: http://127.0.0.1:1234/v1</span>
            </label>

            <label>
              Local AI Model
              <input
                type="text"
                value={settings.local_ai_model || ''}
                placeholder="e.g. lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF"
                onChange={e => handleChange('local_ai_model', e.target.value)}
              />
            </label>

            <label className="toggle-label">
              <input
                type="checkbox"
                checked={settings.local_ai_use_permission_token === 'true' || settings.local_ai_use_permission_token === true}
                onChange={e => handleChange('local_ai_use_permission_token', e.target.checked ? 'true' : 'false')}
              />
              Use LM Studio Permission Token
            </label>

            <label>
              LM Studio Permission Token
              <input
                type="password"
                value={settings.local_ai_permission_token || ''}
                placeholder="Set permission token (stored securely, redacted in UI)"
                onChange={e => handleChange('local_ai_permission_token', e.target.value)}
              />
              <span className="field-hint">
                Used when LM Studio server authentication is enabled. Token is redacted in UI.
              </span>
            </label>

            <label className="toggle-label" style={{ opacity: 0.6 }}>
              <input
                type="checkbox"
                disabled
                checked={settings.local_ai_mcp_enabled === 'true' || settings.local_ai_mcp_enabled === true}
                onChange={e => handleChange('local_ai_mcp_enabled', e.target.checked ? 'true' : 'false')}
              />
              Enable MCP (Model Context Protocol) <em style={{ fontSize: '0.85em' }}> — coming soon</em>
            </label>

            <label style={{ opacity: 0.6 }}>
              MCP Config Path <em style={{ fontSize: '0.85em' }}>— coming soon</em>
              <input
                type="text"
                disabled
                value={settings.local_ai_mcp_config_path || ''}
                placeholder=".mcp.json"
                onChange={e => handleChange('local_ai_mcp_config_path', e.target.value)}
              />
              <span className="field-hint">MCP support is not yet active. Config path will be used in a future update.</span>
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

      {/* ── Branding / Visual Settings ───────────────────────────────── */}
      <h3 className="gs-editable-header" style={{ marginTop: '28px' }}>Branding / Visual Settings</h3>
      <span className="field-hint" style={{ display: 'block', marginBottom: '12px' }}>
        Upload a custom top-bar logo and chat background image.
        Images are served from <code>/branding/</code> and applied immediately.
        Max file size: 5 MB.
      </span>

      {brandingError && <div className="settings-error">{brandingError}</div>}

      <div className="settings-form gs-form">
        <div className="gs-section">
          <h4>Top Bar Logo</h4>
          <span className="field-hint">PNG · JPG · WEBP · SVG · aspect ratio preserved · no stretching</span>

          {currentLogoUrl && (
            <div className="branding-preview">
              <img
                src={currentLogoUrl}
                alt="Logo preview"
                className="branding-preview-logo"
              />
            </div>
          )}

          <div className="branding-actions">
            <label className="btn-upload">
              {brandingUploading.logo ? 'Uploading…' : 'Choose Logo'}
              <input
                ref={logoInputRef}
                type="file"
                accept={LOGO_ACCEPT}
                style={{ display: 'none' }}
                disabled={brandingUploading.logo}
                onChange={handleLogoUpload}
              />
            </label>
            {branding.logo_url && (
              <button className="btn-reset" onClick={handleLogoReset} disabled={brandingUploading.logo}>
                Reset Logo
              </button>
            )}
          </div>
        </div>

        <div className="gs-section">
          <h4>Chat Background Image</h4>
          <span className="field-hint">PNG · JPG · WEBP · cover + center · semi-transparent overlay for readability</span>

          {currentBgUrl && (
            <div className="branding-preview branding-preview-bg"
              style={{ backgroundImage: `url(${currentBgUrl})` }}>
              <span className="branding-preview-label">Background preview</span>
            </div>
          )}

          <div className="branding-actions">
            <label className="btn-upload">
              {brandingUploading.bg ? 'Uploading…' : 'Choose Background'}
              <input
                ref={bgInputRef}
                type="file"
                accept={BG_ACCEPT}
                style={{ display: 'none' }}
                disabled={brandingUploading.bg}
                onChange={handleBgUpload}
              />
            </label>
            {branding.background_url && (
              <button className="btn-reset" onClick={handleBgReset} disabled={brandingUploading.bg}>
                Reset Background
              </button>
            )}
          </div>
        </div>
      </div>
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
