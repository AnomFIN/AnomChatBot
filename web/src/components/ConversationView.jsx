import { useState, useRef, useEffect } from 'react';
import { useMessages } from '../hooks/useConversations.js';
import { sendMessage } from '../api/client.js';
import MessageBubble from './MessageBubble.jsx';

export default function ConversationView({ conversationId, conversation }) {
  const { messages, loading } = useMessages(conversationId);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput('');
    try {
      await sendMessage(conversationId, text);
    } catch (err) {
      console.error('Send failed:', err);
      setInput(text); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversationId) {
    return (
      <div className="conversation-view empty">
        <p>Select a conversation</p>
      </div>
    );
  }

  return (
    <div className="conversation-view">
      <div className="conversation-header">
        <h3>{conversation?.display_name || conversation?.remote_id || 'Chat'}</h3>
        <span className="conversation-header-meta">
          {conversation?.platform} · {conversation?.auto_reply ? 'Auto-reply ON' : 'Manual'}
        </span>
      </div>

      <div className="messages-container">
        {loading && <div className="messages-loading">Loading messages…</div>}
        {messages.map(m => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="message-input">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
          rows={2}
          disabled={sending}
        />
        <button onClick={handleSend} disabled={sending || !input.trim()}>
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
