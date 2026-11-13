// campusride-mobile/src/services/pushNotification.js
import { Platform } from 'react-native';
import * as api from './api';

let lastRegisteredKey = null;

/**
 * Register push notification token with backend
 */
export async function registerForPushNotificationsAsync(userId = '') {
  try {
    let Notifications;
    try {
      Notifications = require('expo-notifications');
    } catch {
      return null;
    }

    if (!Notifications || !Notifications.getPermissionsAsync) return null;

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'HOGO Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#f5a623',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
      } catch {}
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
    const token = tokenData?.data;

    if (token) {
      const regKey = `${userId || 'guest'}_${token}`;
      if (lastRegisteredKey !== regKey) {
        await api.registerPushToken(token, Platform.OS).catch(() => {});
        lastRegisteredKey = regKey;
      }
      return token;
    }
  } catch (error) {
    console.log('Push notification registration notice:', error?.message);
  }
  return null;
}
