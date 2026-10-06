import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../services/api';
import { showPushNotification } from '../services/notificationService';

let globalSocket = null;
let activeUserId = null;
const notificationSubscribers = new Set();
const communityUnreadSubscribers = new Set();
let communityUnreadCount = 0;

export const subscribeToNotifications = (callback) => {
  notificationSubscribers.add(callback);
  return () => notificationSubscribers.delete(callback);
};

export const subscribeToCommunityUnread = (callback) => {
  communityUnreadSubscribers.add(callback);
  callback(communityUnreadCount);
  return () => communityUnreadSubscribers.delete(callback);
};

export const resetCommunityUnreadCount = () => {
  communityUnreadCount = 0;
  if (activeUserId) {
    AsyncStorage.setItem(`@unread_community_${activeUserId}`, '0').catch(() => {});
  }
  communityUnreadSubscribers.forEach(cb => {
    try { cb(0); } catch (e) {}
  });
};

export const getCommunityUnreadCount = () => communityUnreadCount;

export const getSharedSocket = (userId, userType) => {
  activeUserId = userId;
  if (!globalSocket && userId) {
    // Load initial persisted unread count
    AsyncStorage.getItem(`@unread_community_${userId}`).then(val => {
      if (val) {
        communityUnreadCount = parseInt(val, 10) || 0;
        communityUnreadSubscribers.forEach(cb => {
          try { cb(communityUnreadCount); } catch (e) {}
        });
      }
    }).catch(() => {});

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

    const incrementCommunityUnread = () => {
      communityUnreadCount += 1;
      if (userId) {
        AsyncStorage.setItem(`@unread_community_${userId}`, String(communityUnreadCount)).catch(() => {});
      }
      communityUnreadSubscribers.forEach(cb => {
        try { cb(communityUnreadCount); } catch (e) {}
      });
    };

    // ── Ride Booking Requests ──
    globalSocket.on('new-booking', (data) => {
      notifyAll('new-booking', data);
      showPushNotification({
        title: '🚗 New Ride Request Received!',
        body: data?.seekerName ? `${data.seekerName} requested ${data.seats || 1} seat(s) on your ride.` : 'A verified student has requested to join your ride.',
        data,
      });
    });

    // ── Booking Accepted / Declined ──
    globalSocket.on('booking-response', (data) => {
      notifyAll('booking-response', data);
      const isAccepted = data?.status === 'accepted';
      showPushNotification({
        title: isAccepted ? '✅ Ride Booking Confirmed!' : '❌ Ride Request Declined',
        body: isAccepted ? 'Your driver accepted your booking request! Get ready for pickup.' : 'Your ride request was declined.',
        data,
      });
    });

    // ── Driver Reached Location ──
    globalSocket.on('rider-arrived', (data) => {
      notifyAll('rider-arrived', data);
      showPushNotification({
        title: '📍 Driver / Rider Reached Your Location!',
        body: 'Your ride partner has reached your pickup spot. Please meet them now!',
        data,
      });
    });
    globalSocket.on('riderArrivedAtSeeker', (data) => {
      notifyAll('riderArrivedAtSeeker', data);
      showPushNotification({
        title: '📍 Rider Reached Your Location!',
        body: 'Your passenger has arrived at the pickup location.',
        data,
      });
    });

    // ── Checklist Completed ──
    globalSocket.on('checklistCompleted', (data) => {
      notifyAll('checklistCompleted', data);
      showPushNotification({
        title: '🛡️ Safety Checklist Completed!',
        body: 'Pre-ride safety checklist verified by both parties. Ready for departure!',
        data,
      });
    });

    // ── Ride Started ──
    globalSocket.on('rideStarted', (data) => {
      notifyAll('rideStarted', data);
      showPushNotification({
        title: '🏁 Ride In Progress — Live GPS Active',
        body: 'Your campus trip has started. Real-time GPS tracking is now live.',
        data,
      });
    });

    // ── Community Post Replies ──
    globalSocket.on('community-reply', (data) => {
      notifyAll('community-reply', data);
      incrementCommunityUnread();
      showPushNotification({
        title: '💬 New Reply to Your Post',
        body: data?.reply?.authorName
          ? `${data.reply.authorName} replied: "${data.reply.content}"`
          : 'Someone replied to your community post.',
        data,
      });
    });

    // ── Community College Chat Messages ──
    globalSocket.on('receive-community-message', (data) => {
      notifyAll('receive-community-message', data);
      if (data?.senderId && String(data.senderId) !== String(userId)) {
        incrementCommunityUnread();
        showPushNotification({
          title: `💬 Campus Chat: ${data.senderName || 'Student'}`,
          body: data.message || 'New community message received.',
          data,
        });
      }
    });

    // ── General Notifications ──
    globalSocket.on('new-notification', (data) => {
      notifyAll('new-notification', data);
      if (data?.type === 'community-reply') {
        incrementCommunityUnread();
      }
      showPushNotification({
        title: data?.title || 'CampusRide Notification',
        body: data?.message || 'New activity on your account.',
        data,
      });
    });

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
