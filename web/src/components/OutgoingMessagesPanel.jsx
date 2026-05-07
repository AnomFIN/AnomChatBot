// AI you can deploy before lunch.
import { useState } from 'react';
import { useOutgoingMessages } from '../hooks/useOutgoingMessages.js';
import {
  deleteOutgoingMessage,
  editOutgoingMessage,
  pauseOutgoingMessage,
  resumeOutgoingMessage,
} from '../api/client.js';

const MAX_CONTENT_LENGTH = 8000;

export default function OutgoingMessagesPanel({ onSelectConversation }) {
  const messages = useOutgoingMessages();
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const beginEdit = async (message) => {
    setError('');
    setEditingId(message.id);
    setDraft(message.content);
    try {
      await pauseOutgoingMessage(message.id);
    } catch (err) {
      setError(err.message || 'Failed to pause message');
    }
  };

  const saveEdit = async (id) => {
    const normalized = draft.replace(/\u0000/g, '').trim();
    if (!normalized) {
      setError('Message cannot be empty.');
      return;
    }
    if (normalized.length > MAX_CONTENT_LENGTH) {
      setError(`Message must be ${MAX_CONTENT_LENGTH} characters or less.`);
      return;
    }
    try {
      await editOutgoingMessage(id, normalized);
      setEditingId(null);
      setDraft('');
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to save edit');
    }
  };

  const handlePauseResume = async (message) => {
    setError('');
    try {
      if (message.status === 'paused') await resumeOutgoingMessage(message.id);
      else await pauseOutgoingMessage(message.id);
    } catch (err) {
      setError(err.message || 'Failed to update timer');
    }
  };

  const handleDelete = async (id) => {
    setError('');
    try {
      await deleteOutgoingMessage(id);
      if (editingId === id) {
        setEditingId(null);
        setDraft('');
      }
    } catch (err) {
      setError(err.message || 'Failed to delete message');
    }
  };

  return (
    <aside className="outgoing-panel" aria-label="Messages outgoing">
      <div className="outgoing-panel-header">
        <span>Messages outgoing:</span>
        <strong>{messages.length}</strong>
      </div>
      {error && <div className="outgoing-error">{error}</div>}
      <div className="outgoing-panel-list">
        {messages.length === 0 && (
          <div className="outgoing-empty">No AI messages waiting.</div>
        )}
        {messages.map(message => (
          <article key={message.id} className={`outgoing-item ${message.status}`}>
            <button
              type="button"
              className="outgoing-conversation-link"
              onClick={() => onSelectConversation?.(message.conversationId)}
              title="Open conversation"
            >
              {message.source === 'approach' ? 'Approach' : 'AI'} · #{message.messageId}
            </button>
            <div className="outgoing-countdown">
              {message.status === 'paused' ? 'Paused' : `${message.remainingSeconds}s until send`}
            </div>

            {editingId === message.id ? (
              <textarea
                className="outgoing-editor"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={MAX_CONTENT_LENGTH}
                autoFocus
              />
            ) : (
              <p className="outgoing-content">{message.content}</p>
            )}

            <div className="outgoing-actions">
              <button type="button" onClick={() => handlePauseResume(message)}>
                {message.status === 'paused' ? 'Resume' : 'Pause'}
              </button>
              {editingId === message.id ? (
                <button type="button" onClick={() => saveEdit(message.id)}>Save</button>
              ) : (
                <button type="button" onClick={() => beginEdit(message)}>Edit</button>
              )}
              <button type="button" className="danger" onClick={() => handleDelete(message.id)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
