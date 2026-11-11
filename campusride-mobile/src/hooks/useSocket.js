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
let unreadPostsCount = 0;
let unreadChatCount = 0;
const tabUnreadSubscribers = new Set();

export const subscribeToTabUnreadCounts = (callback) => {
  tabUnreadSubscribers.add(callback);
  callback({ unreadPosts: unreadPostsCount, unreadChat: unreadChatCount });
  return () => tabUnreadSubscribers.delete(callback);
};

export const resetTabUnread = (tabName) => {
  if (tabName === 'posts') {
    unreadPostsCount = 0;
  } else if (tabName === 'chat') {
    unreadChatCount = 0;
  } else {
    unreadPostsCount = 0;
    unreadChatCount = 0;
  }
  communityUnreadCount = unreadPostsCount + unreadChatCount;
  if (activeUserId) {
    AsyncStorage.setItem(`@unread_posts_${activeUserId}`, String(unreadPostsCount)).catch(() => {});
    AsyncStorage.setItem(`@unread_chat_${activeUserId}`, String(unreadChatCount)).catch(() => {});
    AsyncStorage.setItem(`@unread_community_${activeUserId}`, String(communityUnreadCount)).catch(() => {});
  }
  communityUnreadSubscribers.forEach(cb => { try { cb(communityUnreadCount); } catch (e) {} });
  tabUnreadSubscribers.forEach(cb => { try { cb({ unreadPosts: unreadPostsCount, unreadChat: unreadChatCount }); } catch (e) {} });
};

export const disconnectGlobalSocket = () => {
  if (globalSocket) {
    try {
      globalSocket.removeAllListeners();
      globalSocket.disconnect();
    } catch (_) {}
    globalSocket = null;
  }
  activeUserId = null;
  communityUnreadCount = 0;
  notificationSubscribers.clear();
};

const isForMe = (data) => {
  if (!activeUserId) return false;
  if (data?.recipientId && String(data.recipientId) !== String(activeUserId)) return false;
  if (data?.targetUserId && String(data.targetUserId) !== String(activeUserId)) return false;
  return true;
};

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
  if (globalSocket && activeUserId && String(activeUserId) !== String(userId)) {
    disconnectGlobalSocket();
  }
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

    const incrementPostsUnread = () => {
      unreadPostsCount += 1;
      communityUnreadCount = unreadPostsCount + unreadChatCount;
      if (userId) {
        AsyncStorage.setItem(`@unread_posts_${userId}`, String(unreadPostsCount)).catch(() => {});
        AsyncStorage.setItem(`@unread_community_${userId}`, String(communityUnreadCount)).catch(() => {});
      }
      communityUnreadSubscribers.forEach(cb => { try { cb(communityUnreadCount); } catch (e) {} });
      tabUnreadSubscribers.forEach(cb => { try { cb({ unreadPosts: unreadPostsCount, unreadChat: unreadChatCount }); } catch (e) {} });
    };

    const incrementChatUnread = () => {
      unreadChatCount += 1;
      communityUnreadCount = unreadPostsCount + unreadChatCount;
      if (userId) {
        AsyncStorage.setItem(`@unread_chat_${userId}`, String(unreadChatCount)).catch(() => {});
        AsyncStorage.setItem(`@unread_community_${userId}`, String(communityUnreadCount)).catch(() => {});
      }
      communityUnreadSubscribers.forEach(cb => { try { cb(communityUnreadCount); } catch (e) {} });
      tabUnreadSubscribers.forEach(cb => { try { cb({ unreadPosts: unreadPostsCount, unreadChat: unreadChatCount }); } catch (e) {} });
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
      if (!isForMe(data)) return;
      notifyAll('new-booking', data);
      showPushNotification({
        title: '🚗 New Ride Request!',
        body: 'A buddy has requested to join your ride.',
        data,
      });
    });

    // ── Booking Accepted / Declined ──
    globalSocket.on('booking-response', (data) => {
      if (!isForMe(data)) return;
      notifyAll('booking-response', data);
      const status = data?.status || data?.booking?.status;
      const isAccepted = status === 'accepted';
      showPushNotification({
        title: isAccepted ? '✅ Booking Accepted!' : '❌ Ride Request Declined',
        body: isAccepted ? 'Your buddy accepted your booking request! Get ready for pickup.' : 'Your ride request was declined.',
        data,
      });
    });

    // ── Driver Reached Location ──
    globalSocket.on('rider-arrived', (data) => {
      if (!isForMe(data)) return;
      notifyAll('rider-arrived', data);
      showPushNotification({
        title: '📍 Your Buddy Has Arrived!',
        body: 'Your buddy has arrived at your pickup location! Please meet them now.',
        data: { ...data, type: 'rider-reached' },
      });
    });
    globalSocket.on('riderArrivedAtSeeker', (data) => {
      if (!isForMe(data)) return;
      notifyAll('riderArrivedAtSeeker', data);
      showPushNotification({
        title: '📍 Rider Reached Your Location!',
        body: 'Your buddy has arrived at the pickup location.',
        data,
      });
    });

    // ── Checklist Completed ──
    globalSocket.on('checklistCompleted', (data) => {
      if (!isForMe(data)) return;
      notifyAll('checklistCompleted', data);
      showPushNotification({
        title: '🛡️ Safety Checklist Completed!',
        body: 'Pre-ride safety checklist verified by both parties. Ready for departure!',
        data,
      });
    });

    // ── Ride Started ──
    globalSocket.on('rideStarted', (data) => {
      if (!isForMe(data)) return;
      notifyAll('rideStarted', data);
      showPushNotification({
        title: '🏁 Ride In Progress — Live GPS Active',
        body: 'Your campus trip has started. Real-time GPS tracking is now live.',
        data,
      });
    });

    // ── Ride Completed ──
    globalSocket.on('rideCompleted', (data) => {
      if (!isForMe(data)) return;
      notifyAll('rideCompleted', data);
      showPushNotification({
        title: '🎉 Campus Trip Completed',
        body: 'You have reached your destination safely. Thank you for riding with CampusRide!',
        data,
      });
    });

    // ── Ride Cancelled ──
    globalSocket.on('rideCancelled', (data) => {
      if (!isForMe(data)) return;
      notifyAll('rideCancelled', data);
      notifyAll('active-trip-changed', data);
      showPushNotification({
        title: '⚠️ Ride Cancelled',
        body: data?.reason ? `Ride was cancelled: ${data.reason}` : 'A ride you were part of has been cancelled.',
        data,
      });
    });

    // ── Booking Cancelled ──
    globalSocket.on('booking-cancelled', (data) => {
      notifyAll('booking-cancelled', data);
      notifyAll('active-trip-changed', data);
      if (isForMe(data)) {
        showPushNotification({
          title: '⚠️ Booking Cancelled',
          body: data?.seekerName ? `${data.seekerName} cancelled their booking request.` : 'A booking was cancelled.',
          data,
        });
      }
    });

    globalSocket.on('active-trip-changed', (data) => {
      notifyAll('active-trip-changed', data);
    });

    // ── Community Post Replies ──
    globalSocket.on('community-reply', (data) => {
      notifyAll('community-reply', data);
      // Only notify the post author, never notify the person commenting
      const isPostAuthor = !data?.authorId || String(data.authorId) === String(userId);
      const isSelfCommenter = data?.reply?.authorId && String(data.reply.authorId) === String(userId);
      if (isPostAuthor && !isSelfCommenter) {
        incrementCommunityUnread();
        showPushNotification({
          title: '💬 New Reply to Your Post',
          body: data?.reply?.authorName
            ? `${data.reply.authorName} replied: "${data.reply.content}"`
            : 'Someone replied to your community post.',
          data,
        });
      }
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

    // ── Community New Posts ──
    globalSocket.on('new-community-post', (data) => {
      notifyAll('new-community-post', data);
      const postAuthor = data?.post?.author?._id || data?.post?.author || data?.authorId;
      if (postAuthor && String(postAuthor) !== String(userId)) {
        incrementPostsUnread();
        showPushNotification({
          title: `📢 New Campus Post (${(data?.post?.type || 'community').toUpperCase()})`,
          body: data?.post?.content?.slice(0, 80) || 'New post shared in your campus community.',
          data,
        });
      }
    });

    // ── Walk Together (Nadi) Companion Joined ──
    globalSocket.on('walk-joined', (data) => {
      notifyAll('walk-joined', data);
      showPushNotification({
        title: '🚶 Someone Joined Your Walk Together!',
        body: data?.usn
          ? `Student (${data.usn}) joined your walk request. Tap to view joined students.`
          : 'A verified student has joined your walk companion request!',
        data,
      });
    });

    // ── General Notifications ──
    globalSocket.on('new-notification', (data) => {
      if (!isForMe(data)) return;
      notifyAll('new-notification', data);
      if (data?.type === 'community-reply') {
        incrementCommunityUnread();
        return; // Suppress duplicate push (handled by community-reply listener)
      }
      if (data?.type === 'RIDER_ARRIVED' || data?.type === 'rider-arrived') {
        return; // Suppress duplicate push (handled by rider-arrived listener)
      }
      if (data?.type === 'BOOKING_REQUEST' || data?.type === 'BOOKING_CONFIRMED' || data?.type === 'BOOKING_CANCELLED') {
        return; // Suppress duplicate push (handled by dedicated new-booking & booking-response listeners)
      }
      showPushNotification({
        title: data?.title || 'HOGO Notification',
        body: data?.body || data?.message || 'New activity on your account.',
        data,
      });
    });

    globalSocket.on('booking-update', (data) => notifyAll('booking-update', data));
    globalSocket.on('ride-update', (data) => notifyAll('ride-update', data));

    // ── Admin Alerts & Operational Notifications ──
    globalSocket.on('admin-notification', (data) => {
      notifyAll('admin-notification', data);
      showPushNotification({
        title: data?.title || '🛡️ Admin Alert',
        body: data?.message || data?.body || 'New administrative event received.',
        data,
      });
    });

    globalSocket.on('adminSOSAlert', (data) => {
      notifyAll('adminSOSAlert', data);
      showPushNotification({
        title: '🚨 EMERGENCY SOS ALERT!',
        body: data?.message || data?.body || `Emergency SOS triggered on Ride #${data?.rideId || ''}!`,
        data: { ...data, priority: 'critical', type: 'emergency_sos' },
      });
    });

    globalSocket.on('newKYCSubmission', (data) => {
      notifyAll('newKYCSubmission', data);
      showPushNotification({
        title: '🛡️ New KYC Document Submitted',
        body: data?.message || data?.body || `${data?.name || 'A student'} submitted documents for admin review.`,
        data,
      });
    });

    globalSocket.on('newIncidentReport', (data) => {
      notifyAll('newIncidentReport', data);
      showPushNotification({
        title: `⚠️ New Incident Reported (${data?.severity || 'Medium'})`,
        body: data?.message || data?.body || 'A new incident requires immediate administrator attention.',
        data: { ...data, priority: 'critical', type: 'incident_report' },
      });
    });

    globalSocket.on('newVehicleSubmission', (data) => {
      notifyAll('newVehicleSubmission', data);
      showPushNotification({
        title: '🚗 New Vehicle Pending Review',
        body: data?.message || data?.body || `Vehicle ${data?.vehicleNumber || ''} submitted for 24-hr verification.`,
        data,
      });
    });
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
