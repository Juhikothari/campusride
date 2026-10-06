// campusride-mobile/src/services/notificationService.js
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Set notification handler so alerts show immediately on phone
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let isInitialized = false;

export async function initNotificationService() {
  if (isInitialized) return true;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'CampusRide Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2dd4a0',
        enableLights: true,
        enableVibrate: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    isInitialized = finalStatus === 'granted';
    return isInitialized;
  } catch (err) {
    console.log('Notification permission initialization error:', err);
    return false;
  }
}

export async function showPushNotification({ title, body, data = {} }) {
  try {
    await initNotificationService();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || 'CampusRide Alert',
        body: body || '',
        data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // null triggers immediately as system heads-up notification
    });
  } catch (err) {
    console.log('Failed to schedule push notification:', err);
  }
}
