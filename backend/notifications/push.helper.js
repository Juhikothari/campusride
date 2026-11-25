// backend/notifications/push.helper.js - Real External Push Notifications via Expo Push Service with Retries & Ticket Inspection
const https = require('https');

/**
 * Send an Expo Push Notification to a given pushToken (or array of tokens).
 * Awaits provider response, inspects tickets, and retries on transient errors.
 * Expo docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */
async function sendExpoPushNotification(pushToken, { title, body, data = {}, sound = 'default', badge = 1, channelId = 'default' }, maxRetries = 2) {
  if (!pushToken || typeof pushToken !== 'string') {
    return { success: false, status: 'failed', error: 'Invalid or missing push token', attempts: 0 };
  }

  // Ensure valid Expo push token format
  const isExpoToken = pushToken.startsWith('ExponentPushToken[') || pushToken.startsWith('ExpoPushToken[');
  if (!isExpoToken) {
    return {
      success: false,
      status: 'failed',
      provider: 'EXPO',
      error: 'Invalid Expo push token format',
      messageId: null,
      attempts: 0
    };
  }

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

  let attempts = 0;
  let lastError = null;

  while (attempts <= maxRetries) {
    attempts++;
    try {
      const result = await new Promise((resolve, reject) => {
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
            timeout: 6000
          },
          (res) => {
            let responseBody = '';
            res.on('data', chunk => { responseBody += chunk; });
            res.on('end', () => {
              try {
                const parsed = JSON.parse(responseBody);
                resolve({ statusCode: res.statusCode, parsed });
              } catch {
                resolve({ statusCode: res.statusCode, raw: responseBody });
              }
            });
          }
        );

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Expo push notification request timed out'));
        });

        req.on('error', (err) => {
          reject(err);
        });

        req.write(payload);
        req.end();
      });

      // Analyze Expo push ticket
      // Expo response: { data: [ { status: 'ok', id: 'xxx' } ] } or { data: [ { status: 'error', message: '...', details: ... } ] }
      const tickets = result.parsed?.data;
      if (Array.isArray(tickets) && tickets.length > 0) {
        const ticket = tickets[0];
        if (ticket.status === 'ok') {
          return {
            success: true,
            status: 'provider_accepted',
            provider: 'EXPO',
            messageId: ticket.id,
            attempts,
            error: null
          };
        } else {
          return {
            success: false,
            status: 'failed',
            provider: 'EXPO',
            messageId: ticket.id || null,
            attempts,
            error: ticket.message || 'Expo push delivery rejected by provider',
            details: ticket.details
          };
        }
      }

      if (result.statusCode >= 200 && result.statusCode < 300) {
        return {
          success: true,
          status: 'provider_accepted',
          provider: 'EXPO',
          messageId: null,
          attempts,
          error: null
        };
      }

      lastError = new Error(`Expo HTTP ${result.statusCode}: ${JSON.stringify(result.parsed || result.raw)}`);
    } catch (err) {
      lastError = err;
    }

    if (attempts <= maxRetries) {
      const delay = Math.pow(2, attempts) * 100;
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return {
    success: false,
    status: 'failed',
    provider: 'EXPO',
    messageId: null,
    attempts,
    error: lastError ? lastError.message : 'Unknown push error'
  };
}

/**
 * Send push notification to a user by their MongoDB _id.
 * Saves Expo push ticket ID for asynchronous receipt verification.
 */
async function sendPushToUser(userId, { title, body, data = {}, sosId = null, notificationType = 'general' }) {
  try {
    const User = require('../users/users.model');
    const user = await User.findById(userId).select('pushToken');
    if (user?.pushToken) {
      const result = await sendExpoPushNotification(user.pushToken, { title, body, data });
      if (result.success) {
        console.log(`[Push] Expo accepted push ticket for user ${userId} (status=${result.status}, awaiting receipt)`);
        if (result.messageId) {
          try {
            const PushTicket = require('./pushTicket.model');
            await PushTicket.findOneAndUpdate(
              { ticketId: result.messageId },
              {
                $setOnInsert: {
                  ticketId: result.messageId,
                  sosId: sosId || (data && data.sosId ? data.sosId : null),
                  userId,
                  pushToken: user.pushToken,
                  notificationType: notificationType || (data && data.type) || 'general',
                  status: 'provider_accepted',
                  nextRetryAt: new Date(Date.now() + 15 * 1000)
                }
              },
              { upsert: true }
            );
          } catch (ticketErr) {
            console.warn('[Push] Failed persisting PushTicket:', ticketErr.message);
          }
        }
      } else {
        console.warn(`[Push] Provider rejected push request for user ${userId}:`, result.error);
      }
      return result;
    }
    return { success: false, status: 'failed', error: 'User has no pushToken registered', attempts: 0 };
  } catch (err) {
    console.error('[Push] Error sending push to user:', err.message);
    return { success: false, status: 'failed', error: err.message, attempts: 0 };
  }
}

/**
 * Retrieve push delivery receipts from Expo to confirm APNs/FCM delivery.
 * Expo API: POST https://exp.host/--/api/v2/push/getReceipts
 */
async function verifyPushReceipts(receiptIds) {
  if (!Array.isArray(receiptIds) || receiptIds.length === 0) return {};
  const payload = JSON.stringify({ ids: receiptIds });
  return new Promise((resolve) => {
    const req = https.request(
      'https://exp.host/--/api/v2/push/getReceipts',
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 8000,
      },
      (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed.data || {});
          } catch {
            resolve({});
          }
        });
      }
    );
    req.on('timeout', () => { req.destroy(); resolve({}); });
    req.on('error', () => resolve({}));
    req.write(payload);
    req.end();
  });
}

module.exports = { sendExpoPushNotification, sendPushToUser, verifyPushReceipts };
