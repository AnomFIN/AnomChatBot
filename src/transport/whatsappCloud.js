import { TransportAdapter, TRANSPORT_STATES } from './base.js';

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

/**
 * WhatsApp Cloud API transport adapter.
 *
 * Uses the official Meta Graph API for sending messages.
 * Inbound messages arrive via webhook (see src/api/webhook.js).
 * Webhook routes call handleWebhookVerify / handleWebhookInbound methods here,
 * which then emit 'message' events for the transport manager to route.
 */
export class WhatsAppCloudTransport extends TransportAdapter {
  constructor(config) {
    super('whatsapp-cloud');
    this._config = config.whatsapp.cloud;
    this._logger = null;
  }

  setLogger(logger) {
    this._logger = logger;
  }

  _log(level, msg, meta) {
    if (this._logger) this._logger[level]({ ...meta }, `[whatsapp-cloud] ${msg}`);
  }

  /**
   * Initialize: validate required config, set status.
   * Cloud API is "connected" once config is valid — it's stateless HTTP.
   */
  async initialize() {
    if (!this._config.accessToken || !this._config.phoneNumberId) {
      this._setStatus(TRANSPORT_STATES.ERROR, 'Missing WHATSAPP_CLOUD_ACCESS_TOKEN or WHATSAPP_CLOUD_PHONE_NUMBER_ID');
      this._log('warn', 'Cloud API not configured — missing credentials');
      return;
    }

    this._setStatus(TRANSPORT_STATES.CONNECTED, 'Cloud API ready (webhook-based)');
    this._log('info', 'Cloud API transport initialized');
  }

  /**
   * Send a text message via the Graph API.
   */
  async sendMessage(to, content, options = {}) {
    if (this._status !== TRANSPORT_STATES.CONNECTED) {
      return { success: false, error: 'Transport not connected' };
    }

    const url = `${GRAPH_API_BASE}/${this._config.phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: content },
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this._config.accessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.text();
        this._log('error', `Send failed: ${res.status}`, { responseBody: errBody });
        return { success: false, error: `HTTP ${res.status}: ${errBody}` };
      }

      const data = await res.json();
      const messageId = data?.messages?.[0]?.id ?? null;
      this._log('info', `Message sent to ${to}`, { platformMessageId: messageId });
      return { success: true, platformMessageId: messageId };
    } catch (err) {
      this._log('error', `Send error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Shutdown — nothing to clean up for stateless HTTP.
   */
  async shutdown() {
    this._setStatus(TRANSPORT_STATES.DISCONNECTED, 'Shut down');
    this._log('info', 'Cloud API transport shut down');
  }

  // ── Webhook handling ─────────────────────────────────────────────────────

  /**
   * Handle Meta webhook verification (GET).
   * Returns the challenge string or null if verification fails.
   */
  handleWebhookVerify(query) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === this._config.verifyToken) {
      this._log('info', 'Webhook verified');
      return challenge;
    }

    this._log('warn', 'Webhook verification failed', { mode, tokenMatch: token === this._config.verifyToken });
    return null;
  }

  /**
   * Handle inbound webhook POST from Meta.
   * Parses the Cloud API webhook payload and emits 'message' events.
   */
  handleWebhookInbound(body) {
    if (body?.object !== 'whatsapp_business_account') return;

    const entries = body.entry ?? [];
    for (const entry of entries) {
      const changes = entry.changes ?? [];
      for (const change of changes) {
        const value = change.value ?? {};
        const messages = value.messages ?? [];
        const contacts = value.contacts ?? [];

        for (const msg of messages) {
          const from = msg.from;
          const contact = contacts.find(c => c.wa_id === from);
          const displayName = contact?.profile?.name ?? from;

          let content = '';
          let mediaInfo = null;
          let downloadMedia = null;

          if (msg.type === 'text') {
            content = msg.text?.body ?? '';
          } else if (msg.type === 'image') {
            content = msg.image?.caption ?? '[Image]';
            mediaInfo = {
              media_type: 'image',
              media_url: msg.image?.id ?? '',
              media_mime_type: msg.image?.mime_type ?? 'image/jpeg',
            };
            downloadMedia = this._createCloudMediaDownloader(msg.image?.id);
          } else if (msg.type === 'audio') {
            content = '[Audio message]';
            mediaInfo = {
              media_type: 'audio',
              media_url: msg.audio?.id ?? '',
              media_mime_type: msg.audio?.mime_type ?? 'audio/ogg',
            };
            downloadMedia = this._createCloudMediaDownloader(msg.audio?.id);
          } else if (msg.type === 'video') {
            content = msg.video?.caption ?? '[Video]';
            mediaInfo = {
              media_type: 'video',
              media_url: msg.video?.id ?? '',
              media_mime_type: msg.video?.mime_type ?? 'video/mp4',
            };
            downloadMedia = this._createCloudMediaDownloader(msg.video?.id);
          } else if (msg.type === 'document') {
            content = msg.document?.filename ?? '[Document]';
            mediaInfo = {
              media_type: 'document',
              media_url: msg.document?.id ?? '',
              media_mime_type: msg.document?.mime_type ?? 'application/octet-stream',
              original_name: msg.document?.filename ?? null,
            };
            downloadMedia = this._createCloudMediaDownloader(msg.document?.id);
          } else {
            content = `[Unsupported message type: ${msg.type}]`;
          }

          this._log('info', `Inbound message from ${from}`, { type: msg.type, mediaType: mediaInfo?.media_type });

          this.emit('message', {
            from,
            displayName,
            content,
            mediaInfo,
            downloadMedia,
          });
        }
      }
    }
  }

  /**
   * Create a media download function for Cloud API.
   * Cloud API requires two steps: GET media URL, then download the binary.
   * Returns an async function that produces a Buffer.
   */
  _createCloudMediaDownloader(mediaId) {
    if (!mediaId) return null;
    const accessToken = this._config.accessToken;

    return async () => {
      // Step 1: Fetch the media URL from Graph API
      const metaRes = await fetch(`${GRAPH_API_BASE}/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!metaRes.ok) {
        throw new Error(`Cloud API media metadata fetch failed: HTTP ${metaRes.status}`);
      }

      const metaData = await metaRes.json();
      const mediaUrl = metaData.url;

      if (!mediaUrl) {
        throw new Error('Cloud API media URL not found in response');
      }

      // Step 2: Download the actual binary from the URL
      const downloadRes = await fetch(mediaUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!downloadRes.ok) {
        throw new Error(`Cloud API media download failed: HTTP ${downloadRes.status}`);
      }

      const arrayBuffer = await downloadRes.arrayBuffer();
      return Buffer.from(arrayBuffer);
    };
  }
}
