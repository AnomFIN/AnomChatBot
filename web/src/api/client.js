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

// ── Global settings ──────────────────────────────────────────────────────
export function getGlobalSettings() {
  return request('/settings').then(d => d.data);
}

export function updateGlobalSettings(settings) {
  return request('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }).then(d => d.data);
}
