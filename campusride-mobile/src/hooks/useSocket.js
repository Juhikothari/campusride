import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../services/api';

export function useSocket(userId, userType) {
  const socketRef = useRef(null);
  const [connected,     setConnected]     = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!userId) return;

    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      withCredentials: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('authenticate', { userId, userType });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('booking-update', (data) => {
      setNotifications(prev => [{ ...data, id: Date.now() }, ...prev]);
    });

    socket.on('ride-update', (data) => {
      setNotifications(prev => [{ ...data, id: Date.now() }, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, [userId, userType]);

  return { socket: socketRef.current, connected, notifications };
}
