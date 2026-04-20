import { EventEmitter } from 'node:events';

/**
 * Transport states — every adapter must report one of these.
 */
export const TRANSPORT_STATES = Object.freeze({
  IDLE: 'idle',
  WAITING_FOR_QR: 'waiting_for_qr',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  AUTH_FAILED: 'auth_failed',
  ERROR: 'error',
});

/**
 * Base class for transport adapters.
 * Subclasses must implement: initialize(), sendMessage(), shutdown().
 * Subclasses may implement: sendPresenceUpdate(), markRead(), fetchProfilePhoto().
 *
 * Events emitted:
 *  - 'message'        → { from, displayName, content, mediaInfo?, messageKey? }
 *  - 'status_change'  → { status, details? }
 *  - 'qr'             → { qrDataUrl }  (Baileys only)
 */
export class TransportAdapter extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this._status = TRANSPORT_STATES.IDLE;
    this._statusDetails = '';
  }

  /** Initialize and connect the transport. */
  async initialize() {
    throw new Error(`${this.name}: initialize() not implemented`);
  }

  /**
   * Send a message to a recipient.
   * @param {string} to — recipient identifier (phone number, etc.)
   * @param {string} content — text content
   * @param {object} [options] — optional { mediaUrl, mediaType }
   * @returns {Promise<{ success: boolean, platformMessageId?: string, error?: string }>}
   */
  async sendMessage(to, content, options = {}) {
    throw new Error(`${this.name}: sendMessage() not implemented`);
  }

  /** Gracefully disconnect and clean up. */
  async shutdown() {
    throw new Error(`${this.name}: shutdown() not implemented`);
  }

  /**
   * Send presence update (online, typing, etc.).
   * Not all transports support this — default is no-op.
   * @param {string} type — 'available' | 'unavailable' | 'composing' | 'paused'
   * @param {string} [jid] — recipient JID (required for composing/paused)
   */
  async sendPresenceUpdate(type, jid) {
    // No-op by default
  }

  /**
   * Mark messages as read (blue ticks).
   * Not all transports support this — default is no-op.
   * @param {object[]} messageKeys — transport-specific message keys
   */
  async markRead(messageKeys) {
    // No-op by default
  }

  /**
   * Fetch profile photo URL for a contact.
   * Not all transports support this — default returns null.
   * @param {string} remoteId — phone number or JID
   * @returns {Promise<string|null>} — Profile photo URL or null
   */
  async fetchProfilePhoto(remoteId) {
    return null;
  }

  /**
   * Report current status.
   * @returns {{ status: string, details: string }}
   */
  getStatus() {
    return { status: this._status, details: this._statusDetails };
  }

  /**
   * Update internal status and emit status_change event.
   * @param {string} status — one of TRANSPORT_STATES values
   * @param {string} [details] — human-readable context
   */
  _setStatus(status, details = '') {
    this._status = status;
    this._statusDetails = details;
    this.emit('status_change', { status, details });
  }
}
