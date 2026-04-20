import { useState } from 'react';

const DELIVERY_ICONS = {
  queued: '◌',
  sending: '◔',
  sent: '✓',
  delivered: '✓✓',
  read: '✓✓',
  failed: '✗',
};

const DELIVERY_COLORS = {
  queued: 'var(--text-muted)',
  sending: 'var(--yellow)',
  sent: 'var(--text-muted)',
  delivered: 'var(--text-muted)',
  read: 'var(--accent)',
  failed: 'var(--red)',
};

// Browser-playable video MIME types
const PLAYABLE_VIDEO_MIMES = new Set([
  'video/mp4', 'video/webm', 'video/ogg',
]);

function MediaContent({ message }) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const { media_type, media_path, media_mime_type, media_size_bytes } = message;

  // No stored media yet — show placeholder
  if (!media_path) {
    return (
      <div className="media-placeholder">
        <span className="media-placeholder-icon">
          {media_type === 'image' ? '🖼️' : media_type === 'audio' ? '🎵' : media_type === 'video' ? '🎬' : '📎'}
        </span>
        <span className="media-placeholder-text">
          {media_type === 'image' ? 'Image downloading…' :
           media_type === 'audio' ? 'Audio downloading…' :
           media_type === 'video' ? 'Video downloading…' :
           'File downloading…'}
        </span>
      </div>
    );
  }

  // Image
  if (media_type === 'image') {
    if (imgError) {
      return (
        <div className="media-error">
          <span>🖼️ Image could not be loaded</span>
          <a href={media_path} target="_blank" rel="noopener noreferrer" className="media-download-link">Download</a>
        </div>
      );
    }
    return (
      <div className="media-image-container">
        {!imgLoaded && <div className="media-loading">Loading image…</div>}
        <a href={media_path} target="_blank" rel="noopener noreferrer">
          <img
            src={media_path}
            alt="Shared image"
            className="media-image"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        </a>
      </div>
    );
  }

  // Audio
  if (media_type === 'audio') {
    return (
      <div className="media-audio-container">
        <audio controls preload="metadata" className="media-audio">
          <source src={media_path} type={media_mime_type || 'audio/ogg'} />
          Your browser does not support audio playback.
        </audio>
        {media_size_bytes && (
          <span className="media-size">{formatFileSize(media_size_bytes)}</span>
        )}
      </div>
    );
  }

  // Video — conditional inline playback
  if (media_type === 'video') {
    const canPlay = PLAYABLE_VIDEO_MIMES.has(media_mime_type);
    if (canPlay) {
      return (
        <div className="media-video-container">
          <video controls preload="metadata" className="media-video">
            <source src={media_path} type={media_mime_type} />
            Video cannot be played inline.
          </video>
          {media_size_bytes && (
            <span className="media-size">{formatFileSize(media_size_bytes)}</span>
          )}
        </div>
      );
    }
    // Non-playable video — download link
    return (
      <div className="media-file-container">
        <span className="media-file-icon">🎬</span>
        <a href={media_path} target="_blank" rel="noopener noreferrer" className="media-download-link">
          Download video
        </a>
        {media_size_bytes && (
          <span className="media-size">{formatFileSize(media_size_bytes)}</span>
        )}
      </div>
    );
  }

  // Document / other
  return (
    <div className="media-file-container">
      <span className="media-file-icon">📎</span>
      <a href={media_path} target="_blank" rel="noopener noreferrer" className="media-download-link">
        {message.content && message.content !== '[Document]' ? message.content : 'Download file'}
      </a>
      {media_size_bytes && (
        <span className="media-size">{formatFileSize(media_size_bytes)}</span>
      )}
    </div>
  );
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isOutbound = message.direction === 'outbound' || message.role === 'assistant';

  // Determine if text content is a placeholder that should be hidden when media is shown
  const isMediaPlaceholder = message.media_type && (
    message.content === '[Image]' ||
    message.content === '[Audio message]' ||
    message.content === '[Video]' ||
    message.content === '[Document]'
  );

  return (
    <div className={`message-bubble ${isUser ? 'user' : isSystem ? 'system' : 'assistant'}`}>
      <div className="message-role">{message.role}</div>
      {message.media_type && <MediaContent message={message} />}
      {!isMediaPlaceholder && message.content && (
        <div className="message-content">{message.content}</div>
      )}
      <div className="message-footer">
        <span className="message-time">
          {message.created_at ? new Date(message.created_at).toLocaleTimeString() : ''}
        </span>
        {isOutbound && message.delivery_status && (
          <span
            className="delivery-status"
            title={message.delivery_error || message.delivery_status}
            style={{ color: DELIVERY_COLORS[message.delivery_status] || 'var(--text-muted)' }}
          >
            {DELIVERY_ICONS[message.delivery_status] || message.delivery_status}
          </span>
        )}
      </div>
    </div>
  );
}
