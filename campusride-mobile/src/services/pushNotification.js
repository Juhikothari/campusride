// campusride-mobile/src/services/pushNotification.js
import { Platform } from 'react-native';
import * as api from './api';

let isRegistered = false;

/**
 * Register push notification token with backend
 */
export async function registerForPushNotificationsAsync() {
  if (isRegistered) return null;
  try {
    // If expo-notifications is available in runtime
    let Notifications;
    try {
      Notifications = require('expo-notifications');
    } catch {
      return null;
    }

    if (!Notifications || !Notifications.getPermissionsAsync) return null;

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
      await api.registerPushToken(token, Platform.OS).catch(() => {});
      isRegistered = true;
      return token;
    }
  } catch (error) {
    console.log('Push notification registration notice:', error?.message);
  }
  return null;
}
