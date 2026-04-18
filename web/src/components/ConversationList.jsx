import { useState } from 'react';

export default function ConversationList({ conversations, selectedId, onSelect }) {
  const [search, setSearch] = useState('');

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.display_name || '').toLowerCase().includes(q) ||
      (c.remote_id || '').toLowerCase().includes(q) ||
      (c.platform || '').toLowerCase().includes(q)
    );
  });

  // Sort by updated_at descending
  const sorted = [...filtered].sort((a, b) =>
    (b.updated_at || '').localeCompare(a.updated_at || '')
  );

  return (
    <div className="conversation-list">
      <div className="conversation-search">
        <input
          type="text"
          placeholder="Search conversations…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="conversation-items">
        {sorted.length === 0 && (
          <div className="conversation-empty">
            {conversations.length === 0
              ? 'No conversations yet'
              : 'No matches'}
          </div>
        )}
        {sorted.map(c => (
          <div
            key={c.id}
            className={`conversation-item ${c.id === selectedId ? 'selected' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <div className="conversation-item-header">
              <span className="conversation-name">
                {c.display_name || c.remote_id || 'Unknown'}
              </span>
              <span className="conversation-platform">{c.platform}</span>
            </div>
            <div className="conversation-item-meta">
              <span className={`auto-reply-badge ${c.auto_reply ? 'on' : 'off'}`}>
                {c.auto_reply ? 'Auto' : 'Manual'}
              </span>
              <span className="conversation-time">
                {c.updated_at ? new Date(c.updated_at).toLocaleString() : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
