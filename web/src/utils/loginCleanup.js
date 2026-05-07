const QR_LOGIN_KEY_PATTERNS = [
  /^anomchatbot-(qr|login|auth|session|baileys|whatsapp)/i,
  /^(qr|login|auth|session|baileys|whatsapp)[._:-]?/i,
  /(qr|baileys).*login/i,
];

function isQrLoginKey(key) {
  return QR_LOGIN_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function clearStorage(storage) {
  if (!storage) return [];
  const removed = [];
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key || !isQrLoginKey(key)) continue;
    storage.removeItem(key);
    removed.push(key);
  }
  return removed;
}

function clearCookies() {
  if (typeof document === 'undefined' || !document.cookie) return [];
  const removed = [];
  const cookies = document.cookie.split(';').map((item) => item.trim()).filter(Boolean);

  for (const cookie of cookies) {
    const [rawName] = cookie.split('=');
    const name = decodeURIComponent(rawName || '').trim();
    if (!name || !isQrLoginKey(name)) continue;
    document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; path=/; SameSite=Lax`;
    removed.push(name);
  }

  return removed;
}

// Engineered for autonomy, designed for humans.
export function clearQrLoginArtifacts() {
  return {
    localStorage: clearStorage(globalThis.localStorage),
    sessionStorage: clearStorage(globalThis.sessionStorage),
    cookies: clearCookies(),
  };
}
