/**
 * AI Approach Manager — Handles proactive follow-up messages when users don't reply.
 *
 * This manager tracks user inactivity and schedules AI follow-up messages
 * based on conversation settings (ai_approach_enabled, ai_approach_max_messages, ai_approach_delay_minutes).
 *
 * Similar to delay manager but focused on proactive approaches rather than reactive replies.
 */

export function createApproachManager({ logger, onApproach } = {}) {
  // Map: conversationId → { timer, messageCount, lastUserMessageTime }
  const activeApproaches = new Map();

  function log(level, msg, meta) {
    if (logger) logger[level]({ ...meta }, `[approach-manager] ${msg}`);
    else if (level === 'error') console.error(`[approach-manager] ${msg}`);
  }

  /**
   * Start tracking approach opportunity for a conversation.
   * Called when new user message arrives - resets any existing approach timer.
   */
  function trackUserMessage(conversationId, conversation) {
    // Cancel any existing approach
    if (activeApproaches.has(conversationId)) {
      const existing = activeApproaches.get(conversationId);
      clearTimeout(existing.timer);
    }

    // Only proceed if AI approach is enabled for this conversation
    if (!conversation.ai_approach_enabled) {
      activeApproaches.delete(conversationId);
      return;
    }

    const delayMs = (conversation.ai_approach_delay_minutes ?? 10) * 60 * 1000;
    
    log('info', `Tracking user message for approach - will check in ${Math.floor(delayMs / 60000)} minutes`, {
      conversationId,
      delayMinutes: conversation.ai_approach_delay_minutes ?? 10,
    });

    const timer = setTimeout(() => {
      _triggerApproach(conversationId);
    }, delayMs);

    activeApproaches.set(conversationId, {
      timer,
      messageCount: 0, // Reset count on new user message
      lastUserMessageTime: Date.now(),
      maxMessages: conversation.ai_approach_max_messages ?? 3,
      delayMinutes: conversation.ai_approach_delay_minutes ?? 10,
    });
  }

  /**
   * Stop tracking approach for a conversation.
   * Called when AI reply is sent or when approach is no longer needed.
   */
  function stopTracking(conversationId, reason = 'stopped') {
    if (activeApproaches.has(conversationId)) {
      const approach = activeApproaches.get(conversationId);
      clearTimeout(approach.timer);
      activeApproaches.delete(conversationId);
      log('info', `Stopped approach tracking for ${conversationId}: ${reason}`);
    }
  }

  /**
   * Called when approach timer expires.
   * Checks if we should send a follow-up and schedules the next one if appropriate.
   */
  async function _triggerApproach(conversationId) {
    const approach = activeApproaches.get(conversationId);
    if (!approach) {
      log('warn', `No approach data found for ${conversationId}`);
      return;
    }

    // Check if we've hit the max message limit
    if (approach.messageCount >= approach.maxMessages) {
      log('info', `Max approach messages (${approach.maxMessages}) reached for ${conversationId}`);
      activeApproaches.delete(conversationId);
      return;
    }

    // Increment message count
    approach.messageCount++;

    log('info', `Triggering approach message ${approach.messageCount}/${approach.maxMessages} for ${conversationId}`);

    try {
      // Call the callback to generate and send the approach message
      if (onApproach) {
        await onApproach(conversationId, {
          messageNumber: approach.messageCount,
          maxMessages: approach.maxMessages,
          lastUserMessageTime: approach.lastUserMessageTime,
        });
      }

      // Schedule next approach if we haven't hit the limit
      if (approach.messageCount < approach.maxMessages) {
        const delayMs = approach.delayMinutes * 60 * 1000;
        
        log('info', `Scheduling next approach message in ${approach.delayMinutes} minutes`, {
          conversationId,
          nextMessageNumber: approach.messageCount + 1,
        });

        approach.timer = setTimeout(() => {
          _triggerApproach(conversationId);
        }, delayMs);
        
        activeApproaches.set(conversationId, approach);
      } else {
        // We've reached the limit, stop tracking
        log('info', `Completed all ${approach.maxMessages} approach messages for ${conversationId}`);
        activeApproaches.delete(conversationId);
      }
    } catch (err) {
      log('error', `Approach callback failed for ${conversationId}: ${err.message}`, { err });
      activeApproaches.delete(conversationId); // Stop on error
    }
  }

  /**
   * Cancel approach tracking for a conversation.
   * Called when operator sends a message or when auto_reply is disabled.
   */
  function cancel(conversationId, reason = 'cancelled') {
    stopTracking(conversationId, reason);
  }

  /**
   * Check if a conversation has active approach tracking.
   */
  function isTracking(conversationId) {
    return activeApproaches.has(conversationId);
  }

  /**
   * Get approach status for a conversation.
   */
  function getStatus(conversationId) {
    const approach = activeApproaches.get(conversationId);
    if (!approach) {
      return { tracking: false };
    }

    return {
      tracking: true,
      messageCount: approach.messageCount,
      maxMessages: approach.maxMessages,
      lastUserMessageTime: approach.lastUserMessageTime,
      nextApproachIn: Math.max(0, approach.delayMinutes * 60 * 1000 - (Date.now() - approach.lastUserMessageTime)),
    };
  }

  /**
   * Get count of conversations with active approach tracking.
   */
  function getActiveCount() {
    return activeApproaches.size;
  }

  /**
   * Shutdown - clear all timers.
   */
  function shutdown() {
    for (const [conversationId, approach] of activeApproaches) {
      clearTimeout(approach.timer);
      log('info', `Cleaned up approach timer for ${conversationId}`);
    }
    activeApproaches.clear();
  }

  return {
    trackUserMessage,
    stopTracking,
    cancel,
    isTracking,
    getStatus,
    getActiveCount,
    shutdown,
  };
}