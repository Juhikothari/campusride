// backend/notifications/push.helper.js - Real External Push Notifications via Expo Push Service
const https = require('https');

/**
 * Send an Expo Push Notification to a given pushToken (or array of tokens).
 * Expo docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */
async function sendExpoPushNotification(pushToken, { title, body, data = {}, sound = 'default', badge = 1, channelId = 'default' }) {
  if (!pushToken || typeof pushToken !== 'string') return null;

  const payload = JSON.stringify({
    to: pushToken,
    sound,
    title,
    body,
    data,
    badge,
    channelId,
    priority: 'high',
  });

  return new Promise((resolve) => {
    const req = https.request(
      'https://exp.host/--/api/v2/push/send',
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', chunk => { responseBody += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseBody);
            resolve(parsed);
          } catch {
            resolve({ raw: responseBody });
          }
        });
      }
    );

    req.on('error', (err) => {
      console.error('[Push] Network error sending push notification:', err.message);
      resolve(null);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Send push notification to a user by their MongoDB _id
 */
async function sendPushToUser(userId, { title, body, data = {} }) {
  try {
    const User = require('../users/users.model');
    const user = await User.findById(userId).select('pushToken');
    if (user?.pushToken) {
      const res = await sendExpoPushNotification(user.pushToken, { title, body, data });
      console.log(`[Push] Delivered push notification to user ${userId}:`, title);
      return res;
    }
  } catch (err) {
    console.error('[Push] Error sending push to user:', err.message);
  }
  return null;
}

module.exports = { sendExpoPushNotification, sendPushToUser };
