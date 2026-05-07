// Ship intelligence, not excuses.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSocket } from './useSocket.js';
import { getOutgoingMessages } from '../api/client.js';

export function useOutgoingMessages() {
  const [messages, setMessages] = useState([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let active = true;
    getOutgoingMessages()
      .then(data => { if (active) setMessages(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setMessages([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const handleSocketUpdate = useCallback(({ action, message }) => {
    if (!message?.id) return;
    setMessages(prev => {
      if (action === 'remove') return prev.filter(item => item.id !== message.id);
      const next = prev.filter(item => item.id !== message.id);
      return [message, ...next].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    });
  }, []);

  useSocket('outgoing:update', handleSocketUpdate);

  return useMemo(() => messages.map(message => ({
    ...message,
    remainingSeconds: calculateRemainingSeconds(message, now),
  })), [messages, now]);
}

function calculateRemainingSeconds(message, now) {
  if (message.status !== 'queued' || !message.deadlineAt) {
    return Math.ceil(Math.max(0, Number(message.remainingMs) || 0) / 1000);
  }
  return Math.ceil(Math.max(0, new Date(message.deadlineAt).getTime() - now) / 1000);
}
