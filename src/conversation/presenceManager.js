/**
 * Presence Manager — Typing/read simulation for human-like bot behavior.
 *
 * Uses Baileys presence API where supported:
 * - sendPresenceUpdate('available') — come online
 * - readMessages(keys) — mark messages as read (blue ticks)
 * - sendPresenceUpdate('composing', jid) — show "typing..."
 * - sendPresenceUpdate('paused', jid) — stop typing indicator
 * - sendPresenceUpdate('unavailable') — go offline
 *
 * Flow for each outbound reply:
 * 1. Go online (available)
 * 2. Wait readDelay → mark messages as read
 * 3. Start typing (composing)
 * 4. Typing duration based on message length (chars / typingSpeed)
 * 5. Send the actual message (caller does this)
 * 6. Wait idleAfterSend → go unavailable
 *
 * HONEST LIMITATIONS:
 * - "last seen" is not controllable via Baileys API. WhatsApp controls this server-side.
 * - Presence updates are best-effort; WhatsApp may not display them in all cases.
 * - read receipts (blue ticks) require the message keys from the original Baileys message.
 */

import { getPresenceSettings } from '../persistence/settings.js';

/**
 * Create a presence manager.
 *
 * @param {object} opts
 * @param {function} opts.getTransport — Returns current transport adapter (or null)
 * @param {object} [opts.logger] — Pino logger
 * @returns {object} PresenceManager API
 */
export function createPresenceManager({ getTransport, logger }) {
  // Track active idle timers per JID so we can cancel them
  const idleTimers = new Map();

  function log(level, msg, meta) {
    if (logger) logger[level]({ ...meta }, `[presence] ${msg}`);
  }

  /**
   * Execute the full presence simulation flow before sending a message.
   * Returns after typing simulation is complete — caller should send immediately after.
   *
   * @param {string} remoteId — phone number or JID
   * @param {string} replyContent — the message about to be sent (for typing duration calc)
   * @param {object[]} [messageKeys] — Baileys message keys for read receipts
   */
  async function simulateBeforeSend(remoteId, replyContent, messageKeys = []) {
    const settings = getPresenceSettings();
    if (!settings.enabled) return;

    const transport = getTransport();
    if (!transport) return;

    // Check if transport has presence capabilities
    const hasPresence = typeof transport.sendPresenceUpdate === 'function';
    const hasReadReceipts = typeof transport.markRead === 'function';

    if (!hasPresence) {
      log('debug', 'Transport does not support presence updates');
      return;
    }

    const jid = remoteId.includes('@') ? remoteId : `${remoteId}@s.whatsapp.net`;

    // Cancel any pending idle timer for this JID
    cancelIdle(jid);

    try {
      // 1. Go online
      await transport.sendPresenceUpdate('available');
      log('debug', `Online for ${remoteId}`);

      // 2. Wait → mark as read
      if (settings.readDelay > 0) {
        await sleep(settings.readDelay);
      }

      if (hasReadReceipts && messageKeys.length > 0) {
        await transport.markRead(messageKeys);
        log('debug', `Marked ${messageKeys.length} message(s) as read for ${remoteId}`);
      }

      // 3. Start typing
      await transport.sendPresenceUpdate('composing', jid);
      log('debug', `Typing for ${remoteId}`);

      // 4. Typing duration based on message length
      const typingDuration = calculateTypingDuration(replyContent, settings);
      await sleep(typingDuration);

      // 5. Stop typing indicator (message will be sent by caller immediately after)
      await transport.sendPresenceUpdate('paused', jid);

    } catch (err) {
      // Presence failures should never block message delivery
      log('warn', `Presence simulation error: ${err.message}`);
    }
  }

  /**
   * Schedule going idle/unavailable after a message is sent.
   *
   * @param {string} remoteId — phone number or JID
   */
  function scheduleIdle(remoteId) {
    const settings = getPresenceSettings();
    if (!settings.enabled) return;

    const transport = getTransport();
    if (!transport || typeof transport.sendPresenceUpdate !== 'function') return;

    const jid = remoteId.includes('@') ? remoteId : `${remoteId}@s.whatsapp.net`;

    cancelIdle(jid);

    if (settings.idleAfterSend > 0) {
      const timer = setTimeout(async () => {
        try {
          await transport.sendPresenceUpdate('unavailable');
          log('debug', `Gone idle for ${remoteId}`);
        } catch (err) {
          log('warn', `Failed to set unavailable: ${err.message}`);
        }
        idleTimers.delete(jid);
      }, settings.idleAfterSend);

      idleTimers.set(jid, timer);
    }
  }

  /**
   * Cancel a pending idle timer.
   */
  function cancelIdle(jid) {
    const timer = idleTimers.get(jid);
    if (timer) {
      clearTimeout(timer);
      idleTimers.delete(jid);
    }
  }

  /**
   * Calculate typing duration based on message length and configured speed.
   */
  function calculateTypingDuration(content, settings) {
    const charCount = content.length;
    const rawDuration = Math.round((charCount / settings.typingSpeed) * 1000);

    // Clamp to min/max
    return Math.max(settings.minTyping, Math.min(settings.maxTyping, rawDuration));
  }

  /**
   * Get current presence settings (for GUI display).
   */
  function getSettings() {
    return getPresenceSettings();
  }

  /**
   * Shutdown: cancel all idle timers.
   */
  function shutdown() {
    for (const timer of idleTimers.values()) {
      clearTimeout(timer);
    }
    idleTimers.clear();
    log('info', 'Presence manager shut down');
  }

  return {
    simulateBeforeSend,
    scheduleIdle,
    getSettings,
    shutdown,
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
