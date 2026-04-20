import { useState } from 'react';
import { createConversation } from '../api/client.js';

export default function NewConversation({ onCreated, onClose }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!phone.trim()) {
      setError('Phone number is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const result = await createConversation(phone.trim(), name.trim());
      const conversation = result.data;
      const existed = result.existed;

      if (onCreated) {
        onCreated(conversation, existed);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
    if (e.key === 'Escape') {
      onClose?.();
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>New Conversation</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {error && <div className="settings-error">{error}</div>}

        <div className="settings-form">
          <label>
            Phone Number
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 358401234567"
              autoFocus
            />
            <span className="field-hint">7-15 digits, country code included, no + prefix needed</span>
          </label>

          <label>
            Display Name (optional)
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Contact name"
            />
          </label>

          <button className="save-btn" onClick={handleCreate} disabled={creating || !phone.trim()}>
            {creating ? 'Creating…' : 'Create Conversation'}
          </button>
        </div>
      </div>
    </div>
  );
}
