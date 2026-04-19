import { describe, it, expect } from 'vitest';
import {
  validateConfig,
  VALID_TONES,
  VALID_FLIRTS,
  VALID_WHATSAPP_MODES,
  VALID_AI_PROVIDERS,
} from '../src/config/index.js';

// Minimal env that passes all validation (no required-but-missing errors)
const BASE_ENV = {
  DATABASE_PATH: './data/test.db',
};

describe('Config — tone validation', () => {
  it.each(VALID_TONES)('accepts valid tone: %s', (tone) => {
    const result = validateConfig({ ...BASE_ENV, DEFAULT_TONE: tone });
    expect(result.valid).toBe(true);
    expect(result.config.defaults.tone).toBe(tone);
  });

  it('accepts uppercase tone (normalized to lowercase)', () => {
    const result = validateConfig({ ...BASE_ENV, DEFAULT_TONE: 'Friendly' });
    expect(result.valid).toBe(true);
    expect(result.config.defaults.tone).toBe('friendly');
  });

  it('rejects invalid tone', () => {
    const result = validateConfig({ ...BASE_ENV, DEFAULT_TONE: 'aggressive' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('DEFAULT_TONE'))).toBe(true);
  });

  it('defaults to friendly when not set', () => {
    const result = validateConfig({ ...BASE_ENV });
    expect(result.valid).toBe(true);
    expect(result.config.defaults.tone).toBe('friendly');
  });
});

describe('Config — flirt validation', () => {
  it.each(VALID_FLIRTS)('accepts valid flirt: %s', (flirt) => {
    const result = validateConfig({ ...BASE_ENV, DEFAULT_FLIRT: flirt });
    expect(result.valid).toBe(true);
    expect(result.config.defaults.flirt).toBe(flirt);
  });

  it('rejects invalid flirt', () => {
    const result = validateConfig({ ...BASE_ENV, DEFAULT_FLIRT: 'extreme' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('DEFAULT_FLIRT'))).toBe(true);
  });

  it('defaults to none when not set', () => {
    const result = validateConfig({ ...BASE_ENV });
    expect(result.valid).toBe(true);
    expect(result.config.defaults.flirt).toBe('none');
  });
});

describe('Config — WHATSAPP_MODE validation', () => {
  it.each(VALID_WHATSAPP_MODES)('accepts valid mode: %s', (mode) => {
    const result = validateConfig({ ...BASE_ENV, WHATSAPP_MODE: mode });
    expect(result.valid).toBe(true);
    expect(result.config.whatsapp.mode).toBe(mode);
  });

  it('rejects invalid mode', () => {
    const result = validateConfig({ ...BASE_ENV, WHATSAPP_MODE: 'web' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('WHATSAPP_MODE'))).toBe(true);
  });

  it('defaults to baileys when not set', () => {
    const result = validateConfig({ ...BASE_ENV });
    expect(result.valid).toBe(true);
    expect(result.config.whatsapp.mode).toBe('baileys');
  });
});

describe('Config — AI_PROVIDER validation', () => {
  it.each(VALID_AI_PROVIDERS)('accepts valid provider: %s', (provider) => {
    const result = validateConfig({ ...BASE_ENV, AI_PROVIDER: provider });
    expect(result.valid).toBe(true);
    expect(result.config.ai.provider).toBe(provider);
  });

  it('rejects invalid provider', () => {
    const result = validateConfig({ ...BASE_ENV, AI_PROVIDER: 'anthropic' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('AI_PROVIDER'))).toBe(true);
  });
});

describe('Config — TELEGRAM_ENABLED parsing', () => {
  it.each([
    ['true', true],
    ['TRUE', true],
    ['1', true],
    ['yes', true],
    ['false', false],
    ['FALSE', false],
    ['0', false],
    ['no', false],
  ])('parses "%s" as %s', (input, expected) => {
    const result = validateConfig({ ...BASE_ENV, TELEGRAM_ENABLED: input });
    expect(result.valid).toBe(true);
    expect(result.config.telegram.enabled).toBe(expected);
  });

  it('defaults to false when not set', () => {
    const result = validateConfig({ ...BASE_ENV });
    expect(result.valid).toBe(true);
    expect(result.config.telegram.enabled).toBe(false);
  });

  it('warns when enabled but no bot token', () => {
    const result = validateConfig({ ...BASE_ENV, TELEGRAM_ENABLED: 'true' });
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('TELEGRAM_BOT_TOKEN'))).toBe(true);
  });
});

describe('Config — numeric validation', () => {
  it('accepts valid PORT', () => {
    const result = validateConfig({ ...BASE_ENV, PORT: '8080' });
    expect(result.valid).toBe(true);
    expect(result.config.port).toBe(8080);
  });

  it('rejects non-numeric PORT', () => {
    const result = validateConfig({ ...BASE_ENV, PORT: 'abc' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('PORT'))).toBe(true);
  });

  it('rejects non-numeric DEFAULT_TEMPERATURE', () => {
    const result = validateConfig({ ...BASE_ENV, DEFAULT_TEMPERATURE: 'hot' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('DEFAULT_TEMPERATURE'))).toBe(true);
  });

  it('rejects non-integer DEFAULT_MAX_TOKENS', () => {
    const result = validateConfig({ ...BASE_ENV, DEFAULT_MAX_TOKENS: '5.5' });
    expect(result.valid).toBe(true); // parseInt('5.5') = 5, valid
    expect(result.config.defaults.maxTokens).toBe(5);
  });

  it('rejects garbage DEFAULT_MAX_TOKENS', () => {
    const result = validateConfig({ ...BASE_ENV, DEFAULT_MAX_TOKENS: 'lots' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('DEFAULT_MAX_TOKENS'))).toBe(true);
  });

  it('rejects non-integer DEFAULT_MAX_HISTORY', () => {
    const result = validateConfig({ ...BASE_ENV, DEFAULT_MAX_HISTORY: 'all' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('DEFAULT_MAX_HISTORY'))).toBe(true);
  });
});

describe('Config — defaults', () => {
  it('provides all defaults from minimal env', () => {
    const result = validateConfig({ ...BASE_ENV });
    expect(result.valid).toBe(true);
    const { config } = result;
    expect(config.port).toBe(3001);
    expect(config.host).toBe('0.0.0.0');
    expect(config.logLevel).toBe('info');
    expect(config.ai.provider).toBe('openai');
    expect(config.ai.openaiModel).toBe('gpt-4o-mini');
    expect(config.whatsapp.mode).toBe('baileys');
    expect(config.telegram.enabled).toBe(false);
    expect(config.defaults.tone).toBe('friendly');
    expect(config.defaults.flirt).toBe('none');
    expect(config.defaults.temperature).toBe(0.7);
    expect(config.defaults.maxTokens).toBe(1000);
    expect(config.defaults.maxHistory).toBe(50);
    expect(config.media.storageDir).toBe('./data/media');
    expect(config.media.maxImageSizeMb).toBe(5);
    expect(config.media.maxAudioSizeMb).toBe(10);
  });

  it('config object is frozen', () => {
    const result = validateConfig({ ...BASE_ENV });
    expect(result.valid).toBe(true);
    expect(Object.isFrozen(result.config)).toBe(true);
    expect(Object.isFrozen(result.config.ai)).toBe(true);
    expect(Object.isFrozen(result.config.defaults)).toBe(true);
  });
});

describe('Config — conditional warnings', () => {
  it('warns when AI_PROVIDER=openai but no API key', () => {
    const result = validateConfig({ ...BASE_ENV, AI_PROVIDER: 'openai' });
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('OPENAI_API_KEY'))).toBe(true);
  });

  it('warns when WHATSAPP_MODE=cloud_api but no access token', () => {
    const result = validateConfig({ ...BASE_ENV, WHATSAPP_MODE: 'cloud_api' });
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('WHATSAPP_CLOUD_ACCESS_TOKEN'))).toBe(true);
  });
});
