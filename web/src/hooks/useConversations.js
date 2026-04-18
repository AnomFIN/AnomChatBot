import { useState, useEffect, useCallback } from 'react';
import { getConversations, getMessages } from '../api/client.js';
import { useSocket } from './useSocket.js';

export function useConversations() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time: new conversation
  useSocket('conversation:new', useCallback(({ conversation }) => {
    setConversations(prev => {
      if (prev.find(c => c.id === conversation.id)) return prev;
      return [conversation, ...prev];
    });
  }, []));

  // Real-time: conversation updated
  useSocket('conversation:update', useCallback(({ conversation }) => {
    setConversations(prev =>
      prev.map(c => c.id === conversation.id ? { ...c, ...conversation } : c)
    );
  }, []));

  return { conversations, loading, refresh: load };
}

export function useMessages(conversationId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const data = await getMessages(conversationId, 200);
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);

  // Real-time: new message
  useSocket('message:new', useCallback(({ conversationId: cid, message }) => {
    if (cid === conversationId) {
      setMessages(prev => {
        if (prev.find(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
    }
  }, [conversationId]));

  return { messages, loading, refresh: load };
}
