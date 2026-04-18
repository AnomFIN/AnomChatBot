import { WhatsAppCloudTransport } from './whatsappCloud.js';
import { WhatsAppBaileysTransport } from './whatsappBaileys.js';
import { TRANSPORT_STATES } from './base.js';

/**
 * Transport Manager — creates the correct WhatsApp transport adapter
 * based on config, wires events to orchestrator and Socket.IO, and
 * exposes lifecycle methods for index.js.
 *
 * @param {object} config — Frozen app config
 * @param {object} orchestrator — { handleIncomingMessage, handleOperatorMessage }
 * @param {object|null} io — Socket.IO server instance
 * @param {object} logger — Pino logger
 * @returns {{ transport, initialize(), shutdown(), getStatus() }}
 */
export function createTransportManager(config, orchestrator, io, logger) {
  let transport = null;

  function log(level, msg, meta) {
    logger[level]({ ...meta }, `[transport-manager] ${msg}`);
  }

  /**
   * Create the appropriate transport adapter based on WHATSAPP_MODE.
   */
  function createTransport() {
    const mode = config.whatsapp.mode;

    if (mode === 'cloud_api') {
      transport = new WhatsAppCloudTransport(config);
    } else if (mode === 'baileys') {
      transport = new WhatsAppBaileysTransport(config);
    } else {
      throw new Error(`Unknown WHATSAPP_MODE: ${mode}`);
    }

    transport.setLogger(logger);
    return transport;
  }

  /**
   * Wire transport events to orchestrator and Socket.IO.
   */
  function wireEvents() {
    // Inbound messages → orchestrator → send AI reply back
    transport.on('message', async ({ from, displayName, content, mediaInfo }) => {
      log('info', `Inbound from ${from}: ${content.slice(0, 80)}`);

      try {
        const result = await orchestrator.handleIncomingMessage(
          'whatsapp',
          from,
          displayName,
          content,
          mediaInfo,
        );

        // If AI generated a reply, send it back via transport
        if (result.aiReply) {
          const sendResult = await transport.sendMessage(from, result.aiReply.content);
          if (!sendResult.success) {
            log('warn', `Failed to send reply to ${from}: ${sendResult.error}`);
          }
        }
      } catch (err) {
        log('error', `Error handling inbound message: ${err.message}`, { err });
      }
    });

    // Status changes → Socket.IO broadcast
    transport.on('status_change', ({ status, details }) => {
      log('info', `Transport status: ${status}${details ? ` — ${details}` : ''}`);
      if (io) {
        io.emit('status:update', {
          whatsapp: { mode: config.whatsapp.mode, status, details },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // QR code events (Baileys only) → Socket.IO
    transport.on('qr', ({ qrDataUrl }) => {
      log('info', 'QR code available — broadcasting to GUI');
      if (io) {
        io.emit('transport:qr', { qrDataUrl });
      }
    });
  }

  /**
   * Initialize: create transport, wire events, start it.
   */
  async function initialize() {
    createTransport();
    wireEvents();

    try {
      await transport.initialize();
      log('info', `WhatsApp transport initialized (mode: ${config.whatsapp.mode})`);
    } catch (err) {
      log('error', `WhatsApp transport failed to initialize: ${err.message}`, { err });
      // Don't throw — transport failure should not crash the system
    }
  }

  /**
   * Shutdown the transport gracefully.
   */
  async function shutdown() {
    if (transport) {
      try {
        await transport.shutdown();
        log('info', 'WhatsApp transport shut down');
      } catch (err) {
        log('error', `Error shutting down transport: ${err.message}`, { err });
      }
    }
  }

  /**
   * Get current transport status for health endpoint / GUI.
   */
  function getStatus() {
    if (!transport) {
      return { mode: config.whatsapp.mode, status: TRANSPORT_STATES.IDLE, details: 'Not initialized' };
    }
    const ts = transport.getStatus();
    return { mode: config.whatsapp.mode, ...ts };
  }

  /**
   * Get the underlying transport adapter (needed for webhook routes).
   */
  function getTransport() {
    return transport;
  }

  return {
    initialize,
    shutdown,
    getStatus,
    getTransport,
  };
}
