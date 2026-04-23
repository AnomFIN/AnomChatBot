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
      // API returns DESC (newest first) — reverse for chronological chat display
      setMessages((data.messages || []).reverse());
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

  // Real-time: delivery status update
  useSocket('message:status', useCallback(({ conversationId: cid, messageId, status, error }) => {
    if (cid === conversationId) {
      setMessages(prev =>
        prev.map(m => m.id === messageId
          ? { ...m, delivery_status: status, delivery_error: error }
          : m
        )
      );
    }
  }, [conversationId]));

  // Real-time: message updated (e.g. media download completed — media_path, media_mime_type, media_size_bytes populated)
  useSocket('message:update', useCallback(({ conversationId: cid, message }) => {
    if (cid === conversationId && message) {
      setMessages(prev =>
        prev.map(m => m.id === message.id ? { ...m, ...message } : m)
      );
    }
  }, [conversationId]));

  // Real-time: history cleared or trimmed for this conversation
  useSocket('conversation:history_cleared', useCallback(({ conversationId: cid }) => {
    if (cid === conversationId) {
      load();
    }
  }, [conversationId, load]));

  return { messages, loading, refresh: load };
}

/**
 * Hook to track bot activity state per conversation.
 * Listens for 'bot:activity' events: { conversationId, state: 'thinking'|'typing'|'sending'|'idle' }
 */
export function useBotActivity() {
  const [activities, setActivities] = useState({});

  useSocket('bot:activity', useCallback(({ conversationId, state }) => {
    setActivities(prev => ({ ...prev, [conversationId]: state }));
  }, []));

  return activities;
}
