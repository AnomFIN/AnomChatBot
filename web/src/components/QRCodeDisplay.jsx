import { useQRCode } from '../hooks/useStatus.js';

export default function QRCodeDisplay({ whatsappStatus }) {
  const { qrDataUrl } = useQRCode();

  const status = whatsappStatus?.status;
  const mode = whatsappStatus?.mode;

  // Only show QR section for Baileys mode
  if (mode !== 'baileys') return null;

  if (status === 'connected') {
    return (
      <div className="qr-display">
        <h3>WhatsApp (Baileys)</h3>
        <div className="qr-connected">✓ Connected</div>
      </div>
    );
  }

  if (status === 'waiting_for_qr' && qrDataUrl) {
    return (
      <div className="qr-display">
        <h3>WhatsApp (Baileys)</h3>
        <p>Scan this QR code with WhatsApp on your phone:</p>
        <img src={qrDataUrl} alt="WhatsApp QR Code" className="qr-image" />
      </div>
    );
  }

  return (
    <div className="qr-display">
      <h3>WhatsApp (Baileys)</h3>
      <div className="qr-status">Status: {status || 'unknown'}</div>
      {whatsappStatus?.details && (
        <div className="qr-details">{whatsappStatus.details}</div>
      )}
    </div>
  );
}
