export default function GlobalSettings({ status }) {
  if (!status) return <div className="global-settings">Loading…</div>;

  return (
    <div className="global-settings">
      <h3>System Overview</h3>

      <div className="gs-section">
        <h4>Server</h4>
        <table>
          <tbody>
            <tr><td>Version</td><td>{status.version || '?'}</td></tr>
            <tr><td>Uptime</td><td>{formatUptime(status.uptime)}</td></tr>
            <tr><td>Node.js</td><td>{status.environment?.nodeVersion || '?'}</td></tr>
            <tr><td>Platform</td><td>{status.environment?.platform || '?'}</td></tr>
            <tr><td>Log Level</td><td>{status.environment?.logLevel || '?'}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="gs-section">
        <h4>Database</h4>
        <table>
          <tbody>
            <tr><td>Initialized</td><td>{status.database?.initialized ? 'Yes' : 'No'}</td></tr>
            <tr><td>Conversations</td><td>{status.database?.conversations ?? 0}</td></tr>
            <tr><td>Messages</td><td>{status.database?.messages ?? 0}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="gs-section">
        <h4>AI Provider</h4>
        <table>
          <tbody>
            <tr><td>Provider</td><td>{status.modes?.aiProvider || '?'}</td></tr>
            <tr><td>Model</td><td>{status.ai?.model || '?'}</td></tr>
            <tr><td>Connected</td><td>{status.ai?.connected ? 'Yes' : 'No'}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="gs-section">
        <h4>WhatsApp</h4>
        <table>
          <tbody>
            <tr><td>Mode</td><td>{status.whatsapp?.mode || status.modes?.whatsappMode || '?'}</td></tr>
            <tr><td>Status</td><td>{status.whatsapp?.status || '?'}</td></tr>
            <tr><td>Details</td><td>{status.whatsapp?.details || '—'}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="gs-section">
        <h4>Telegram</h4>
        <table>
          <tbody>
            <tr><td>Enabled</td><td>{status.modes?.telegramEnabled ? 'Yes' : 'No'}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return '?';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
