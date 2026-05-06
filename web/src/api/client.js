const BASE = '/api';

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

export function getHealth() {
  return request('/health').then(d => d.data);
}

export function getConversations() {
  return request('/conversations').then(d => d.data);
}

export function getConversation(id) {
  return request(`/conversations/${id}`).then(d => d.data);
}

export function getMessages(id, limit = 100, offset = 0) {
  return request(`/conversations/${id}/messages?limit=${limit}&offset=${offset}`).then(d => d.data);
}

export function sendMessage(id, content) {
  return request(`/conversations/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  }).then(d => d.data);
}

export function clearConversationHistory(id, payload) {
  return request(`/conversations/${id}/messages`, {
    method: 'DELETE',
    body: JSON.stringify(payload),
  }).then(d => d.data);
}

export function getSettings(id) {
  return request(`/conversations/${id}/settings`).then(d => d.data);
}

export function updateSettings(id, settings) {
  return request(`/conversations/${id}/settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  }).then(d => d.data);
}

// ── New conversation ─────────────────────────────────────────────────────
export function createConversation(phoneNumber, displayName) {
  return request('/conversations', {
    method: 'POST',
    body: JSON.stringify({ phone_number: phoneNumber, display_name: displayName }),
  });
}

// ── Profile photo ────────────────────────────────────────────────────────
export function getProfilePhoto(id) {
  return request(`/conversations/${id}/photo`).then(d => d.data);
}

// ── Presets ──────────────────────────────────────────────────────────────
export function getPresets() {
  return request('/presets').then(d => d.data);
}

export function getPreset(id) {
  return request(`/presets/${id}`).then(d => d.data);
}

export function createPreset(preset) {
  return request('/presets', {
    method: 'POST',
    body: JSON.stringify(preset),
  }).then(d => d.data);
}

export function updatePreset(id, preset) {
  return request(`/presets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(preset),
  }).then(d => d.data);
}

export function deletePreset(id) {
  return request(`/presets/${id}`, { method: 'DELETE' });
}

// ── Branding ─────────────────────────────────────────────────────────────
export function getBranding() {
  return request('/settings/branding').then(d => d.data);
}

export function uploadBrandingLogo(file) {
  const form = new FormData();
  form.append('file', file);
  // Don't set Content-Type — browser sets it automatically with correct boundary
  return fetch(`${BASE}/settings/branding/logo`, { method: 'POST', body: form })
    .then(r => r.json())
    .then(d => { if (!d.success) throw new Error(d.error); return d.data; });
}

export function resetBrandingLogo() {
  return request('/settings/branding/logo', { method: 'DELETE' }).then(d => d.data);
}

export function uploadBrandingBackground(file) {
  const form = new FormData();
  form.append('file', file);
  return fetch(`${BASE}/settings/branding/background`, { method: 'POST', body: form })
    .then(r => r.json())
    .then(d => { if (!d.success) throw new Error(d.error); return d.data; });
}

export function resetBrandingBackground() {
  return request('/settings/branding/background', { method: 'DELETE' }).then(d => d.data);
}
  return request('/settings').then(d => d.data);
}

export function updateGlobalSettings(settings) {
  return request('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }).then(d => d.data);
}
