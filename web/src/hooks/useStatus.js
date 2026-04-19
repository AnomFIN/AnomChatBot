import { useState, useEffect, useCallback } from 'react';
import { getHealth } from '../api/client.js';
import { useSocket } from './useSocket.js';

export function useStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getHealth();
      setStatus(data);
    } catch (err) {
      console.error('Failed to load status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh periodically
  useEffect(() => {
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  // Real-time status updates
  useSocket('status:update', useCallback((update) => {
    setStatus(prev => prev ? { ...prev, ...update } : update);
  }, []));

  return { status, loading, refresh: load };
}

export function useQRCode() {
  const [qrDataUrl, setQrDataUrl] = useState(null);

  useSocket('transport:qr', useCallback(({ qrDataUrl: url }) => {
    setQrDataUrl(url);
  }, []));

  // Clear QR when transport connects
  useSocket('status:update', useCallback((update) => {
    if (update?.whatsapp?.status === 'connected') {
      setQrDataUrl(null);
    }
  }, []));

  return { qrDataUrl };
}
