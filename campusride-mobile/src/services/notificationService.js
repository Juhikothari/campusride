// campusride-mobile/src/services/notificationService.js
import { Platform } from 'react-native';

let Notifications = null;
let isHandlerSet = false;
let isInitialized = false;

function getNotificationsModule() {
  if (Notifications !== null) return Notifications;
  try {
    // Dynamically require so if native module is absent (e.g. Expo Go / unlinked build), app never crashes on startup
    const mod = require('expo-notifications');
    if (mod && typeof mod.setNotificationHandler === 'function') {
      Notifications = mod;
      if (!isHandlerSet) {
        try {
          mod.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
            }),
          });
          isHandlerSet = true;
        } catch (e) {
          console.log('[NotificationService] setNotificationHandler error:', e?.message);
        }
      }
    } else {
      Notifications = false;
    }
  } catch (err) {
    console.log('[NotificationService] expo-notifications not available in current runtime:', err?.message);
    Notifications = false;
  }
  return Notifications;
}

export async function initNotificationService() {
  if (isInitialized) return true;
  const notif = getNotificationsModule();
  if (!notif) return false;
  try {
    if (Platform.OS === 'android' && typeof notif.setNotificationChannelAsync === 'function') {
      await notif.setNotificationChannelAsync('default', {
        name: 'CampusRide Alerts',
        importance: notif.AndroidImportance?.MAX || 5,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2dd4a0',
        enableLights: true,
        enableVibrate: true,
      });
    }

    if (typeof notif.getPermissionsAsync === 'function') {
      const { status: existingStatus } = await notif.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted' && typeof notif.requestPermissionsAsync === 'function') {
        const { status } = await notif.requestPermissionsAsync();
        finalStatus = status;
      }
      isInitialized = finalStatus === 'granted';
      return isInitialized;
    }
  } catch (err) {
    console.log('[NotificationService] Permission initialization error:', err?.message);
  }
  return false;
}

export async function showPushNotification({ title, body, data = {} }) {
  const notif = getNotificationsModule();
  if (!notif) {
    console.log('[Notification Alert]:', title, '-', body);
    return;
  }
  try {
    await initNotificationService();
    if (typeof notif.scheduleNotificationAsync === 'function') {
      await notif.scheduleNotificationAsync({
        content: {
          title: title || 'CampusRide Alert',
          body: body || '',
          data,
          sound: true,
          priority: notif.AndroidNotificationPriority?.HIGH,
        },
        trigger: null, // trigger immediately as system heads-up notification
      });
    }
  } catch (err) {
    console.log('[NotificationService] scheduleNotificationAsync error:', err?.message);
  }
}
