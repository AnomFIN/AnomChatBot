import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

  // Base persona — per-conversation system prompt or built-in fallback
  const base = conversation.system_prompt || 'You are a helpful assistant.';
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
 * For messages with media:
 * - Images with stored files: uses OpenAI vision format (content array with text + image_url)
 * - Audio/video/document: adds text description, actual content not sent to AI
 * - Images without stored files (download pending/failed): text description only
 *
 * @param {object} conversation — DB row
 * @param {Array<object>} recentMessages — From getRecentMessages (chronological order)
 * @param {object} config — App config
 * @returns {Array<{role: string, content: string|Array}>}
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
      const content = buildMessageContent(msg);
      messages.push({ role: msg.role, content });
    }
  }

  return messages;
}

/**
 * Build content for a single message.
 * For plain text messages, returns a string.
 * For image messages with stored files, returns OpenAI vision content array.
 * For other media, returns text with media description appended.
 */
function buildMessageContent(msg) {
  if (!msg.media_type) {
    return msg.content;
  }

  // Image with stored local file — use multimodal vision format
  if (msg.media_type === 'image' && msg.media_path) {
    const base64 = readMediaAsBase64(msg.media_path);
    if (base64) {
      const mime = msg.media_mime_type || 'image/jpeg';
      const parts = [];

      // Text caption (if any, beyond placeholder)
      const caption = msg.content && msg.content !== '[Image]' ? msg.content : '';
      if (caption) {
        parts.push({ type: 'text', text: caption });
      } else {
        parts.push({ type: 'text', text: 'The user sent an image.' });
      }

      parts.push({
        type: 'image_url',
        image_url: { url: `data:${mime};base64,${base64}` },
      });

      return parts;
    }
  }

  // Image without stored file (download pending or failed)
  if (msg.media_type === 'image') {
    const caption = msg.content && msg.content !== '[Image]' ? msg.content : '';
    return caption
      ? `${caption}\n\n[The user also sent an image that could not be processed]`
      : '[The user sent an image that could not be processed]';
  }

  // Audio
  if (msg.media_type === 'audio') {
    return '[The user sent an audio message. Audio transcription is not yet supported.]';
  }

  // Video
  if (msg.media_type === 'video') {
    const caption = msg.content && msg.content !== '[Video]' ? msg.content : '';
    return caption
      ? `${caption}\n\n[The user also sent a video that cannot be viewed by the AI]`
      : '[The user sent a video. Video analysis is not yet supported.]';
  }

  // Document
  if (msg.media_type === 'document') {
    const name = msg.content && msg.content !== '[Document]' ? msg.content : 'a document';
    return `[The user sent a file: ${name}. Document content extraction is not yet supported.]`;
  }

  // Fallback
  return msg.content;
}

/**
 * Read a stored media file as base64.
 * media_path is a serve path like /media/filename.jpg.
 * Returns base64 string or null on failure.
 */
function readMediaAsBase64(mediaPath) {
  if (!mediaPath) return null;

  try {
    // Convert serve path /media/filename.jpg to filesystem path data/media/filename.jpg
    const fileName = mediaPath.replace(/^\/media\//, '');
    const filePath = join(process.cwd(), 'data', 'media', fileName);
    const buffer = readFileSync(filePath);
    return buffer.toString('base64');
  } catch {
    return null;
  }
}
