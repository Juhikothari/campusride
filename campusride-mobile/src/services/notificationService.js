// campusride-mobile/src/services/notificationService.js
import { Platform, Vibration, Alert } from 'react-native';

const listeners = new Set();

export function addNotificationListener(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export async function initNotificationService() {
  return true;
}

export async function showPushNotification({ title, body, data = {} }) {
  try {
    // 1. Physically vibrate device
    try {
      Vibration.vibrate([0, 250, 120, 250]);
    } catch (e) {
      // ignore vibration errors on unsupported devices
    }

    // 2. Notify in-app subscribers
    listeners.forEach((listener) => {
      try {
        listener({ title: title || 'CampusRide Alert', body: body || '', data });
      } catch (err) {
        console.log('[NotificationListener] Error:', err?.message);
      }
    });

    console.log('[CampusRide Notification]:', title, '-', body);
  } catch (err) {
    console.log('[NotificationService] showPushNotification error:', err?.message);
  }
}
