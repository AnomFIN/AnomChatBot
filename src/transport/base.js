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
 * Subclasses must implement: initialize(), sendMessage(), shutdown(), getStatus().
 *
 * Events emitted:
 *  - 'message'        → { from, displayName, content, mediaInfo? }
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
