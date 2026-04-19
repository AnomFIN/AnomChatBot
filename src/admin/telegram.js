import TelegramBot from 'node-telegram-bot-api';
import { listConversations, getConversationCount } from '../persistence/conversations.js';
import { getTotalMessageCount } from '../persistence/messages.js';

/**
 * Telegram admin bot — admin-only, NOT a user transport.
 * Provides system status, conversation list, and basic control via Telegram.
 */
export function createTelegramAdmin(config, transportManager, aiProvider, logger) {
  let bot = null;

  const adminIds = config.telegram.adminIds;

  function isAdmin(chatId) {
    if (adminIds.length === 0) return true; // No restriction if no IDs configured
    return adminIds.includes(String(chatId));
  }

  function log(level, msg) {
    logger[level](`[telegram-admin] ${msg}`);
  }

  async function initialize() {
    if (!config.telegram.botToken) {
      log('warn', 'No TELEGRAM_BOT_TOKEN — Telegram admin disabled');
      return;
    }

    try {
      bot = new TelegramBot(config.telegram.botToken, { polling: true });

      bot.on('polling_error', (err) => {
        log('error', `Polling error: ${err.message}`);
      });

      // /start
      bot.onText(/\/start/, (msg) => {
        if (!isAdmin(msg.chat.id)) return;
        bot.sendMessage(msg.chat.id,
          '🤖 *AnomChatBot Admin*\n\n' +
          'Commands:\n' +
          '/status — System health\n' +
          '/list — Active conversations\n' +
          '/stats — Message statistics\n' +
          '/help — This message',
          { parse_mode: 'Markdown' }
        );
      });

      // /status
      bot.onText(/\/status/, (msg) => {
        if (!isAdmin(msg.chat.id)) return;
        const wa = transportManager.getStatus();
        const ai = aiProvider.getStatus();
        const uptime = Math.floor(process.uptime());
        const h = Math.floor(uptime / 3600);
        const m = Math.floor((uptime % 3600) / 60);

        bot.sendMessage(msg.chat.id,
          `📊 *System Status*\n\n` +
          `Version: ${config.version}\n` +
          `Uptime: ${h}h ${m}m\n\n` +
          `*WhatsApp*: ${wa.status} (${wa.mode})\n` +
          `*AI*: ${ai.connected ? ai.model : 'disconnected'}\n` +
          `*DB*: ${getConversationCount()} conversations, ${getTotalMessageCount()} messages`,
          { parse_mode: 'Markdown' }
        );
      });

      // /list
      bot.onText(/\/list/, (msg) => {
        if (!isAdmin(msg.chat.id)) return;
        const convos = listConversations();
        if (convos.length === 0) {
          bot.sendMessage(msg.chat.id, 'No conversations yet.');
          return;
        }
        const lines = convos.slice(0, 20).map((c, i) =>
          `${i + 1}. ${c.display_name || c.remote_id} (${c.platform}) — ${c.auto_reply ? 'Auto' : 'Manual'}`
        );
        bot.sendMessage(msg.chat.id,
          `📋 *Conversations* (${convos.length} total)\n\n${lines.join('\n')}`,
          { parse_mode: 'Markdown' }
        );
      });

      // /stats
      bot.onText(/\/stats/, (msg) => {
        if (!isAdmin(msg.chat.id)) return;
        bot.sendMessage(msg.chat.id,
          `📈 *Statistics*\n\n` +
          `Conversations: ${getConversationCount()}\n` +
          `Messages: ${getTotalMessageCount()}`,
          { parse_mode: 'Markdown' }
        );
      });

      // /help
      bot.onText(/\/help/, (msg) => {
        if (!isAdmin(msg.chat.id)) return;
        bot.sendMessage(msg.chat.id,
          '/start — Welcome\n' +
          '/status — System health\n' +
          '/list — Conversations\n' +
          '/stats — Statistics\n' +
          '/help — This message'
        );
      });

      log('info', 'Telegram admin bot started');
    } catch (err) {
      log('error', `Failed to start Telegram admin: ${err.message}`);
    }
  }

  async function shutdown() {
    if (bot) {
      try {
        await bot.stopPolling();
      } catch {
        // ignore
      }
      bot = null;
      log('info', 'Telegram admin bot stopped');
    }
  }

  return { initialize, shutdown };
}
