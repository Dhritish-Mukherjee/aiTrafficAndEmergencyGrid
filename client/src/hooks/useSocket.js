import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

/**
 * Custom hook that connects to the backend Socket.IO server and
 * registers a map of event listeners.
 *
 * @param {Object} listeners - { eventName: handlerFn }
 */
const useSocket = (listeners = {}) => {
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log(`🔌 Socket connected → id: ${socket.id}`);
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    // Register all event listeners passed in
    Object.entries(listeners).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      // Cleanup all listeners and disconnect on unmount
      Object.entries(listeners).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return socketRef;
};

export default useSocket;
