import { useState, useEffect, useCallback } from 'react';
import { getProfilePhoto } from '../api/client.js';

const ACTIVITY_LABELS = {
  thinking: 'thinking…',
  typing: 'typing…',
  sending: 'sending…',
};

function ProfileAvatar({ conversationId, displayName }) {
  const [photoUrl, setPhotoUrl] = useState(null);

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    getProfilePhoto(conversationId)
      .then(data => { if (!cancelled && data?.url) setPhotoUrl(data.url); })
      .catch(() => {}); // Silently fail — show initials
    return () => { cancelled = true; };
  }, [conversationId]);

  if (photoUrl) {
    return <img src={photoUrl} alt="" className="profile-avatar" />;
  }

  // Initials fallback
  const initials = (displayName || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');

  return <div className="profile-avatar profile-initials">{initials}</div>;
}

export default function ConversationList({ conversations, selectedId, onSelect, botActivities, onNewConversation }) {
  const [search, setSearch] = useState('');

  // Deduplicate conversations by platform + remote_id, keeping only the most recent one
  const deduplicatedConversations = conversations.reduce((acc, conversation) => {
    const key = `${conversation.platform}:${conversation.remote_id}`;
    const existing = acc.get(key);
    
    if (!existing || (conversation.updated_at || '') > (existing.updated_at || '')) {
      acc.set(key, conversation);
    }
    
    return acc;
  }, new Map()).values();

  const filtered = Array.from(deduplicatedConversations).filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.display_name || '').toLowerCase().includes(q) ||
      (c.remote_id || '').toLowerCase().includes(q) ||
      (c.platform || '').toLowerCase().includes(q)
    );
  });

  // Sort by last_message_at descending (with updated_at fallback)
  const sorted = [...filtered].sort((a, b) =>
    (b.last_message_at || b.updated_at || '').localeCompare(a.last_message_at || a.updated_at || '')
  );

  return (
    <div className="conversation-list">
      <div className="conversation-search">
        <div className="search-row">
          <input
            type="text"
            placeholder="Search conversations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn-new-chat" onClick={onNewConversation} title="New conversation">+</button>
        </div>
      </div>
      <div className="conversation-items">
        {sorted.length === 0 && (
          <div className="conversation-empty">
            {conversations.length === 0
              ? 'No conversations yet'
              : 'No matches'}
          </div>
        )}
        {sorted.map(c => {
          const activity = botActivities?.[c.id];
          const activityLabel = activity && activity !== 'idle' ? ACTIVITY_LABELS[activity] : null;
          
          // Create a more readable display name
          const displayName = c.display_name && c.display_name.trim() && c.display_name !== c.remote_id
            ? c.display_name
            : c.remote_id || 'Unknown';
          
          // Show remote_id in meta if different from display name
          const showRemoteId = c.display_name && c.display_name.trim() && c.display_name !== c.remote_id;

          return (
            <div
              key={c.id}
              className={`conversation-item ${c.id === selectedId ? 'selected' : ''}`}
              onClick={() => onSelect(c.id)}
            >
              <div className="conversation-item-row">
                <ProfileAvatar conversationId={c.id} displayName={displayName} />
                <div className="conversation-item-content">
                  <div className="conversation-item-header">
                    <span className="conversation-name" title={displayName}>
                      {displayName}
                    </span>
                    <span className="conversation-platform">
                      {c.platform === 'whatsapp_cloud' ? 'Cloud' : c.platform === 'whatsapp_baileys' ? 'Baileys' : c.platform}
                    </span>
                  </div>
                  {showRemoteId && (
                    <div className="conversation-remote-id">
                      {c.remote_id}
                    </div>
                  )}
                  <div className="conversation-item-meta">
                    {activityLabel ? (
                      <span className="bot-activity-label">{activityLabel}</span>
                    ) : (
                      <span className={`auto-reply-badge ${c.auto_reply ? 'on' : 'off'}`}>
                        {c.auto_reply ? 'Auto' : 'Manual'}
                      </span>
                    )}
                    <span className="conversation-time">
                      {(c.last_message_at || c.updated_at)
                        ? new Date(c.last_message_at || c.updated_at).toLocaleString()
                        : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
