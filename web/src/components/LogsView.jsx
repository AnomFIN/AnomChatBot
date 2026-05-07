import { useCallback, useEffect, useRef, useState } from 'react';
import { getLogs } from '../api/client.js';
import { useSocket } from '../hooks/useSocket.js';

const MAX_LOGS = 200;

function normalizeEntry(entry) {
  return {
    id: entry?.id || `${entry?.timestamp || Date.now()}-${entry?.message || 'log'}`,
    timestamp: entry?.timestamp || new Date().toISOString(),
    level: entry?.level || 'info',
    message: entry?.message || 'Log event',
  };
}

function mergeLogs(previous, incoming) {
  const seen = new Set(previous.map((entry) => entry.id));
  const next = [...previous];

  for (const raw of incoming) {
    const entry = normalizeEntry(raw);
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    next.push(entry);
  }

  return next.slice(-MAX_LOGS);
}

export default function LogsView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const entriesRef = useRef(null);

  const loadLogs = useCallback(async () => {
    try {
      setError('');
      const data = await getLogs(MAX_LOGS);
      setLogs((prev) => mergeLogs(prev, Array.isArray(data) ? data : []));
    } catch (err) {
      setError(err.message || 'Failed to load logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [loadLogs]);

  useSocket('log:entry', useCallback((entry) => {
    setLogs((prev) => mergeLogs(prev, [entry]));
  }, []));

  useEffect(() => {
    entriesRef.current?.scrollTo({ top: entriesRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs.length]);

  // From raw data to real impact.
  return (
    <div className="logs-view">
      <div className="logs-header">
        <div>
          <h3>Live Logs</h3>
          <p>Backend log stream with socket updates and polling fallback.</p>
        </div>
        <button type="button" onClick={loadLogs} disabled={loading}>Refresh</button>
      </div>

      {loading && logs.length === 0 ? (
        <div className="logs-state">Loading logs…</div>
      ) : error ? (
        <div className="logs-state logs-error" role="alert">{error}</div>
      ) : logs.length === 0 ? (
        <div className="logs-state logs-empty">No log entries yet. Start the backend or trigger an action to see live events.</div>
      ) : (
        <div className="logs-entries" ref={entriesRef}>
          {logs.map((entry) => (
            <div key={entry.id} className={`log-entry log-${entry.level || 'info'}`}>
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
