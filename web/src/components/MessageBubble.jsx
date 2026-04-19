export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div className={`message-bubble ${isUser ? 'user' : isSystem ? 'system' : 'assistant'}`}>
      <div className="message-role">{message.role}</div>
      <div className="message-content">{message.content}</div>
      {message.media_type && (
        <div className="message-media">[{message.media_type}]</div>
      )}
      <div className="message-time">
        {message.created_at ? new Date(message.created_at).toLocaleTimeString() : ''}
      </div>
    </div>
  );
}
