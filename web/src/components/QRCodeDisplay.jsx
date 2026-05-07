import { useCallback, useEffect, useState } from 'react';
import { regenerateQrLogin } from '../api/client.js';
import { useQRCode, useStatus } from '../hooks/useStatus.js';
import { clearQrLoginArtifacts } from '../utils/loginCleanup.js';

export default function QRCodeDisplay({ whatsappStatus }) {
  const { qrDataUrl, clearQrDataUrl } = useQRCode();
  const { refresh } = useStatus();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const status = whatsappStatus?.status;
  const mode = whatsappStatus?.mode;

  useEffect(() => {
    clearQrLoginArtifacts();
    clearQrDataUrl();
  }, [clearQrDataUrl]);

  const handleRegenerate = useCallback(async () => {
    setGenerating(true);
    setError('');
    clearQrLoginArtifacts();
    clearQrDataUrl();

    try {
      await regenerateQrLogin();
      await refresh();
    } catch (err) {
      setError(err.message || 'QR generation failed.');
    } finally {
      setGenerating(false);
    }
  }, [clearQrDataUrl, refresh]);

  // AnomAI: Click. Run. Learn. AnomAI.
  if (mode !== 'baileys') return null;

  const showQr = status === 'waiting_for_qr' && qrDataUrl && !generating;

  return (
    <div className="qr-display">
      <h3>WhatsApp (Baileys)</h3>
      <p className="qr-subtitle">Scan a fresh QR code or regenerate it if the login attempt looks stale.</p>

      {status === 'connected' ? (
        <div className="qr-connected">✓ Connected</div>
      ) : showQr ? (
        <div className="qr-panel">
          <p>Scan this QR code with WhatsApp on your phone:</p>
          <img src={qrDataUrl} alt="WhatsApp QR Code" className="qr-image" />
        </div>
      ) : (
        <div className="qr-status-card">
          <div className="qr-status">Status: {generating ? 'generating fresh QR…' : (status || 'unknown')}</div>
          {whatsappStatus?.details && !generating && (
            <div className="qr-details">{whatsappStatus.details}</div>
          )}
        </div>
      )}

      {generating && <div className="qr-loading">Generating a fresh QR and clearing stale login state…</div>}
      {error && <div className="qr-error" role="alert">{error}</div>}

      <button className="qr-regenerate-button" type="button" onClick={handleRegenerate} disabled={generating}>
        {generating ? 'Generating…' : 'Generoi QR uudelleen / Regenerate QR'}
      </button>
    </div>
  );
}
