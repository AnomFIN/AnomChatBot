import { describe, expect, it } from 'vitest';
import { renderTelegramCommand, sanitizeTelegramText, validateTelegramBotToken } from '../src/admin/telegram.js';

const snapshot = {
  config: { version: '2.0.0' },
  transportStatus: { status: 'connected', mode: 'baileys' },
  aiStatus: { connected: true, model: 'gpt-test' },
  uptimeSeconds: 3_900,
  conversations: [
    { display_name: 'Ada\nLovelace', remote_id: '123', platform: 'whatsapp', auto_reply: true },
    { display_name: '', remote_id: '456', platform: 'telegram', auto_reply: false },
  ],
  conversationCount: 2,
  messageCount: 42,
};

describe('telegram admin helpers', () => {
  it('validates Telegram bot tokens without logging secrets', () => {
    expect(validateTelegramBotToken('123456:abcdefghijklmnopqrstuvwxyzABCD_1234')).toEqual({ valid: true });
    expect(validateTelegramBotToken('bad-token')).toMatchObject({ valid: false });
    expect(validateTelegramBotToken('')).toMatchObject({ valid: false });
  });

  it('renders status from a deterministic snapshot', () => {
    expect(renderTelegramCommand('/status', snapshot)).toContain('Uptime: 1h 5m');
    expect(renderTelegramCommand('/status@AdminBot', snapshot)).toContain('WhatsApp: connected (baileys)');
  });

  it('sanitizes conversation list output', () => {
    const output = renderTelegramCommand('/list', snapshot);
    expect(output).toContain('AdaLovelace');
    expect(output).toContain('456 (telegram) — Manual');
  });

  it('ignores unknown commands and strips control characters', () => {
    expect(renderTelegramCommand('/unknown', snapshot)).toBeNull();
    expect(sanitizeTelegramText('ok\u0000\u001fbad')).toBe('okbad');
  });
});
