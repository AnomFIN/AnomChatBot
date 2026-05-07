import { listConversations, getConversationCount } from '../persistence/conversations.js';
import { getTotalMessageCount } from '../persistence/messages.js';

const TELEGRAM_API_ORIGIN = 'https://api.telegram.org';
const POLL_TIMEOUT_SECONDS = 25;
const POLL_RETRY_DELAY_MS = 5_000;
const SEND_TIMEOUT_MS = 10_000;
const MAX_MESSAGE_LENGTH = 4_000;

// AnomFIN — Security-first. Creator-ready. Future-proof.

/**
 * Why this design:
 * - Uses Telegram's HTTPS Bot API through native fetch to avoid vulnerable request-era dependencies.
 * - Keeps polling state inside a tiny imperative shell; command rendering stays deterministic and testable.
 * - Sends only operational metadata and never logs bot tokens or chat content.
 */
export function createTelegramAdmin(config, transportManager, aiProvider, logger) {
  let abortController = null;
  let pollLoopPromise = null;
  let updateOffset = 0;

  const adminIds = config.telegram.adminIds;
  const token = config.telegram.botToken;

  function isAdmin(chatId) {
    if (adminIds.length === 0) return true;
    return adminIds.includes(String(chatId));
  }

  function log(level, msg, meta = {}) {
    logger[level]({ ...meta }, `[telegram-admin] ${msg}`);
  }

  async function initialize() {
    const validation = validateTelegramBotToken(token);
    if (!validation.valid) {
      log(config.telegram.enabled ? 'error' : 'warn', validation.reason);
      return;
    }

    abortController = new AbortController();
    pollLoopPromise = runPollingLoop({ signal: abortController.signal });
    log('info', 'Telegram admin bot started');
  }

  async function shutdown() {
    if (!abortController) return;

    abortController.abort();
    try {
      await pollLoopPromise;
    } catch (err) {
      if (err.name !== 'AbortError') {
        log('warn', 'Telegram admin polling stopped with an error', { error: err.message });
      }
    }

    abortController = null;
    pollLoopPromise = null;
    log('info', 'Telegram admin bot stopped');
  }

  async function runPollingLoop({ signal }) {
    while (!signal.aborted) {
      try {
        const updates = await callTelegramApi(token, 'getUpdates', {
          offset: updateOffset,
          timeout: POLL_TIMEOUT_SECONDS,
          allowed_updates: ['message'],
        }, { signal, timeoutMs: (POLL_TIMEOUT_SECONDS + 5) * 1_000 });

        for (const update of updates) {
          updateOffset = Math.max(updateOffset, Number(update.update_id) + 1);
          await handleUpdate(update, signal);
        }
      } catch (err) {
        if (signal.aborted || err.name === 'AbortError') return;
        log('warn', 'Telegram admin poll failed; retrying', { error: err.message });
        await wait(POLL_RETRY_DELAY_MS, signal);
      }
    }
  }

  async function handleUpdate(update, signal) {
    const message = update?.message;
    const chatId = message?.chat?.id;
    const text = typeof message?.text === 'string' ? message.text.trim() : '';

    if (!chatId || !text.startsWith('/')) return;
    if (!isAdmin(chatId)) {
      log('warn', 'Rejected Telegram admin command from unauthorized chat', { chatId: String(chatId) });
      return;
    }

    const command = text.split(/\s+/, 1)[0].split('@', 1)[0].toLowerCase();
    const response = renderTelegramCommand(command, {
      config,
      transportStatus: transportManager.getStatus(),
      aiStatus: aiProvider.getStatus(),
      uptimeSeconds: process.uptime(),
      conversations: listConversations(),
      conversationCount: getConversationCount(),
      messageCount: getTotalMessageCount(),
    });

    if (!response) return;
    await sendTelegramMessage(token, chatId, response, { signal });
  }

  return { initialize, shutdown };
}

export function validateTelegramBotToken(token) {
  if (!token) return { valid: false, reason: 'No TELEGRAM_BOT_TOKEN — Telegram admin disabled' };
  if (typeof token !== 'string') return { valid: false, reason: 'Invalid TELEGRAM_BOT_TOKEN type — Telegram admin disabled' };
  if (!/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token)) {
    return { valid: false, reason: 'Invalid TELEGRAM_BOT_TOKEN format — Telegram admin disabled' };
  }
  return { valid: true };
}

export function renderTelegramCommand(command, snapshot) {
  const normalizedCommand = String(command).split('@', 1)[0].toLowerCase();

  switch (normalizedCommand) {
    case '/start':
      return '🤖 AnomChatBot Admin\n\nCommands:\n/status — System health\n/list — Active conversations\n/stats — Message statistics\n/help — This message';
    case '/status':
      return renderStatus(snapshot);
    case '/list':
      return renderConversationList(snapshot.conversations);
    case '/stats':
      return `📈 Statistics\n\nConversations: ${snapshot.conversationCount}\nMessages: ${snapshot.messageCount}`;
    case '/help':
      return '/start — Welcome\n/status — System health\n/list — Conversations\n/stats — Statistics\n/help — This message';
    default:
      return null;
  }
}

function renderStatus({ config, transportStatus, aiStatus, uptimeSeconds, conversationCount, messageCount }) {
  const uptime = Math.floor(Number(uptimeSeconds) || 0);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const aiLabel = aiStatus.connected ? aiStatus.model : 'disconnected';

  return `📊 System Status\n\nVersion: ${config.version}\nUptime: ${hours}h ${minutes}m\n\nWhatsApp: ${transportStatus.status} (${transportStatus.mode})\nAI: ${aiLabel}\nDB: ${conversationCount} conversations, ${messageCount} messages`;
}

function renderConversationList(conversations) {
  if (conversations.length === 0) return 'No conversations yet.';

  const lines = conversations.slice(0, 20).map((conversation, index) => {
    const displayName = sanitizeTelegramText(conversation.display_name || conversation.remote_id || 'unknown');
    const platform = sanitizeTelegramText(conversation.platform || 'unknown');
    const mode = conversation.auto_reply ? 'Auto' : 'Manual';
    return `${index + 1}. ${displayName} (${platform}) — ${mode}`;
  });

  return `📋 Conversations (${conversations.length} total)\n\n${lines.join('\n')}`;
}

export function sanitizeTelegramText(value) {
  return String(value).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 160);
}

async function sendTelegramMessage(token, chatId, text, { signal }) {
  return callTelegramApi(token, 'sendMessage', {
    chat_id: chatId,
    text: String(text).slice(0, MAX_MESSAGE_LENGTH),
    disable_web_page_preview: true,
  }, { signal, timeoutMs: SEND_TIMEOUT_MS });
}

async function callTelegramApi(token, method, body, { signal, timeoutMs }) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, timeoutMs);
  signal?.addEventListener('abort', abort, { once: true });

  try {
    const response = await fetch(`${TELEGRAM_API_ORIGIN}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      const description = sanitizeTelegramText(payload?.description || response.statusText || 'Telegram API error');
      throw new Error(`${method} failed: ${description}`);
    }

    return payload.result;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}
