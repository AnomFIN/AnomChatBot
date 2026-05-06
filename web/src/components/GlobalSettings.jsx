// Less noise. More signal. AnomFIN.
import { useState, useEffect } from 'react';
import { getGlobalSettings, updateGlobalSettings } from '../api/client.js';

const MAX_BRANDING_FILE_BYTES = 3 * 1024 * 1024;
const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const BACKGROUND_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MCP_MODES = [
  ['disabled', 'Disabled'],
  ['local_config', 'Local MCP Config (.mcp.json)'],
  ['ephemeral', 'Ephemeral MCP'],
];

const EMPTY_INTEGRATION_FORM = { server_label: '', server_url: '', allowed_tools: '' };

export default function GlobalSettings({ status, onBrandingChange }) {
  const [settings, setSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [integrationForm, setIntegrationForm] = useState(EMPTY_INTEGRATION_FORM);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getGlobalSettings();
      setSettings(hydrateSettings(data));
      onBrandingChange?.(data);
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

  const handleMcpModeChange = (mode) => {
    setSettings(prev => ({
      ...prev,
      local_ai_mcp_mode: mode,
      local_ai_mcp_enabled: mode === 'disabled' ? 'false' : 'true',
    }));
    setSaved(false);
  };

  const handleIntegrationFormChange = (key, value) => {
    setIntegrationForm(prev => ({ ...prev, [key]: value }));
  };

  const handleAddIntegration = () => {
    setError(null);
    const nextIntegration = normalizeIntegrationForm(integrationForm);
    const validationError = validateIntegration(nextIntegration);
    if (validationError) {
      setError(validationError);
      return;
    }

    const current = parseIntegrations(settings.local_ai_mcp_integrations);
    const duplicate = current.some(item =>
      item.server_label.toLowerCase() === nextIntegration.server_label.toLowerCase()
      && item.server_url.toLowerCase() === nextIntegration.server_url.toLowerCase(),
    );
    if (duplicate) {
      setError('Duplicate MCP integration: same server label and URL already exists.');
      return;
    }

    handleChange('local_ai_mcp_integrations', JSON.stringify([...current, nextIntegration]));
    setIntegrationForm(EMPTY_INTEGRATION_FORM);
  };

  const handleRemoveIntegration = (index) => {
    const current = parseIntegrations(settings.local_ai_mcp_integrations);
    const next = current.filter((_, itemIndex) => itemIndex !== index);
    handleChange('local_ai_mcp_integrations', JSON.stringify(next));
  };

  const handleBrandingChange = (key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      onBrandingChange?.(next);
      return next;
    });
    setSaved(false);
  };

  const handleBrandingUpload = async (event, key, allowedTypes) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!allowedTypes.has(file.type)) {
      setError(key === 'branding_chat_background' ? 'Chat background must be PNG, JPEG, or WebP.' : 'Logo must be PNG, JPEG, WebP, or SVG.');
      return;
    }
    if (file.size > MAX_BRANDING_FILE_BYTES) {
      setError('Branding images must be 3MB or smaller.');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      handleBrandingChange(key, dataUrl);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = serializeSettings(settings);
      const data = await updateGlobalSettings(payload);
      const hydrated = hydrateSettings(data);
      setSettings(hydrated);
      onBrandingChange?.(hydrated);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!status) return <div className="global-settings">Loading…</div>;

  const localAiEnabled = isTrue(settings?.local_ai_enabled);
  const mcpMode = settings?.local_ai_mcp_mode || (isTrue(settings?.local_ai_mcp_enabled) ? 'local_config' : 'disabled');
  const integrations = parseIntegrations(settings?.local_ai_mcp_integrations);

  return (
    <div className="global-settings">
      <h3>System Overview</h3>
      <div className="settings-card-grid">
        <InfoCard title="Server" rows={[
          ['Version', status.version || '?'],
          ['Uptime', formatUptime(status.uptime)],
          ['Node.js', status.environment?.nodeVersion || '?'],
          ['Platform', status.environment?.platform || '?'],
        ]} />
        <InfoCard title="AI" rows={[
          ['Provider', status.ai?.provider || status.modes?.aiProvider || '?'],
          ['Model', status.ai?.model || '?'],
          ['Connected', status.ai?.connected ? 'Yes' : 'No'],
          ...(status.ai?.lastError ? [['Last Error', status.ai.lastError]] : []),
        ]} />
        <InfoCard title="WhatsApp" rows={[
          ['Mode', status.whatsapp?.mode || status.modes?.whatsappMode || '?'],
          ['Status', status.whatsapp?.status || '?'],
          ['Details', status.whatsapp?.details || '—'],
        ]} />
        <InfoCard title="Orchestrator" rows={[
          ['Pending Replies', status.orchestrator?.pendingReplies ?? 0],
          ['Active Approaches', status.orchestrator?.activeApproaches ?? 0],
        ]} />
      </div>

      <h3 className="gs-editable-header">Global Settings</h3>
      {error && <div className="settings-error">{error}</div>}
      {saved && <div className="settings-saved">Settings saved</div>}

      {loadingSettings ? (
        <div>Loading settings…</div>
      ) : settings && (
        <div className="settings-form gs-form">
          <div className="gs-section settings-card">
            <h4>OpenAI</h4>
            <span className="field-hint">Cloud OpenAI settings remain separate from Local AI tokens and MCP.</span>
            <label>Provider
              <select value={settings.ai_provider || ''} onChange={e => handleChange('ai_provider', e.target.value || '')}>
                <option value="">— Use .env default —</option>
                <option value="openai">OpenAI</option>
                <option value="openai_compatible">OpenAI-Compatible</option>
              </select>
            </label>
            <label>Base URL
              <input type="text" value={settings.ai_base_url || ''} placeholder="Optional OpenAI-compatible cloud base URL" onChange={e => handleChange('ai_base_url', e.target.value)} />
            </label>
            <label>Model
              <input type="text" value={settings.ai_model || ''} placeholder="e.g. gpt-4o-mini" onChange={e => handleChange('ai_model', e.target.value)} />
            </label>
            <label>API Key
              <input type="password" value={settings.ai_api_key || ''} placeholder="Set via .env or paste cloud key" onChange={e => handleChange('ai_api_key', e.target.value)} />
            </label>
          </div>

          <div className="gs-section settings-card">
            <h4>Local AI / LM Studio</h4>
            <span className="field-hint">Uses OpenAI-compatible endpoint /v1/chat/completions.</span>
            <label className="toggle-label"><input type="checkbox" checked={localAiEnabled} onChange={e => handleChange('local_ai_enabled', e.target.checked ? 'true' : 'false')} /> Enable Local AI</label>
            <label>Local AI Provider
              <select value={settings.local_ai_provider || 'lmstudio'} onChange={e => handleChange('local_ai_provider', e.target.value)}>
                <option value="lmstudio">LM Studio</option>
              </select>
            </label>
            <label>Local AI Base URL
              <input type="text" value={settings.local_ai_base_url || 'http://127.0.0.1:1234/v1'} onChange={e => handleChange('local_ai_base_url', e.target.value)} />
            </label>
            <label>Local AI Model
              <input type="text" value={settings.local_ai_model || ''} placeholder="Loaded LM Studio model id" onChange={e => handleChange('local_ai_model', e.target.value)} />
            </label>
            <label className="toggle-label"><input type="checkbox" checked={isTrue(settings.local_ai_use_permission_token)} onChange={e => handleChange('local_ai_use_permission_token', e.target.checked ? 'true' : 'false')} /> Use LM Studio Permission Token</label>
            <label>LM Studio Permission Token
              <input type="password" value={settings.local_ai_permission_token || ''} placeholder="Only sent to Local AI requests" onChange={e => handleChange('local_ai_permission_token', e.target.value)} />
            </label>
          </div>

          {localAiEnabled && (
            <div className="gs-section settings-card mcp-card">
              <h4>MCP Mode</h4>
              <span className="field-hint">MCP is Local AI / LM Studio only. OpenAI cloud never receives integrations.</span>
              <label>MCP Mode
                <select value={mcpMode} onChange={e => handleMcpModeChange(e.target.value)}>
                  {MCP_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>

              {mcpMode === 'local_config' && (
                <>
                  <div className="mcp-status">Local config · existing .mcp.json flow</div>
                  <label>MCP config path
                    <input type="text" value={settings.local_ai_mcp_config_path || '.mcp.json'} onChange={e => handleChange('local_ai_mcp_config_path', e.target.value)} />
                  </label>
                </>
              )}

              {mcpMode === 'ephemeral' && (
                <div className="mcp-integrations-ui">
                  <div className="mcp-status mcp-status-live">Uses LM Studio API endpoint /api/v1/chat with input + integrations.</div>
                  <div className="mcp-integration-form">
                    <label>MCP Server Label
                      <input type="text" value={integrationForm.server_label} placeholder="huggingface" onChange={e => handleIntegrationFormChange('server_label', e.target.value)} />
                    </label>
                    <label>MCP Server URL
                      <input type="url" value={integrationForm.server_url} placeholder="https://huggingface.co/mcp" onChange={e => handleIntegrationFormChange('server_url', e.target.value)} />
                    </label>
                    <label>Allowed Tools
                      <input type="text" value={integrationForm.allowed_tools} placeholder="model_search, dataset_search" onChange={e => handleIntegrationFormChange('allowed_tools', e.target.value)} />
                    </label>
                    <button type="button" className="secondary-btn" onClick={handleAddIntegration}>Add Integration</button>
                  </div>

                  <div className="mcp-integration-list">
                    {integrations.length === 0 ? (
                      <div className="field-hint">No integrations yet. Add at least one server before saving Ephemeral MCP mode.</div>
                    ) : integrations.map((integration, index) => (
                      <div className="mcp-integration-card" key={`${integration.server_label}-${integration.server_url}`}>
                        <div>
                          <strong>{integration.server_label}</strong>
                          <span>{integration.server_url}</span>
                          <small>{integration.allowed_tools.join(', ')}</small>
                        </div>
                        <button type="button" className="secondary-btn danger-lite" onClick={() => handleRemoveIntegration(index)}>Remove Integration</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="gs-section settings-card">
            <h4>Branding / Visual Settings</h4>
            <div className="branding-controls">
              <label>Top bar logo
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e => handleBrandingUpload(e, 'branding_top_bar_logo', LOGO_TYPES)} />
              </label>
              <button type="button" className="secondary-btn" onClick={() => handleBrandingChange('branding_top_bar_logo', '')}>Reset top bar logo</button>
              <label>Chat background image
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => handleBrandingUpload(e, 'branding_chat_background', BACKGROUND_TYPES)} />
              </label>
              <button type="button" className="secondary-btn" onClick={() => handleBrandingChange('branding_chat_background', '')}>Reset background image</button>
            </div>
            <div className="branding-preview">
              <div className="branding-preview-topbar">
                {settings.branding_top_bar_logo ? <img src={settings.branding_top_bar_logo} alt="Current top bar logo preview" /> : <span>AnomChatBot</span>}
              </div>
              <div className="branding-preview-chat" style={settings.branding_chat_background ? { '--preview-bg': `url(${settings.branding_chat_background})` } : undefined}>
                <span>Preview current branding</span>
              </div>
            </div>
          </div>

          <div className="gs-section settings-card">
            <h4>Advanced</h4>
            <label>Min Delay (ms)<input type="number" min="3000" value={settings.reply_delay_min || ''} onChange={e => handleChange('reply_delay_min', e.target.value)} /></label>
            <label>Max Delay (ms)<input type="number" min="3000" value={settings.reply_delay_max || ''} onChange={e => handleChange('reply_delay_max', e.target.value)} /></label>
            <label className="toggle-label"><input type="checkbox" checked={isTrue(settings.presence_enabled)} onChange={e => handleChange('presence_enabled', e.target.checked ? 'true' : 'false')} /> Enable presence simulation</label>
            <label>Typing Speed (chars/sec)<input type="number" min="1" value={settings.presence_typing_speed || ''} onChange={e => handleChange('presence_typing_speed', e.target.value)} /></label>
          </div>

          <button className="save-btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Global Settings'}</button>
        </div>
      )}
    </div>
  );
}

function InfoCard({ title, rows }) {
  return (
    <div className="gs-section settings-card">
      <h4>{title}</h4>
      <table><tbody>{rows.map(([key, value]) => <tr key={key}><td>{key}</td><td>{value}</td></tr>)}</tbody></table>
    </div>
  );
}

function hydrateSettings(data) {
  return {
    ...data,
    local_ai_mcp_mode: data.local_ai_mcp_mode || (isTrue(data.local_ai_mcp_enabled) ? 'local_config' : 'disabled'),
    local_ai_mcp_integrations: JSON.stringify(parseIntegrations(data.local_ai_mcp_integrations)),
  };
}

function serializeSettings(data) {
  const mode = data.local_ai_mcp_mode || 'disabled';
  return {
    ...data,
    local_ai_mcp_mode: mode,
    local_ai_mcp_enabled: mode === 'disabled' ? 'false' : 'true',
    local_ai_mcp_integrations: JSON.stringify(parseIntegrations(data.local_ai_mcp_integrations)),
  };
}

function normalizeIntegrationForm(form) {
  return {
    type: 'ephemeral_mcp',
    server_label: form.server_label.trim(),
    server_url: form.server_url.trim(),
    allowed_tools: form.allowed_tools.split(',').map(tool => tool.trim()).filter(Boolean),
  };
}

function validateIntegration(integration) {
  if (!integration.server_label) return 'MCP Server Label is required.';
  if (!integration.server_url) return 'MCP Server URL is required.';
  if (!isValidUrl(integration.server_url)) return 'MCP Server URL must be a valid http(s) URL.';
  if (integration.allowed_tools.length === 0) return 'Allowed Tools must contain at least one tool.';
  return null;
}

function parseIntegrations(value) {
  if (Array.isArray(value)) return value.map(normalizeIntegration).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(normalizeIntegration).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function normalizeIntegration(item) {
  if (!item || typeof item !== 'object') return null;
  const serverLabel = String(item.server_label ?? item.serverLabel ?? '').trim();
  const serverUrl = String(item.server_url ?? item.serverUrl ?? '').trim();
  const tools = Array.isArray(item.allowed_tools ?? item.allowedTools)
    ? (item.allowed_tools ?? item.allowedTools).map(tool => String(tool).trim()).filter(Boolean)
    : String(item.allowed_tools ?? item.allowedTools ?? '').split(',').map(tool => tool.trim()).filter(Boolean);
  if (!serverLabel || !serverUrl || tools.length === 0) return null;
  return { type: 'ephemeral_mcp', server_label: serverLabel, server_url: serverUrl, allowed_tools: [...new Set(tools)] };
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read branding file'));
    reader.readAsDataURL(file);
  });
}

function isTrue(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
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
