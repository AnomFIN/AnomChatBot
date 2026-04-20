/**
 * Delay Manager — Human-like reply delay with multi-message context batching.
 *
 * When an inbound message triggers an AI reply:
 * 1. A pending reply timer is started (configurable delay).
 * 2. If MORE messages arrive before the timer fires:
 *    - Timer is reset from the last message timestamp.
 *    - All new messages are included in the AI context.
 *    - The old pending reply is cancelled.
 * 3. Each pending reply has a version token. When the AI generates a reply,
 *    the token is checked against current — stale replies are discarded.
 *
 * This prevents:
 * - Bot replying to message 1 when message 2 and 3 have already arrived.
 * - Stale AI results being sent after the user sent new context.
 */

import { getDelaySettings } from '../persistence/settings.js';

/**
 * Create a delay manager instance.
 *
 * @param {object} opts
 * @param {function} opts.onReady — Called when delay expires: (conversationId, version) => void
 *   The caller must check version before proceeding with AI + send.
 * @param {object} [opts.logger] — Pino logger
 * @returns {object} DelayManager API
 */
export function createDelayManager({ onReady, logger }) {
  // Per-conversation state: { timer, version, messageCount }
  const pending = new Map();

  function log(level, msg, meta) {
    if (logger) logger[level]({ ...meta }, `[delay-manager] ${msg}`);
  }

  /**
   * Compute a random delay between min and max.
   */
  function computeDelay(conversation) {
    const { replyDelayMin, replyDelayMax } = getDelaySettings(conversation);
    return replyDelayMin + Math.floor(Math.random() * (replyDelayMax - replyDelayMin));
  }

  /**
   * Schedule or reschedule a pending reply for a conversation.
   * Called every time a new inbound message arrives that should trigger AI.
   *
   * @param {string} conversationId
   * @param {object} conversation — full conversation row (for delay settings)
   * @returns {number} The current version token for this conversation's pending reply
   */
  function scheduleReply(conversationId, conversation) {
    const existing = pending.get(conversationId);

    // Cancel existing timer if any
    if (existing?.timer) {
      clearTimeout(existing.timer);
      log('debug', `Reset delay timer for ${conversationId} (was v${existing.version}, msgs: ${existing.messageCount})`);
    }

    // Increment version to invalidate any in-flight AI call
    const version = (existing?.version ?? 0) + 1;
    const messageCount = (existing?.messageCount ?? 0) + 1;
    const delay = computeDelay(conversation);

    const timer = setTimeout(() => {
      log('info', `Delay expired for ${conversationId} (v${version}, ${messageCount} msgs batched, ${delay}ms delay)`);
      // Don't remove from map yet — the caller needs to check version
      const state = pending.get(conversationId);
      if (state) {
        state.timer = null;
      }
      onReady(conversationId, version);
    }, delay);

    pending.set(conversationId, { timer, version, messageCount, scheduledAt: Date.now() });

    log('debug', `Scheduled reply for ${conversationId} in ${delay}ms (v${version}, ${messageCount} msgs)`);

    return version;
  }

  /**
   * Check if a version token is still current for a conversation.
   * If the version doesn't match, the reply is stale and must be discarded.
   *
   * @param {string} conversationId
   * @param {number} version
   * @returns {boolean} true if this version is still the latest
   */
  function isCurrentVersion(conversationId, version) {
    const state = pending.get(conversationId);
    return state?.version === version;
  }

  /**
   * Mark a conversation's pending reply as completed.
   * Called after the AI reply has been successfully sent (or abandoned).
   */
  function complete(conversationId) {
    const state = pending.get(conversationId);
    if (state?.timer) {
      clearTimeout(state.timer);
    }
    pending.delete(conversationId);
  }

  /**
   * Cancel a pending reply for a conversation (e.g., operator takes over).
   */
  function cancel(conversationId) {
    const state = pending.get(conversationId);
    if (state?.timer) {
      clearTimeout(state.timer);
      log('info', `Cancelled pending reply for ${conversationId} (v${state.version})`);
    }
    pending.delete(conversationId);
  }

  /**
   * Check if a conversation has a pending reply timer.
   */
  function hasPending(conversationId) {
    return pending.has(conversationId);
  }

  /**
   * Get pending reply state for a conversation (for status display).
   */
  function getPendingState(conversationId) {
    const state = pending.get(conversationId);
    if (!state) return null;
    return {
      version: state.version,
      messageCount: state.messageCount,
      hasTimer: state.timer !== null,
      scheduledAt: state.scheduledAt,
    };
  }

  /**
   * Get count of all pending replies (for status bar).
   */
  function getPendingCount() {
    return pending.size;
  }

  /**
   * Shutdown: cancel all timers.
   */
  function shutdown() {
    for (const [id, state] of pending.entries()) {
      if (state.timer) clearTimeout(state.timer);
    }
    pending.clear();
    log('info', 'Delay manager shut down');
  }

  return {
    scheduleReply,
    isCurrentVersion,
    complete,
    cancel,
    hasPending,
    getPendingState,
    getPendingCount,
    shutdown,
  };
}
