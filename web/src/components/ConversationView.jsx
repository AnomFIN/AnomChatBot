import { useState, useRef, useEffect } from 'react';
import { useMessages } from '../hooks/useConversations.js';
import { sendMessage } from '../api/client.js';
import MessageBubble from './MessageBubble.jsx';

const ACTIVITY_DISPLAY = {
  thinking: '🤔 Bot is thinking…',
  typing: '⌨️ Bot is typing…',
  sending: '📤 Bot is sending…',
};

export default function ConversationView({ conversationId, conversation, botActivity }) {
  const { messages, loading } = useMessages(conversationId);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, botActivity]);

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

  const activityLabel = botActivity && botActivity !== 'idle'
    ? ACTIVITY_DISPLAY[botActivity]
    : null;

  return (
    <div className="conversation-view">
      <div className="conversation-header">
        <h3>{conversation?.display_name || conversation?.remote_id || 'Chat'}</h3>
        <span className="conversation-header-meta">
          {conversation?.platform === 'whatsapp_cloud' ? 'Cloud API' :
           conversation?.platform === 'whatsapp_baileys' ? 'Baileys' :
           conversation?.platform}
          {' · '}
          {conversation?.auto_reply ? 'Auto-reply ON' : 'Manual'}
          {' · '}
          {(conversation?.use_global_ai ?? 1) === 1 ? 'AI: Global' : 'AI: Local'}
          {' · '}
          {(conversation?.use_global_delay ?? 1) === 1 ? 'Delay: Global' : 'Delay: Local'}
          {conversation?.ai_model ? ` · ${conversation.ai_model}` : ''}
        </span>
      </div>

      <div className="messages-container">
        {loading && <div className="messages-loading">Loading messages…</div>}
        {messages.map(m => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {activityLabel && (
          <div className="bot-activity-indicator">{activityLabel}</div>
        )}
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
