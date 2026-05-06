import { createWriteStream, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { setSettingsBulk, getAllSettings } from '../persistence/settings.js';

const BRANDING_DIR = join(process.cwd(), 'data', 'branding');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']);
const BG_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

const TYPE_EXTS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

function ensureBrandingDir() {
  mkdirSync(BRANDING_DIR, { recursive: true });
}

/**
 * Branding API routes.
 *
 * GET    /api/settings/branding         — current logo/bg paths
 * POST   /api/settings/branding/logo    — upload top-bar logo
 * DELETE /api/settings/branding/logo    — reset logo
 * POST   /api/settings/branding/background — upload chat background
 * DELETE /api/settings/branding/background — reset background
 */
export default async function brandingRoutes(fastify, _opts) {
  // ── GET branding paths ────────────────────────────────────────────────
  fastify.get('/api/settings/branding', async () => {
    const s = getAllSettings();
    return {
      success: true,
      data: {
        logo_url: s.branding_logo_path || null,
        background_url: s.branding_bg_path || null,
      },
    };
  });

  // ── Upload logo ───────────────────────────────────────────────────────
  fastify.post('/api/settings/branding/logo', async (request, reply) => {
    return _handleUpload(request, reply, 'logo', LOGO_TYPES, 'branding_logo_path');
  });

  // ── Reset logo ────────────────────────────────────────────────────────
  fastify.delete('/api/settings/branding/logo', async () => {
    return _handleReset('branding_logo_path');
  });

  // ── Upload background ─────────────────────────────────────────────────
  fastify.post('/api/settings/branding/background', async (request, reply) => {
    return _handleUpload(request, reply, 'bg', BG_TYPES, 'branding_bg_path');
  });

  // ── Reset background ──────────────────────────────────────────────────
  fastify.delete('/api/settings/branding/background', async () => {
    return _handleReset('branding_bg_path');
  });
}

async function _handleUpload(request, reply, prefix, allowedTypes, settingKey) {
  const data = await request.file();

  if (!data) {
    reply.code(400);
    return { success: false, error: 'No file uploaded' };
  }

  const mime = data.mimetype.toLowerCase();
  if (!allowedTypes.has(mime)) {
    // Drain the stream to avoid hanging
    data.file.resume();
    reply.code(400);
    return {
      success: false,
      error: `Unsupported file type: ${mime}. Allowed: ${[...allowedTypes].join(', ')}`,
    };
  }

  const ext = TYPE_EXTS[mime] ?? extname(data.filename) ?? '.bin';
  const filename = `${prefix}${ext}`;
  const servePath = `/branding/${filename}`;

  ensureBrandingDir();
  const dest = join(BRANDING_DIR, filename);

  let bytesWritten = 0;
  const writeStream = createWriteStream(dest);

  // Stream with size enforcement
  const chunks = [];
  for await (const chunk of data.file) {
    bytesWritten += chunk.length;
    if (bytesWritten > MAX_FILE_SIZE) {
      writeStream.destroy();
      // Clean up partial file
      try { unlinkSync(dest); } catch {}
      reply.code(400);
      return { success: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB` };
    }
    chunks.push(chunk);
  }

  // Write to disk
  for (const chunk of chunks) {
    writeStream.write(chunk);
  }
  await new Promise((resolve, reject) => {
    writeStream.end();
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  setSettingsBulk({ [settingKey]: servePath });

  return { success: true, data: { url: servePath } };
}

function _handleReset(settingKey) {
  const current = getAllSettings()[settingKey];
  if (current) {
    const filename = current.split('/').pop();
    const filePath = join(BRANDING_DIR, filename);
    if (existsSync(filePath)) {
      try { unlinkSync(filePath); } catch {}
    }
    setSettingsBulk({ [settingKey]: '' });
  }
  return { success: true, data: { url: null } };
}
