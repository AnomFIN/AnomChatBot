import { describe, it, expect, beforeEach } from 'vitest';
import { appendLogEntry, capturePinoLog, clearLogEntries, getRecentLogEntries } from '../src/realtime/logBus.js';

describe('logBus', () => {
  beforeEach(() => clearLogEntries());

  it('stores recent sanitized log entries', () => {
    appendLogEntry({ level: 'info', message: 'Ready', meta: { token: 'secret', safe: 'ok' } });

    const [entry] = getRecentLogEntries();
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('Ready');
    expect(entry.meta).toEqual({ token: '[redacted]', safe: 'ok' });
  });

  it('normalizes pino numeric levels and message arguments', () => {
    capturePinoLog([{ apiKey: 'secret' }, 'Backend started'], 30);

    const [entry] = getRecentLogEntries();
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('Backend started');
    expect(entry.meta.apiKey).toBe('[redacted]');
  });
});
