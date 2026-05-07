import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import logsRoutes from '../src/api/logs.js';
import transportRoutes from '../src/api/transport.js';
import { appendLogEntry, clearLogEntries } from '../src/realtime/logBus.js';

describe('realtime API routes', () => {
  beforeEach(() => clearLogEntries());

  it('returns recent logs for the live logs page', async () => {
    const app = Fastify({ logger: false });
    await app.register(logsRoutes);
    appendLogEntry({ level: 'warn', message: 'QR waiting' });

    const res = await app.inject({ method: 'GET', url: '/api/logs?limit=10' });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].message).toBe('QR waiting');

    await app.close();
  });

  it('regenerates Baileys QR login through the transport manager', async () => {
    const app = Fastify({ logger: false });
    const regenerateLogin = vi.fn().mockResolvedValue({ success: true, data: { status: { status: 'connecting' } } });

    await app.register(transportRoutes, {
      config: { whatsapp: { mode: 'baileys' } },
      transportManager: { regenerateLogin },
    });

    const res = await app.inject({ method: 'POST', url: '/api/transport/qr/regenerate' });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(regenerateLogin).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('rejects QR regeneration outside Baileys mode', async () => {
    const app = Fastify({ logger: false });
    await app.register(transportRoutes, {
      config: { whatsapp: { mode: 'cloud_api' } },
      transportManager: { regenerateLogin: vi.fn() },
    });

    const res = await app.inject({ method: 'POST', url: '/api/transport/qr/regenerate' });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).success).toBe(false);

    await app.close();
  });
});
