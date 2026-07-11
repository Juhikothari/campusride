// frontend/src/hooks/useSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../services/api.js';

export const useSocket = (userId, userType) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const getSocketUrl = useCallback(() => {
    return API_BASE.replace(/\/api\/?$/, '');
  }, []);

  useEffect(() => {
    if (!userId || !userType) return;

    const socket = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      timeout: 20000,
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);

      // ✅ AUTH (works for BOTH roles now)
      socket.emit('authenticate', { userId, userType });
    });

    socket.on('authenticated', (data) => {
      if (data.success && userType === 'provider') {
        socket.emit('join-provider', userId);
      }
    });

    socket.on('connect_error', (err) => {
      setError(err.message);
      setConnected(false);
    });

    socket.on('disconnect', () => setConnected(false));

    // Notifications
    socket.on('new-booking', (data) => {
      setNotifications(prev => [data, ...prev]);
    });

    socket.on('booking-response', (data) => {
      setNotifications(prev => [data, ...prev]);
    });

    socket.on('urgent-availability', (data) => {
      setNotifications(prev => [data, ...prev]);
    });

    socket.on('notification', (data) => {
      setNotifications(prev => [data, ...prev]);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [userId, userType, getSocketUrl]);

  return {
    socket: socketRef.current,
    connected,
    error,
    notifications,
  };
};
