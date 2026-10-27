// campusride-mobile/src/services/notificationService.js
import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';

const listeners = new Set();
const recentPushMap = new Map();

// Configure how notifications should be handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function addNotificationListener(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export async function initNotificationService() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'HOGO Campus Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#f5a623',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('emergency', {
        name: 'HOGO Emergency & SOS Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#ff2d55',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (err) {
    console.log('[NotificationService] init error:', err?.message);
    return false;
  }
}

export async function showPushNotification({ title, body, data = {} }) {
  try {
    // 0. Deduplicate: Prevent scheduling identical notification within 3.5 seconds
    const notifKey = `${title || ''}:::${body || ''}`;
    const now = Date.now();
    if (recentPushMap.has(notifKey) && (now - recentPushMap.get(notifKey)) < 3500) {
      return;
    }
    recentPushMap.set(notifKey, now);
    if (recentPushMap.size > 50) {
      for (const [k, ts] of recentPushMap.entries()) {
        if (now - ts > 10000) recentPushMap.delete(k);
      }
    }

    // 1. Physically vibrate device
    try {
      Vibration.vibrate([0, 250, 120, 250]);
    } catch (e) {
      // ignore vibration errors on unsupported devices
    }

    // 2. Dispatch system notification (displays outside the app / status bar / lock screen)
    try {
      const isUrgent = data?.priority === 'high' || data?.priority === 'critical' || data?.type === 'emergency_sos' || data?.type === 'sos';
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title || 'HOGO Notification',
          body: body || '',
          data: data,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          channelId: isUrgent ? 'emergency' : 'default',
        },
        trigger: null, // trigger: null dispatches immediately
      });
    } catch (notifErr) {
      console.log('[NotificationService] scheduleNotificationAsync error:', notifErr?.message);
    }

    // 3. Notify in-app subscribers (e.g. top banner)
    listeners.forEach((listener) => {
      try {
        listener({ title: title || 'HOGO Alert', body: body || '', data });
      } catch (err) {
        console.log('[NotificationListener] Error:', err?.message);
      }
    });

    console.log('[HOGO Push Notification]:', title, '-', body);
  } catch (err) {
    console.log('[NotificationService] showPushNotification error:', err?.message);
  }
}
