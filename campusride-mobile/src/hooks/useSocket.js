import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../services/api';

let globalSocket = null;
const notificationSubscribers = new Set();

export const subscribeToNotifications = (callback) => {
  notificationSubscribers.add(callback);
  return () => notificationSubscribers.delete(callback);
};

export const getSharedSocket = (userId, userType) => {
  if (!globalSocket && userId) {
    globalSocket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      withCredentials: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    globalSocket.on('connect', () => {
      globalSocket.emit('authenticate', { userId, userType });
    });

    const notifyAll = (event, data) => {
      notificationSubscribers.forEach(cb => {
        try { cb(event, data); } catch (e) {}
      });
    };

    globalSocket.on('new-notification', (data) => notifyAll('new-notification', data));
    globalSocket.on('new-booking', (data) => notifyAll('new-booking', data));
    globalSocket.on('booking-response', (data) => notifyAll('booking-response', data));
    globalSocket.on('rider-arrived', (data) => notifyAll('rider-arrived', data));
    globalSocket.on('riderArrivedAtSeeker', (data) => notifyAll('riderArrivedAtSeeker', data));
    globalSocket.on('checklistCompleted', (data) => notifyAll('checklistCompleted', data));
    globalSocket.on('rideStarted', (data) => notifyAll('rideStarted', data));
    globalSocket.on('booking-update', (data) => notifyAll('booking-update', data));
    globalSocket.on('ride-update', (data) => notifyAll('ride-update', data));
  } else if (globalSocket && userId) {
    globalSocket.emit('authenticate', { userId, userType });
  }
  return globalSocket;
};

export function useSocket(userId, userType) {
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    const socket = getSharedSocket(userId, userType);
    socketRef.current = socket;
    setConnected(socket.connected);

    const onConnect = () => {
      setConnected(true);
      socket.emit('authenticate', { userId, userType });
    };
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    const unsub = subscribeToNotifications((event, data) => {
      setNotifications(prev => [{ ...data, event, id: Date.now() + Math.random() }, ...prev]);
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      unsub();
    };
  }, [userId, userType]);

  return { socket: socketRef.current || globalSocket, connected, notifications };
}
