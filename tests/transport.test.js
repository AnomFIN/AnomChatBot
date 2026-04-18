import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { rmSync } from 'node:fs';
import Fastify from 'fastify';
import formbody from '@fastify/formbody';
import { TransportAdapter, TRANSPORT_STATES } from '../src/transport/base.js';
import { WhatsAppCloudTransport } from '../src/transport/whatsappCloud.js';
import { createTransportManager } from '../src/transport/manager.js';
import webhookRoutes from '../src/api/webhook.js';
import healthRoutes from '../src/api/health.js';
import { initDatabase, closeDatabase } from '../src/persistence/database.js';

const TEST_DB_PATH = './data/test-transport.db';

function cleanupTestDb() {
  try { rmSync(TEST_DB_PATH, { force: true }); } catch {}
  try { rmSync(TEST_DB_PATH + '-wal', { force: true }); } catch {}
  try { rmSync(TEST_DB_PATH + '-shm', { force: true }); } catch {}
}

// ── Base transport adapter tests ──────────────────────────────────────────

describe('TransportAdapter base class', () => {
  it('initializes with idle status', () => {
    const adapter = new TransportAdapter('test');
    expect(adapter.name).toBe('test');
    const status = adapter.getStatus();
    expect(status.status).toBe(TRANSPORT_STATES.IDLE);
    expect(status.details).toBe('');
  });

  it('throws on unimplemented methods', async () => {
    const adapter = new TransportAdapter('test');
    await expect(adapter.initialize()).rejects.toThrow('initialize() not implemented');
    await expect(adapter.sendMessage('to', 'msg')).rejects.toThrow('sendMessage() not implemented');
    await expect(adapter.shutdown()).rejects.toThrow('shutdown() not implemented');
  });

  it('emits status_change on _setStatus', () => {
    const adapter = new TransportAdapter('test');
    const handler = vi.fn();
    adapter.on('status_change', handler);

    adapter._setStatus(TRANSPORT_STATES.CONNECTED, 'ready');

    expect(handler).toHaveBeenCalledWith({
      status: TRANSPORT_STATES.CONNECTED,
      details: 'ready',
    });
    expect(adapter.getStatus()).toEqual({
      status: TRANSPORT_STATES.CONNECTED,
      details: 'ready',
    });
  });

  it('is an EventEmitter', () => {
    const adapter = new TransportAdapter('test');
    expect(adapter).toBeInstanceOf(EventEmitter);
  });
});

// ── TRANSPORT_STATES enum tests ───────────────────────────────────────────

describe('TRANSPORT_STATES', () => {
  it('has all expected states', () => {
    expect(TRANSPORT_STATES.IDLE).toBe('idle');
    expect(TRANSPORT_STATES.WAITING_FOR_QR).toBe('waiting_for_qr');
    expect(TRANSPORT_STATES.CONNECTING).toBe('connecting');
    expect(TRANSPORT_STATES.CONNECTED).toBe('connected');
    expect(TRANSPORT_STATES.DISCONNECTED).toBe('disconnected');
    expect(TRANSPORT_STATES.RECONNECTING).toBe('reconnecting');
    expect(TRANSPORT_STATES.AUTH_FAILED).toBe('auth_failed');
    expect(TRANSPORT_STATES.ERROR).toBe('error');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(TRANSPORT_STATES)).toBe(true);
  });
});

// ── WhatsApp Cloud API transport tests ─────────────────────────────────────

describe('WhatsAppCloudTransport', () => {
  const baseConfig = {
    whatsapp: {
      mode: 'cloud_api',
      cloud: {
        accessToken: 'test-token',
        phoneNumberId: '123456',
        verifyToken: 'my-verify-token',
        webhookPath: '/webhook/whatsapp',
      },
      baileys: { authDir: './data/baileys-auth' },
    },
  };

  const silentLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  describe('initialize', () => {
    it('sets connected status when config is present', async () => {
      const transport = new WhatsAppCloudTransport(baseConfig);
      transport.setLogger(silentLogger);
      await transport.initialize();

      expect(transport.getStatus().status).toBe(TRANSPORT_STATES.CONNECTED);
    });

    it('sets error status when access token is missing', async () => {
      const badConfig = {
        whatsapp: {
          ...baseConfig.whatsapp,
          cloud: { ...baseConfig.whatsapp.cloud, accessToken: '' },
        },
      };
      const transport = new WhatsAppCloudTransport(badConfig);
      transport.setLogger(silentLogger);
      await transport.initialize();

      expect(transport.getStatus().status).toBe(TRANSPORT_STATES.ERROR);
    });

    it('sets error status when phone number ID is missing', async () => {
      const badConfig = {
        whatsapp: {
          ...baseConfig.whatsapp,
          cloud: { ...baseConfig.whatsapp.cloud, phoneNumberId: '' },
        },
      };
      const transport = new WhatsAppCloudTransport(badConfig);
      transport.setLogger(silentLogger);
      await transport.initialize();

      expect(transport.getStatus().status).toBe(TRANSPORT_STATES.ERROR);
    });
  });

  describe('shutdown', () => {
    it('sets disconnected status', async () => {
      const transport = new WhatsAppCloudTransport(baseConfig);
      transport.setLogger(silentLogger);
      await transport.initialize();
      await transport.shutdown();

      expect(transport.getStatus().status).toBe(TRANSPORT_STATES.DISCONNECTED);
    });
  });

  describe('sendMessage', () => {
    it('returns error when not connected', async () => {
      const transport = new WhatsAppCloudTransport(baseConfig);
      transport.setLogger(silentLogger);
      // Not initialized → status is IDLE
      const result = await transport.sendMessage('+1234567890', 'Hello');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Transport not connected');
    });

    it('sends message via Graph API when connected', async () => {
      const transport = new WhatsAppCloudTransport(baseConfig);
      transport.setLogger(silentLogger);
      await transport.initialize();

      // Mock global fetch
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          messages: [{ id: 'wamid.abc123' }],
        }),
      });
      globalThis.fetch = mockFetch;

      const result = await transport.sendMessage('+1234567890', 'Hello');

      expect(result.success).toBe(true);
      expect(result.platformMessageId).toBe('wamid.abc123');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('123456/messages');
      expect(opts.headers.Authorization).toBe('Bearer test-token');

      const body = JSON.parse(opts.body);
      expect(body.messaging_product).toBe('whatsapp');
      expect(body.to).toBe('+1234567890');
      expect(body.text.body).toBe('Hello');

      delete globalThis.fetch;
    });

    it('handles Graph API error responses', async () => {
      const transport = new WhatsAppCloudTransport(baseConfig);
      transport.setLogger(silentLogger);
      await transport.initialize();

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => '{"error":"Invalid token"}',
      });

      const result = await transport.sendMessage('+1234567890', 'Hello');
      expect(result.success).toBe(false);
      expect(result.error).toContain('401');

      delete globalThis.fetch;
    });

    it('handles fetch network errors', async () => {
      const transport = new WhatsAppCloudTransport(baseConfig);
      transport.setLogger(silentLogger);
      await transport.initialize();

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await transport.sendMessage('+1234567890', 'Hello');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');

      delete globalThis.fetch;
    });
  });

  describe('handleWebhookVerify', () => {
    it('returns challenge when verify token matches', () => {
      const transport = new WhatsAppCloudTransport(baseConfig);
      transport.setLogger(silentLogger);

      const challenge = transport.handleWebhookVerify({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'my-verify-token',
        'hub.challenge': 'test-challenge-123',
      });

      expect(challenge).toBe('test-challenge-123');
    });

    it('returns null when verify token does not match', () => {
      const transport = new WhatsAppCloudTransport(baseConfig);
      transport.setLogger(silentLogger);

      const challenge = transport.handleWebhookVerify({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong-token',
        'hub.challenge': 'test-challenge',
      });

      expect(challenge).toBeNull();
    });

    it('returns null when mode is not subscribe', () => {
      const transport = new WhatsAppCloudTransport(baseConfig);
      transport.setLogger(silentLogger);

      const challenge = transport.handleWebhookVerify({
        'hub.mode': 'unsubscribe',
        'hub.verify_token': 'my-verify-token',
        'hub.challenge': 'test-challenge',
      });

      expect(challenge).toBeNull();
    });
  });

  describe('handleWebhookInbound', () => {
    it('emits message event for text messages', () => {
      const transport = new WhatsAppCloudTransport(baseConfig);
      transport.setLogger(silentLogger);
      const handler = vi.fn();
      transport.on('message', handler);

      transport.handleWebhookInbound({
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              contacts: [{ wa_id: '1234567890', profile: { name: 'Test User' } }],
              messages: [{
                from: '1234567890',
                type: 'text',
                text: { body: 'Hello from WhatsApp' },
              }],
            },
          }],
        }],
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        from: '1234567890',
        displayName: 'Test User',
        content: 'Hello from WhatsApp',
        mediaInfo: null,
      });
    });

    it('emits message event for image messages', () => {
      const transport = new WhatsAppCloudTransport(baseConfig);
      transport.setLogger(silentLogger);
      const handler = vi.fn();
      transport.on('message', handler);

      transport.handleWebhookInbound({
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              contacts: [{ wa_id: '555', profile: { name: 'Pic User' } }],
              messages: [{
                from: '555',
                type: 'image',
                image: { id: 'img-123', caption: 'Check this out' },
              }],
            },
          }],
        }],
      });

      expect(handler).toHaveBeenCalledTimes(1);
      const call = handler.mock.calls[0][0];
      expect(call.content).toBe('Check this out');
      expect(call.mediaInfo).toEqual({ media_type: 'image', media_url: 'img-123' });
    });

    it('emits message event for audio messages', () => {
      const transport = new WhatsAppCloudTransport(baseConfig);
      transport.setLogger(silentLogger);
      const handler = vi.fn();
      transport.on('message', handler);

      transport.handleWebhookInbound({
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              contacts: [],
              messages: [{
                from: '777',
                type: 'audio',
                audio: { id: 'audio-456' },
              }],
            },
          }],
        }],
      });

      expect(handler).toHaveBeenCalledTimes(1);
      const call = handler.mock.calls[0][0];
      expect(call.content).toBe('[Audio message]');
      expect(call.mediaInfo).toEqual({ media_type: 'audio', media_url: 'audio-456' });
    });

    it('handles unsupported message types', () => {
      const transport = new WhatsAppCloudTransport(baseConfig);
      transport.setLogger(silentLogger);
      const handler = vi.fn();
      transport.on('message', handler);

      transport.handleWebhookInbound({
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              contacts: [],
              messages: [{ from: '999', type: 'sticker' }],
            },
          }],
        }],
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].content).toBe('[Unsupported message type: sticker]');
    });

    it('ignores payloads not from whatsapp_business_account', () => {
      const transport = new WhatsAppCloudTransport(baseConfig);
      transport.setLogger(silentLogger);
      const handler = vi.fn();
      transport.on('message', handler);

      transport.handleWebhookInbound({ object: 'other' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('handles empty entries gracefully', () => {
      const transport = new WhatsAppCloudTransport(baseConfig);
      transport.setLogger(silentLogger);
      const handler = vi.fn();
      transport.on('message', handler);

      transport.handleWebhookInbound({
        object: 'whatsapp_business_account',
        entry: [],
      });
      expect(handler).not.toHaveBeenCalled();
    });

    it('uses phone number as display name when contact not found', () => {
      const transport = new WhatsAppCloudTransport(baseConfig);
      transport.setLogger(silentLogger);
      const handler = vi.fn();
      transport.on('message', handler);

      transport.handleWebhookInbound({
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              contacts: [],
              messages: [{ from: '1112223333', type: 'text', text: { body: 'Hi' } }],
            },
          }],
        }],
      });

      expect(handler.mock.calls[0][0].displayName).toBe('1112223333');
    });
  });
});

// ── Transport Manager tests ───────────────────────────────────────────────

describe('createTransportManager', () => {
  const cloudConfig = {
    whatsapp: {
      mode: 'cloud_api',
      cloud: {
        accessToken: 'test-token',
        phoneNumberId: '123',
        verifyToken: 'verify-me',
        webhookPath: '/webhook/whatsapp',
      },
      baileys: { authDir: './data/baileys-auth' },
    },
  };

  const silentLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const mockOrchestrator = {
    handleIncomingMessage: vi.fn().mockResolvedValue({ aiReply: null, reason: 'auto_reply_disabled' }),
    handleOperatorMessage: vi.fn(),
  };

  it('initializes with cloud_api mode', async () => {
    const manager = createTransportManager(cloudConfig, mockOrchestrator, null, silentLogger);
    await manager.initialize();

    const status = manager.getStatus();
    expect(status.mode).toBe('cloud_api');
    expect(status.status).toBe('connected');

    await manager.shutdown();
  });

  it('reports idle status before initialization', () => {
    const manager = createTransportManager(cloudConfig, mockOrchestrator, null, silentLogger);
    const status = manager.getStatus();
    expect(status.mode).toBe('cloud_api');
    expect(status.status).toBe('idle');
  });

  it('routes inbound messages to orchestrator', async () => {
    const orchestrator = {
      handleIncomingMessage: vi.fn().mockResolvedValue({ aiReply: null, reason: 'auto_reply_disabled' }),
      handleOperatorMessage: vi.fn(),
    };

    const manager = createTransportManager(cloudConfig, orchestrator, null, silentLogger);
    await manager.initialize();

    // Simulate an inbound message via the transport's webhook handler
    const transport = manager.getTransport();
    transport.handleWebhookInbound({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            contacts: [{ wa_id: '555', profile: { name: 'Jane' } }],
            messages: [{ from: '555', type: 'text', text: { body: 'Hi there' } }],
          },
        }],
      }],
    });

    // Wait for async handler
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(orchestrator.handleIncomingMessage).toHaveBeenCalledWith(
      'whatsapp',
      '555',
      'Jane',
      'Hi there',
      null,
    );

    await manager.shutdown();
  });

  it('sends AI reply back via transport when auto_reply is on', async () => {
    const orchestrator = {
      handleIncomingMessage: vi.fn().mockResolvedValue({
        aiReply: { content: 'Hello from AI', id: 1 },
      }),
      handleOperatorMessage: vi.fn(),
    };

    const manager = createTransportManager(cloudConfig, orchestrator, null, silentLogger);
    await manager.initialize();

    // Mock fetch for sending
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.reply' }] }),
    });
    globalThis.fetch = mockFetch;

    const transport = manager.getTransport();
    transport.handleWebhookInbound({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            contacts: [{ wa_id: '555', profile: { name: 'Jane' } }],
            messages: [{ from: '555', type: 'text', text: { body: 'Hi' } }],
          },
        }],
      }],
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text.body).toBe('Hello from AI');

    delete globalThis.fetch;
    await manager.shutdown();
  });

  it('emits status:update via Socket.IO on transport status changes', async () => {
    const mockIO = { emit: vi.fn() };
    const manager = createTransportManager(cloudConfig, mockOrchestrator, mockIO, silentLogger);
    await manager.initialize();

    // Cloud API emits 'connected' during initialize
    expect(mockIO.emit).toHaveBeenCalledWith('status:update', expect.objectContaining({
      whatsapp: expect.objectContaining({
        mode: 'cloud_api',
        status: 'connected',
      }),
    }));

    await manager.shutdown();
  });

  it('shutdown is safe to call multiple times', async () => {
    const manager = createTransportManager(cloudConfig, mockOrchestrator, null, silentLogger);
    await manager.initialize();
    await manager.shutdown();
    await manager.shutdown(); // should not throw
  });

  it('getTransport returns the adapter', async () => {
    const manager = createTransportManager(cloudConfig, mockOrchestrator, null, silentLogger);
    await manager.initialize();

    const transport = manager.getTransport();
    expect(transport).toBeDefined();
    expect(transport.name).toBe('whatsapp-cloud');

    await manager.shutdown();
  });
});

// ── Webhook route tests ───────────────────────────────────────────────────

describe('Webhook routes (Cloud API)', () => {
  const config = {
    version: '2.0.0',
    host: '127.0.0.1',
    port: 0,
    logLevel: 'silent',
    databasePath: TEST_DB_PATH,
    ai: { provider: 'openai', openaiApiKey: '', openaiBaseUrl: '', openaiModel: 'gpt-4o-mini' },
    whatsapp: {
      mode: 'cloud_api',
      cloud: {
        accessToken: 'test-token',
        phoneNumberId: '123',
        verifyToken: 'my-secret',
        webhookPath: '/webhook/whatsapp',
      },
      baileys: { authDir: './data/baileys-auth' },
    },
    telegram: { enabled: false },
    defaults: { tone: 'friendly', flirt: 'none', temperature: 0.7, maxTokens: 1000, maxHistory: 50 },
  };

  const silentLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  let fastify;
  let transportManager;

  beforeEach(async () => {
    cleanupTestDb();
    initDatabase(config);

    const mockOrchestrator = {
      handleIncomingMessage: vi.fn().mockResolvedValue({ aiReply: null }),
      handleOperatorMessage: vi.fn(),
    };

    transportManager = createTransportManager(config, mockOrchestrator, null, silentLogger);
    await transportManager.initialize();

    fastify = Fastify({ logger: false });
    fastify.register(formbody);
    fastify.register(webhookRoutes, { transportManager, config });
    await fastify.ready();
  });

  afterEach(async () => {
    await transportManager.shutdown();
    await fastify.close();
    closeDatabase();
    cleanupTestDb();
  });

  it('GET webhook — verifies with correct token', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=my-secret&hub.challenge=challenge123',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('challenge123');
  });

  it('GET webhook — rejects incorrect token', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge123',
    });

    expect(res.statusCode).toBe(403);
  });

  it('POST webhook — accepts valid payload', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/webhook/whatsapp',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              contacts: [],
              messages: [{ from: '123', type: 'text', text: { body: 'Hi' } }],
            },
          }],
        }],
      }),
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('OK');
  });

  it('POST webhook — handles empty body', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/webhook/whatsapp',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.statusCode).toBe(200);
  });
});

// ── Health endpoint integration with transport ────────────────────────────

describe('Health endpoint with transport status', () => {
  const config = {
    version: '2.0.0',
    host: '127.0.0.1',
    port: 0,
    logLevel: 'silent',
    databasePath: TEST_DB_PATH,
    ai: { provider: 'openai', openaiApiKey: '', openaiBaseUrl: '', openaiModel: 'gpt-4o-mini' },
    whatsapp: {
      mode: 'cloud_api',
      cloud: {
        accessToken: 'test-token',
        phoneNumberId: '123',
        verifyToken: 'verify',
        webhookPath: '/webhook/whatsapp',
      },
      baileys: { authDir: './data/baileys-auth' },
    },
    telegram: { enabled: false },
    defaults: { tone: 'friendly', flirt: 'none', temperature: 0.7, maxTokens: 1000, maxHistory: 50 },
  };

  const silentLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  let fastify;
  let transportManager;

  beforeEach(async () => {
    cleanupTestDb();
    initDatabase(config);

    const mockOrchestrator = {
      handleIncomingMessage: vi.fn().mockResolvedValue({ aiReply: null }),
      handleOperatorMessage: vi.fn(),
    };

    transportManager = createTransportManager(config, mockOrchestrator, null, silentLogger);
    await transportManager.initialize();

    const mockAI = {
      getStatus: vi.fn().mockReturnValue({ connected: false, model: 'gpt-4o-mini', provider: 'openai', lastError: null }),
    };

    fastify = Fastify({ logger: false });
    fastify.register(healthRoutes, { config, aiProvider: mockAI, transportManager });
    await fastify.ready();
  });

  afterEach(async () => {
    await transportManager.shutdown();
    await fastify.close();
    closeDatabase();
    cleanupTestDb();
  });

  it('includes whatsapp status in health response', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/health' });
    const body = JSON.parse(res.body);

    expect(body.success).toBe(true);
    expect(body.data.whatsapp).toBeDefined();
    expect(body.data.whatsapp.mode).toBe('cloud_api');
    expect(body.data.whatsapp.status).toBe('connected');
  });
});
