import { useSocketContext } from '../context/SocketContext.jsx';

const STATUS_COLORS = {
  connected: '#22c55e',
  ok: '#22c55e',
  waiting_for_qr: '#eab308',
  connecting: '#eab308',
  reconnecting: '#eab308',
  disconnected: '#ef4444',
  error: '#ef4444',
  auth_failed: '#ef4444',
  idle: '#6b7280',
};

function Dot({ color }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: color,
        marginRight: 6,
      }}
    />
  );
}

export default function StatusBar({ status }) {
  const { connected: socketConnected } = useSocketContext();

  if (!status) {
    return <div className="status-bar">Loading status…</div>;
  }

  const waStatus = status.whatsapp?.status || 'idle';
  const waMode = status.whatsapp?.mode || status.modes?.whatsappMode || '?';
  const aiConnected = status.ai?.connected;
  const aiModel = status.ai?.model || '?';

  return (
    <div className="status-bar">
      <div className="status-item">
        <Dot color={socketConnected ? '#22c55e' : '#ef4444'} />
        <span>Socket: {socketConnected ? 'connected' : 'disconnected'}</span>
      </div>
      <div className="status-item">
        <Dot color={STATUS_COLORS[waStatus] || '#6b7280'} />
        <span>WhatsApp ({waMode}): {waStatus}</span>
      </div>
      <div className="status-item">
        <Dot color={aiConnected ? '#22c55e' : '#ef4444'} />
        <span>AI: {aiConnected ? aiModel : 'disconnected'}</span>
      </div>
      {status.version && (
        <div className="status-item status-version">v{status.version}</div>
      )}
    </div>
  );
}
