import { TransportAdapter, TRANSPORT_STATES } from './base.js';
import QRCode from 'qrcode';

// Baileys import — dynamic to allow the system to boot even if baileys has issues
let makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore;

const BACKOFF_DELAYS = [2000, 5000, 10000, 30000, 60000]; // ms

/**
 * WhatsApp Baileys (Web) transport adapter.
 *
 * Uses @whiskeysockets/baileys to emulate WhatsApp Web protocol.
 * Handles QR auth, session persistence, reconnection with backoff.
 */
export class WhatsAppBaileysTransport extends TransportAdapter {
  constructor(config) {
    super('whatsapp-baileys');
    this._config = config.whatsapp.baileys;
    this._fullConfig = config;
    this._socket = null;
    this._logger = null;
    this._reconnectAttempt = 0;
    this._reconnectTimer = null;
    this._intentionalDisconnect = false;
  }

  setLogger(logger) {
    this._logger = logger;
  }

  _log(level, msg, meta) {
    if (this._logger) this._logger[level]({ ...meta }, `[whatsapp-baileys] ${msg}`);
  }

  /**
   * Initialize: dynamically import baileys, load auth state, connect.
   */
  async initialize() {
    try {
      await this._loadBaileys();
    } catch (err) {
      this._setStatus(TRANSPORT_STATES.ERROR, `Failed to load Baileys: ${err.message}`);
      this._log('error', `Failed to load Baileys module: ${err.message}`);
      return;
    }

    await this._connect();
  }

  /**
   * Dynamically import baileys so the app can boot even if the module is missing.
   */
  async _loadBaileys() {
    const baileys = await import('@whiskeysockets/baileys');
    // Baileys v6 exports vary — handle both default and named exports
    const mod = baileys.default ?? baileys;
    makeWASocket = mod.default ?? mod.makeWASocket ?? mod;
    useMultiFileAuthState = baileys.useMultiFileAuthState ?? mod.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason ?? mod.DisconnectReason;
    fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion ?? mod.fetchLatestBaileysVersion;
    makeCacheableSignalKeyStore = baileys.makeCacheableSignalKeyStore ?? mod.makeCacheableSignalKeyStore;
  }

  /**
   * Create the Baileys socket and wire up all event handlers.
   */
  async _connect() {
    this._setStatus(TRANSPORT_STATES.CONNECTING, 'Loading auth state…');

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this._config.authDir);

      // Create a silent pino logger for Baileys internal logging
      const { default: pino } = await import('pino');
      const baileysLogger = pino({ level: 'silent' });

      let version;
      try {
        const versionInfo = await fetchLatestBaileysVersion();
        version = versionInfo.version;
      } catch {
        this._log('warn', 'Could not fetch latest Baileys version, using default');
      }

      const socketOpts = {
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore
            ? makeCacheableSignalKeyStore(state.keys, baileysLogger)
            : state.keys,
        },
        logger: baileysLogger,
        browser: ['AnomChatBot', 'Chrome', '120.0.0'],
        generateHighQualityLinkPreview: false,
      };

      if (version) {
        socketOpts.version = version;
      }

      this._socket = makeWASocket(socketOpts);

      // ── Credential updates ───────────────────────────────────────────────
      this._socket.ev.on('creds.update', saveCreds);

      // ── Connection updates ───────────────────────────────────────────────
      this._socket.ev.on('connection.update', (update) => {
        this._handleConnectionUpdate(update);
      });

      // ── Incoming messages ────────────────────────────────────────────────
      this._socket.ev.on('messages.upsert', (upsert) => {
        this._handleMessagesUpsert(upsert);
      });

    } catch (err) {
      this._setStatus(TRANSPORT_STATES.ERROR, `Connection failed: ${err.message}`);
      this._log('error', `Connection error: ${err.message}`);
      this._scheduleReconnect();
    }
  }

  /**
   * Handle Baileys connection.update events: QR, open, close.
   */
  async _handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    // QR code available — emit for GUI and log for terminal
    if (qr) {
      this._setStatus(TRANSPORT_STATES.WAITING_FOR_QR, 'Scan QR code with WhatsApp');
      try {
        const qrDataUrl = await QRCode.toDataURL(qr);
        this.emit('qr', { qrDataUrl });
        this._log('info', 'QR code generated — scan with WhatsApp mobile app');
      } catch (err) {
        this._log('error', `QR code generation failed: ${err.message}`);
      }
    }

    if (connection === 'open') {
      this._reconnectAttempt = 0;
      this._setStatus(TRANSPORT_STATES.CONNECTED, 'WhatsApp Web connected');
      this._log('info', 'Connected to WhatsApp Web');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.message ?? 'Unknown';

      this._log('warn', `Connection closed: ${reason} (code: ${statusCode})`);

      if (this._intentionalDisconnect) {
        this._setStatus(TRANSPORT_STATES.DISCONNECTED, 'Intentionally disconnected');
        return;
      }

      // Auth failure — need fresh QR scan
      if (statusCode === DisconnectReason?.loggedOut) {
        this._setStatus(TRANSPORT_STATES.AUTH_FAILED, 'Logged out — re-authentication required');
        this._log('warn', 'Logged out from WhatsApp — need to re-scan QR code');
        // Clear socket reference but don't reconnect automatically
        this._socket = null;
        return;
      }

      // Other disconnect — attempt reconnect
      this._scheduleReconnect();
    }
  }

  /**
   * Handle incoming messages from Baileys.
   */
  _handleMessagesUpsert(upsert) {
    const messages = upsert.messages ?? [];
    const type = upsert.type; // 'notify' for new messages

    if (type !== 'notify') return;

    for (const msg of messages) {
      // Skip messages from self
      if (msg.key.fromMe) continue;

      // Skip status broadcasts
      if (msg.key.remoteJid === 'status@broadcast') continue;

      const from = msg.key.remoteJid;
      const pushName = msg.pushName ?? from;

      let content = '';
      let mediaInfo = null;

      const msgContent = msg.message;
      if (!msgContent) continue;

      if (msgContent.conversation) {
        content = msgContent.conversation;
      } else if (msgContent.extendedTextMessage?.text) {
        content = msgContent.extendedTextMessage.text;
      } else if (msgContent.imageMessage) {
        content = msgContent.imageMessage.caption ?? '[Image]';
        mediaInfo = { media_type: 'image', media_url: msg.key.id ?? '' };
      } else if (msgContent.audioMessage) {
        content = '[Audio message]';
        mediaInfo = { media_type: 'audio', media_url: msg.key.id ?? '' };
      } else if (msgContent.videoMessage) {
        content = msgContent.videoMessage.caption ?? '[Video]';
        mediaInfo = { media_type: 'video', media_url: msg.key.id ?? '' };
      } else if (msgContent.documentMessage) {
        content = msgContent.documentMessage.fileName ?? '[Document]';
        mediaInfo = { media_type: 'document', media_url: msg.key.id ?? '' };
      } else {
        content = '[Unsupported message type]';
      }

      // Normalize Baileys JID to phone number (strip @s.whatsapp.net)
      const phoneNumber = from.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '');

      this._log('info', `Inbound message from ${phoneNumber}`, { pushName });

      this.emit('message', {
        from: phoneNumber,
        displayName: pushName,
        content,
        mediaInfo,
      });
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff.
   */
  _scheduleReconnect() {
    if (this._intentionalDisconnect) return;

    const delay = BACKOFF_DELAYS[Math.min(this._reconnectAttempt, BACKOFF_DELAYS.length - 1)];
    this._reconnectAttempt++;

    this._setStatus(TRANSPORT_STATES.RECONNECTING, `Reconnecting in ${delay / 1000}s (attempt ${this._reconnectAttempt})`);
    this._log('info', `Reconnecting in ${delay / 1000}s (attempt ${this._reconnectAttempt})`);

    this._reconnectTimer = setTimeout(() => {
      this._connect();
    }, delay);
  }

  /**
   * Send a text message via Baileys.
   */
  async sendMessage(to, content, options = {}) {
    if (!this._socket || this._status !== TRANSPORT_STATES.CONNECTED) {
      return { success: false, error: 'Transport not connected' };
    }

    // Normalize recipient to Baileys JID format
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    try {
      const result = await this._socket.sendMessage(jid, { text: content });
      const messageId = result?.key?.id ?? null;
      this._log('info', `Message sent to ${to}`, { platformMessageId: messageId });
      return { success: true, platformMessageId: messageId };
    } catch (err) {
      this._log('error', `Send error to ${to}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Graceful shutdown: close the Baileys socket, cancel reconnect timer.
   */
  async shutdown() {
    this._intentionalDisconnect = true;

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    if (this._socket) {
      try {
        await this._socket.logout();
      } catch {
        // logout may fail if already disconnected — that's fine
      }
      try {
        this._socket.end(undefined);
      } catch {
        // end may also fail — ignore
      }
      this._socket = null;
    }

    this._setStatus(TRANSPORT_STATES.DISCONNECTED, 'Shut down');
    this._log('info', 'Baileys transport shut down');
  }
}
