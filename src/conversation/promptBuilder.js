/**
 * System prompt assembly from per-conversation settings.
 * Uses canonical tone and flirt enums.
 */

const TONE_DESCRIPTIONS = {
  professional: 'Respond in a professional, clear, and structured tone.',
  friendly: 'Respond in a friendly and approachable tone.',
  casual: 'Respond in a casual, conversational tone.',
  playful: 'Respond in a playful and lighthearted tone.',
};

const FLIRT_DESCRIPTIONS = {
  none: null, // No modifier added
  subtle: 'Be subtly warm and personable in your responses.',
  moderate: 'Be moderately flirtatious in your responses.',
  high: 'Be playfully flirtatious in your responses.',
};

/**
 * Build the system prompt for a conversation.
 * Combines the custom system prompt, tone modifier, flirt modifier, and platform context.
 *
 * @param {object} conversation — DB row from conversations table
 * @param {object} config — App config (for defaults)
 * @returns {string} The assembled system prompt
 */
export function buildSystemPrompt(conversation, config) {
  const parts = [];

  // Base persona — per-conversation system prompt or global default
  const base = conversation.system_prompt || config.defaults?.systemPrompt || 'You are a helpful assistant.';
  parts.push(base);

  // Tone modifier
  const tone = conversation.tone || config.defaults?.tone || 'friendly';
  const toneDesc = TONE_DESCRIPTIONS[tone];
  if (toneDesc) {
    parts.push(toneDesc);
  }

  // Flirt modifier
  const flirt = conversation.flirt || config.defaults?.flirt || 'none';
  const flirtDesc = FLIRT_DESCRIPTIONS[flirt];
  if (flirtDesc) {
    parts.push(flirtDesc);
  }

  // Platform context
  const platform = conversation.platform || 'api';
  parts.push(`You are chatting on ${platform}. Keep responses concise and natural for messaging.`);

  return parts.join('\n\n');
}

/**
 * Build the full messages array for an AI call.
 * System prompt + recent message history, trimmed to maxHistory.
 *
 * @param {object} conversation — DB row
 * @param {Array<object>} recentMessages — From getRecentMessages (chronological order)
 * @param {object} config — App config
 * @returns {Array<{role: string, content: string}>}
 */
export function buildMessages(conversation, recentMessages, config) {
  const messages = [];

  // System prompt
  messages.push({
    role: 'system',
    content: buildSystemPrompt(conversation, config),
  });

  // Conversation history — already in chronological order from getRecentMessages
  const maxHistory = conversation.max_history ?? config.defaults?.maxHistory ?? 50;
  const trimmed = recentMessages.slice(-maxHistory);

  for (const msg of trimmed) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  return messages;
}
