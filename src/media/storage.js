import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Media storage — downloads and stores media files to data/media/.
 * Files are served by Fastify @fastify/static at /media/{filename}.
 *
 * Non-blocking flow:
 * 1. Inbound message is persisted immediately with basic mediaInfo
 * 2. downloadAndStore() is called asynchronously
 * 3. On success, caller updates message row with file metadata
 * 4. On failure, caller logs error and moves on
 */

const MEDIA_DIR = join(process.cwd(), 'data', 'media');

// Common MIME → extension mapping
const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'audio/opus': '.opus',
  'video/mp4': '.mp4',
  'video/3gpp': '.3gp',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

/**
 * Ensure data/media/ directory exists.
 */
export function ensureMediaDir() {
  if (!existsSync(MEDIA_DIR)) {
    mkdirSync(MEDIA_DIR, { recursive: true });
  }
}

/**
 * Download and store media from a buffer or download function.
 *
 * @param {object} opts
 * @param {Function} opts.download — async () => Buffer — called to fetch the media bytes
 * @param {string} opts.mediaType — 'image' | 'audio' | 'video' | 'document'
 * @param {string} [opts.mimeType] — MIME type if known
 * @param {string} [opts.originalName] — original filename if available
 * @param {number} [opts.messageId] — message ID for filename
 * @returns {Promise<{ fileName: string, filePath: string, servePath: string, mimeType: string, sizeBytes: number }>}
 */
export async function downloadAndStore({ download, mediaType, mimeType, originalName, messageId }) {
  ensureMediaDir();

  const buffer = await download();
  if (!buffer || buffer.length === 0) {
    throw new Error('Downloaded media is empty');
  }

  // Determine extension
  const ext = getExtension(mimeType, originalName, mediaType);

  // Generate unique filename: {messageId}_{uuid}{ext}
  const prefix = messageId ? `${messageId}_` : '';
  const fileName = `${prefix}${randomUUID().slice(0, 8)}${ext}`;
  const filePath = join(MEDIA_DIR, fileName);

  // Write file synchronously — small files, no async needed
  writeFileSync(filePath, buffer);

  // Detect MIME from content if not provided
  const resolvedMime = mimeType || guessMimeFromExtension(ext) || 'application/octet-stream';

  return {
    fileName,
    filePath,
    servePath: `/media/${fileName}`,
    mimeType: resolvedMime,
    sizeBytes: buffer.length,
  };
}

/**
 * Determine file extension from MIME type, original name, or media type fallback.
 */
function getExtension(mimeType, originalName, mediaType) {
  // From MIME type
  if (mimeType && MIME_EXTENSIONS[mimeType]) {
    return MIME_EXTENSIONS[mimeType];
  }

  // From original filename
  if (originalName) {
    const ext = extname(originalName);
    if (ext) return ext;
  }

  // Fallback by media type
  const fallbacks = {
    image: '.jpg',
    audio: '.ogg',
    video: '.mp4',
    document: '.bin',
  };
  return fallbacks[mediaType] || '.bin';
}

/**
 * Guess MIME from extension (reverse lookup).
 */
function guessMimeFromExtension(ext) {
  for (const [mime, e] of Object.entries(MIME_EXTENSIONS)) {
    if (e === ext) return mime;
  }
  return null;
}

/**
 * Get the serve URL for a stored media file.
 */
export function getMediaUrl(fileName) {
  if (!fileName) return null;
  return `/media/${fileName}`;
}
