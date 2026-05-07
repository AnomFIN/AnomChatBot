// Security-first. Creator-ready. Future-proof.

const DEFAULT_REVIEW_DELAY_MS = 3000;
const MAX_CONTENT_LENGTH = 8000;

/**
 * Why this design:
 * - In-memory queue keeps unsent AI replies operator-reviewable without new persistence risk.
 * - One timer per outgoing message is simple, inspectable, and cheap for human chat volumes.
 * - Mutations are explicit actions (pause/resume/edit/delete) with sanitized payloads.
 */
export function createOutgoingQueue({ logger, onChange } = {}) {
  const entries = new Map();
  let sequence = 0;

  function log(level, msg, meta = {}) {
    if (logger?.[level]) logger[level]({ ...meta }, `[outgoing-queue] ${msg}`);
  }

  function notify(action, entry) {
    onChange?.(action, toPublicEntry(entry));
  }

  function scheduleTimer(entry) {
    clearTimer(entry);
    if (entry.status !== 'queued') return;

    entry.deadlineAt = Date.now() + entry.remainingMs;
    entry.timer = setTimeout(() => resolveEntry(entry.id, 'send'), entry.remainingMs);
    notify('upsert', entry);
  }

  function clearTimer(entry) {
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
  }

  function resolveEntry(id, action) {
    const entry = entries.get(id);
    if (!entry || entry.settled) return false;

    clearTimer(entry);
    entry.settled = true;
    entry.status = action === 'delete' ? 'deleted' : 'sending';
    entries.delete(id);
    notify('remove', entry);
    entry.resolve(action === 'delete' ? null : entry.content);
    log('info', `Outgoing message ${action}`, { outgoingId: id, conversationId: entry.conversationId, messageId: entry.messageId });
    return true;
  }

  function enqueue({ conversationId, messageId, content, delayMs, source = 'ai' }) {
    const safeConversationId = validateId(conversationId, 'conversationId');
    const safeMessageId = validateMessageId(messageId);
    const safeContent = sanitizeContent(content);
    const safeDelayMs = validateDelay(delayMs);
    const id = `${Date.now().toString(36)}-${(++sequence).toString(36)}`;

    return new Promise((resolve) => {
      const entry = {
        id,
        conversationId: safeConversationId,
        messageId: safeMessageId,
        content: safeContent,
        source: sanitizeSource(source),
        status: 'queued',
        createdAt: Date.now(),
        deadlineAt: null,
        remainingMs: safeDelayMs,
        timer: null,
        settled: false,
        resolve,
      };
      entries.set(id, entry);
      log('info', 'Outgoing message queued for operator review', {
        outgoingId: id,
        conversationId: safeConversationId,
        messageId: safeMessageId,
        delayMs: safeDelayMs,
      });
      scheduleTimer(entry);
    });
  }

  function requireEntry(id) {
    const safeId = validateId(id, 'id');
    const entry = entries.get(safeId);
    if (entry) return entry;
    throw new Error(`Outgoing message not found: ${safeId}`);
  }

  function pause(id) {
    const entry = requireEntry(id);
    if (entry.status === 'paused') return toPublicEntry(entry);
    if (entry.status !== 'queued') throw new Error('Only queued outgoing messages can be paused');

    entry.remainingMs = Math.max(0, entry.deadlineAt - Date.now());
    entry.status = 'paused';
    entry.deadlineAt = null;
    clearTimer(entry);
    notify('upsert', entry);
    return toPublicEntry(entry);
  }

  function resume(id) {
    const entry = requireEntry(id);
    if (entry.status === 'queued') return toPublicEntry(entry);
    if (entry.status !== 'paused') throw new Error('Only paused outgoing messages can be resumed');

    entry.status = 'queued';
    scheduleTimer(entry);
    return toPublicEntry(entry);
  }

  function edit(id, content) {
    const entry = requireEntry(id);
    if (!['queued', 'paused'].includes(entry.status)) throw new Error('Outgoing message can no longer be edited');

    if (entry.status === 'queued') {
      entry.remainingMs = Math.max(0, entry.deadlineAt - Date.now());
      entry.deadlineAt = null;
      clearTimer(entry);
    }
    entry.status = 'paused';
    entry.content = sanitizeContent(content);
    notify('upsert', entry);
    return toPublicEntry(entry);
  }

  function remove(id) {
    return resolveEntry(id, 'delete');
  }

  function list() {
    return [...entries.values()].map(toPublicEntry);
  }

  function shutdown() {
    for (const entry of entries.values()) {
      clearTimer(entry);
      if (!entry.settled) entry.resolve(null);
    }
    entries.clear();
  }

  return { enqueue, pause, resume, edit, delete: remove, list, shutdown };
}


function toPublicEntry(entry) {
  const remainingMs = entry.status === 'queued' && entry.deadlineAt
    ? Math.max(0, entry.deadlineAt - Date.now())
    : Math.max(0, entry.remainingMs);

  return {
    id: entry.id,
    conversationId: entry.conversationId,
    messageId: entry.messageId,
    content: entry.content,
    source: entry.source,
    status: entry.status,
    createdAt: new Date(entry.createdAt).toISOString(),
    deadlineAt: entry.deadlineAt ? new Date(entry.deadlineAt).toISOString() : null,
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
  };
}

function validateId(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 128) {
    throw new Error(`${name} must be a non-empty string under 128 characters`);
  }
  return value.trim();
}

function validateMessageId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error('messageId must be a positive integer');
  return id;
}

function validateDelay(value) {
  const delay = Number(value);
  if (!Number.isFinite(delay) || delay < 0) return DEFAULT_REVIEW_DELAY_MS;
  return Math.min(delay, 120000);
}

function sanitizeSource(value) {
  return ['ai', 'approach'].includes(value) ? value : 'ai';
}

function sanitizeContent(value) {
  if (typeof value !== 'string') throw new Error('content must be a string');
  const trimmed = value.replace(/\u0000/g, '').trim();
  if (!trimmed) throw new Error('content must not be empty');
  if (trimmed.length > MAX_CONTENT_LENGTH) throw new Error(`content must be ${MAX_CONTENT_LENGTH} characters or less`);
  return trimmed;
}
