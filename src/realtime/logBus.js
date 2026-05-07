import { getIO } from './socket.js';

const MAX_LOG_ENTRIES = 300;
const SECRET_KEY_PATTERN = /(token|secret|password|authorization|api[_-]?key|cookie|credential|session)/i;
const REDACTED = '[redacted]';
const LEVEL_BY_PINO_NUMBER = Object.freeze({
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
});

let entries = [];

// Less noise. More signal. AnomFIN.
function sanitizeValue(value, depth = 0) {
  if (depth > 4) return '[depth-limit]';
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SECRET_KEY_PATTERN.test(key) ? REDACTED : sanitizeValue(item, depth + 1),
      ]),
    );
  }
  if (typeof value === 'string' && value.length > 800) {
    return `${value.slice(0, 800)}…`;
  }
  return value;
}

function getMessageFromArgs(args) {
  const messageArg = args.find((arg) => typeof arg === 'string');
  if (messageArg) return messageArg;

  const errorArg = args.find((arg) => arg instanceof Error);
  if (errorArg) return errorArg.message;

  const objectArg = args.find((arg) => arg && typeof arg === 'object');
  if (objectArg?.msg && typeof objectArg.msg === 'string') return objectArg.msg;

  return 'Log event';
}

function getMetaFromArgs(args) {
  const meta = args.find((arg) => arg && typeof arg === 'object' && !(arg instanceof Error));
  return meta ? sanitizeValue(meta) : undefined;
}

export function normalizeLogEntry(input) {
  const level = typeof input?.level === 'number'
    ? LEVEL_BY_PINO_NUMBER[input.level] ?? 'info'
    : String(input?.level || 'info').toLowerCase();

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: input?.timestamp || new Date().toISOString(),
    level,
    message: String(input?.message || 'Log event'),
    ...(input?.meta ? { meta: sanitizeValue(input.meta) } : {}),
  };
}

export function appendLogEntry(input) {
  const entry = normalizeLogEntry(input);
  entries = [...entries, entry].slice(-MAX_LOG_ENTRIES);
  getIO()?.emit('log:entry', entry);
  return entry;
}

export function capturePinoLog(inputArgs, level) {
  const args = Array.isArray(inputArgs) ? inputArgs : [];
  return appendLogEntry({
    level,
    message: getMessageFromArgs(args),
    meta: getMetaFromArgs(args),
  });
}

export function getRecentLogEntries(limit = 200) {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_LOG_ENTRIES) : 200;
  return entries.slice(-safeLimit);
}

export function clearLogEntries() {
  entries = [];
}
