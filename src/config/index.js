import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Canonical enum values ──────────────────────────────────────────────────
export const VALID_TONES = ['professional', 'friendly', 'casual', 'playful'];
export const VALID_FLIRTS = ['none', 'subtle', 'moderate', 'high'];
export const VALID_WHATSAPP_MODES = ['cloud_api', 'baileys'];
export const VALID_AI_PROVIDERS = ['openai', 'openai_compatible'];
export const VALID_LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
export const VALID_AI_APPROACH_MAX_MESSAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const VALID_AI_APPROACH_DELAY_MINUTES = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440];

// ── Helpers ────────────────────────────────────────────────────────────────

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const lower = String(value).toLowerCase().trim();
  if (['true', '1', 'yes', 'on'].includes(lower)) return true;
  if (['false', '0', 'no', 'off'].includes(lower)) return false;
  return fallback;
}

function parseInteger(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function parseNumeric(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

export function redactSecret(value) {
  if (!value || typeof value !== 'string') return '(not set)';
  if (value.length < 8) return '***';
  return value.slice(0, 4) + '...' + value.slice(-3);
}

function getVersion() {
  try {
    const pkgPath = join(__dirname, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// ── Main validation ────────────────────────────────────────────────────────

/**
 * Validate raw env object and return a normalized, frozen config.
 * Call this directly in tests with a custom env map.
 * loadConfig() calls this after dotenv.config().
 */
export function validateConfig(env) {
  const errors = [];
  const warnings = [];

  // ── Core server ──────────────────────────────────────────────────────────
  const port = parseInteger(env.PORT, 3001);
  if (port === null) errors.push('PORT must be a valid integer');

  const host = env.HOST || '127.0.0.1';

  const logLevel = (env.LOG_LEVEL || 'info').toLowerCase();
  if (!VALID_LOG_LEVELS.includes(logLevel)) {
    errors.push(`LOG_LEVEL must be one of: ${VALID_LOG_LEVELS.join(', ')}`);
  }

  // ── Database ─────────────────────────────────────────────────────────────
  const databasePath = env.DATABASE_PATH || './data/anomchatbot.db';
  if (!databasePath) errors.push('DATABASE_PATH must not be empty');

  // ── AI Provider ──────────────────────────────────────────────────────────
  const aiProvider = (env.AI_PROVIDER || 'openai').toLowerCase();
  if (!VALID_AI_PROVIDERS.includes(aiProvider)) {
    errors.push(`AI_PROVIDER must be one of: ${VALID_AI_PROVIDERS.join(', ')}`);
  }

  const openaiApiKey = env.OPENAI_API_KEY || '';
  const openaiBaseUrl = env.OPENAI_BASE_URL || '';
  const openaiModel = env.OPENAI_MODEL || 'gpt-4o-mini';

  if (VALID_AI_PROVIDERS.includes(aiProvider) && aiProvider === 'openai' && !openaiApiKey) {
    warnings.push('OPENAI_API_KEY not set — AI features will not work until configured');
  }

  // ── WhatsApp ─────────────────────────────────────────────────────────────
  const whatsappMode = (env.WHATSAPP_MODE || 'baileys').toLowerCase();
  if (!VALID_WHATSAPP_MODES.includes(whatsappMode)) {
    errors.push(`WHATSAPP_MODE must be one of: ${VALID_WHATSAPP_MODES.join(', ')}`);
  }

  const whatsappCloudAccessToken = env.WHATSAPP_CLOUD_ACCESS_TOKEN || '';
  const whatsappCloudPhoneNumberId = env.WHATSAPP_CLOUD_PHONE_NUMBER_ID || '';
  const whatsappCloudVerifyToken = env.WHATSAPP_CLOUD_VERIFY_TOKEN || '';
  const whatsappCloudWebhookPath = env.WHATSAPP_CLOUD_WEBHOOK_PATH || '/webhook/whatsapp';
  const whatsappBaileysAuthDir = env.WHATSAPP_BAILEYS_AUTH_DIR || './data/baileys-auth';

  if (whatsappMode === 'cloud_api') {
    if (!whatsappCloudAccessToken) warnings.push('WHATSAPP_CLOUD_ACCESS_TOKEN not set — Cloud API will not work');
    if (!whatsappCloudPhoneNumberId) warnings.push('WHATSAPP_CLOUD_PHONE_NUMBER_ID not set — Cloud API will not work');
  }

  // ── Telegram ─────────────────────────────────────────────────────────────
  const telegramEnabled = parseBoolean(env.TELEGRAM_ENABLED, false);
  const telegramBotToken = env.TELEGRAM_BOT_TOKEN || '';
  const telegramAdminIds = env.TELEGRAM_ADMIN_IDS
    ? env.TELEGRAM_ADMIN_IDS.split(',').map(id => id.trim()).filter(Boolean)
    : [];

  if (telegramEnabled && !telegramBotToken) {
    warnings.push('TELEGRAM_ENABLED=true but TELEGRAM_BOT_TOKEN not set — Telegram will not work');
  }

  // ── Conversation defaults ────────────────────────────────────────────────
  const defaultTone = (env.DEFAULT_TONE || 'friendly').toLowerCase();
  if (!VALID_TONES.includes(defaultTone)) {
    errors.push(`DEFAULT_TONE must be one of: ${VALID_TONES.join(', ')}`);
  }

  const defaultFlirt = (env.DEFAULT_FLIRT || 'none').toLowerCase();
  if (!VALID_FLIRTS.includes(defaultFlirt)) {
    errors.push(`DEFAULT_FLIRT must be one of: ${VALID_FLIRTS.join(', ')}`);
  }

  const defaultTemperature = parseNumeric(env.DEFAULT_TEMPERATURE, 0.7);
  if (defaultTemperature === null) {
    errors.push('DEFAULT_TEMPERATURE must be a valid number');
  }

  const defaultMaxTokens = parseInteger(env.DEFAULT_MAX_TOKENS, 1000);
  if (defaultMaxTokens === null) {
    errors.push('DEFAULT_MAX_TOKENS must be a valid integer');
  }

  const defaultMaxHistory = parseInteger(env.DEFAULT_MAX_HISTORY, 50);
  if (defaultMaxHistory === null) {
    errors.push('DEFAULT_MAX_HISTORY must be a valid integer');
  }

  // ── Media ────────────────────────────────────────────────────────────────
  const mediaStorageDir = env.MEDIA_STORAGE_DIR || './data/media';
  if (!mediaStorageDir) errors.push('MEDIA_STORAGE_DIR must not be empty');

  const maxImageSizeMb = parseNumeric(env.MAX_IMAGE_SIZE_MB, 5);
  if (maxImageSizeMb === null) errors.push('MAX_IMAGE_SIZE_MB must be a valid number');

  const maxAudioSizeMb = parseNumeric(env.MAX_AUDIO_SIZE_MB, 10);
  if (maxAudioSizeMb === null) errors.push('MAX_AUDIO_SIZE_MB must be a valid number');

  // ── Result ───────────────────────────────────────────────────────────────
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const config = Object.freeze({
    version: getVersion(),
    host,
    port,
    logLevel,
    databasePath,
    ai: Object.freeze({
      provider: aiProvider,
      openaiApiKey,
      openaiBaseUrl,
      openaiModel,
    }),
    whatsapp: Object.freeze({
      mode: whatsappMode,
      cloud: Object.freeze({
        accessToken: whatsappCloudAccessToken,
        phoneNumberId: whatsappCloudPhoneNumberId,
        verifyToken: whatsappCloudVerifyToken,
        webhookPath: whatsappCloudWebhookPath,
      }),
      baileys: Object.freeze({
        authDir: whatsappBaileysAuthDir,
      }),
    }),
    telegram: Object.freeze({
      enabled: telegramEnabled,
      botToken: telegramBotToken,
      adminIds: Object.freeze(telegramAdminIds),
    }),
    defaults: Object.freeze({
      tone: defaultTone,
      flirt: defaultFlirt,
      temperature: defaultTemperature,
      maxTokens: defaultMaxTokens,
      maxHistory: defaultMaxHistory,
      replyDelayMin: parseInteger(env.DEFAULT_REPLY_DELAY_MIN, 3000),
      replyDelayMax: parseInteger(env.DEFAULT_REPLY_DELAY_MAX, 8000),
    }),
    media: Object.freeze({
      storageDir: mediaStorageDir,
      maxImageSizeMb,
      maxAudioSizeMb,
    }),
  });

  return { valid: true, config, warnings };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Load .env file and validate config.
 * Returns { valid, config?, errors?, warnings }.
 */
export function loadConfig() {
  dotenv.config();
  return validateConfig(process.env);
}

/**
 * Print a safe config summary to the logger.
 */
export function logConfigSummary(config, logger) {
  logger.info('┌──────────────────────────────────────┐');
  logger.info('│       AnomChatBot Configuration       │');
  logger.info('├──────────────────────────────────────┤');
  logger.info(`│ Version:     ${config.version}`);
  logger.info(`│ Listen:      ${config.host}:${config.port}`);
  logger.info(`│ Log level:   ${config.logLevel}`);
  logger.info(`│ Database:    ${config.databasePath}`);
  logger.info('├──────────────────────────────────────┤');
  logger.info(`│ AI provider: ${config.ai.provider} (${config.ai.openaiModel})`);
  logger.info(`│ AI key:      ${redactSecret(config.ai.openaiApiKey)}`);
  if (config.ai.openaiBaseUrl) {
    logger.info(`│ AI base URL: ${config.ai.openaiBaseUrl}`);
  }
  logger.info(`│ WhatsApp:    ${config.whatsapp.mode}`);
  logger.info(`│ Telegram:    ${config.telegram.enabled ? 'enabled' : 'disabled'}`);
  logger.info('├──────────────────────────────────────┤');
  logger.info(`│ Tone:        ${config.defaults.tone}`);
  logger.info(`│ Flirt:       ${config.defaults.flirt}`);
  logger.info(`│ Temperature: ${config.defaults.temperature}`);
  logger.info(`│ Max tokens:  ${config.defaults.maxTokens}`);
  logger.info(`│ History:     ${config.defaults.maxHistory}`);
  logger.info('└──────────────────────────────────────┘');
}
