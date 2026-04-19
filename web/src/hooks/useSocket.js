import { useEffect, useCallback } from 'react';
import { useSocketContext } from '../context/SocketContext.jsx';

export function useSocket(event, handler) {
  const { socket } = useSocketContext();

  useEffect(() => {
    const s = socket.current;
    if (!s || !event || !handler) return;
    s.on(event, handler);
    return () => s.off(event, handler);
  }, [socket, event, handler]);

  const emit = useCallback((ev, data) => {
    socket.current?.emit(ev, data);
  }, [socket]);

  return { emit };
}
