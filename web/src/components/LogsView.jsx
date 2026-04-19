import { useState, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket.js';

export default function LogsView() {
  const [logs, setLogs] = useState([]);

  useSocket('log:entry', useCallback((entry) => {
    setLogs(prev => {
      const next = [...prev, entry];
      // Keep last 200 entries
      return next.length > 200 ? next.slice(-200) : next;
    });
  }, []));

  return (
    <div className="logs-view">
      <h3>Live Logs</h3>
      {logs.length === 0 ? (
        <div className="logs-empty">
          No log entries received yet. Logs appear here in real-time when the backend emits them.
        </div>
      ) : (
        <div className="logs-entries">
          {logs.map((entry, i) => (
            <div key={i} className={`log-entry log-${entry.level || 'info'}`}>
              <span className="log-time">
                {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : ''}
              </span>
              <span className="log-level">{entry.level || 'info'}</span>
              <span className="log-message">{entry.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
