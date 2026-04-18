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
  return data.data;
}

export function getHealth() {
  return request('/health');
}

export function getConversations() {
  return request('/conversations');
}

export function getConversation(id) {
  return request(`/conversations/${id}`);
}

export function getMessages(id, limit = 100, offset = 0) {
  return request(`/conversations/${id}/messages?limit=${limit}&offset=${offset}`);
}

export function sendMessage(id, content) {
  return request(`/conversations/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export function getSettings(id) {
  return request(`/conversations/${id}/settings`);
}

export function updateSettings(id, settings) {
  return request(`/conversations/${id}/settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}
