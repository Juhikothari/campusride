// backend/notifications/pushReceipt.worker.js
// Reliable Multi-Instance Safe Background Worker for Expo Push Receipt Verification.
// Distinguishes Expo ticket acceptance ('provider_accepted') from APNs/FCM receipt confirmation ('delivered').
// Note: 'delivered' indicates the push provider (APNs/FCM) accepted the notification from Expo for device delivery;
// it does NOT prove the human recipient opened or read it.

const PushTicket = require('./pushTicket.model');
const { verifyPushReceipts } = require('./push.helper');
const SOS = require('../sos/sos.model');
const User = require('../users/users.model');

const BATCH_SIZE = 100;
const LOCK_DURATION_MS = 2 * 60 * 1000; // 2 minute processing lease per ticket
const DEFAULT_MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 15 * 1000; // 15 seconds * 2^retry (30s, 60s, 120s, 240s...)
const MAX_BACKOFF_MS = 30 * 60 * 1000; // Capped at 30 minutes

// Expo permanent error codes that must NOT be retried
const PERMANENT_EXPO_ERRORS = new Set([
  'DeviceNotRegistered',
  'MessageTooBig',
  'InvalidCredentials',
  'MismatchSenderId'
]);

/**
 * Claims a batch of due push tickets atomically so concurrent server instances never double-process a ticket.
 */
async function claimDueTickets(batchSize = BATCH_SIZE) {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + LOCK_DURATION_MS);
  const claimed = [];

  for (let i = 0; i < batchSize; i++) {
    const ticket = await PushTicket.findOneAndUpdate(
      {
        status: 'provider_accepted',
        nextRetryAt: { $lte: now },
        $expr: { $lt: ['$retryCount', '$maxRetries'] },
        $or: [
          { processingLockUntil: null },
          { processingLockUntil: { $lt: now } }
        ]
      },
      {
        $set: {
          processingLockUntil: lockUntil,
          lastCheckedAt: now
        }
      },
      { sort: { nextRetryAt: 1 }, returnDocument: 'after' }
    );

    if (!ticket) break;
    claimed.push(ticket);
  }

  return claimed;
}

/**
 * Updates linked SOS record when a push receipt reaches a terminal outcome ('delivered' or 'failed').
 */
async function syncSosNotificationReceipt(ticket, newStatus, errorMessage = null, errorCode = null) {
  if (!ticket.sosId) return;
  try {
    const sos = await SOS.findById(ticket.sosId);
    if (!sos) return;

    let changed = false;
    for (const notif of sos.notificationsSent) {
      if (notif.messageId === ticket.ticketId && notif.type === 'push') {
        // Prevent duplicate processing or illegal transition away from terminal state
        if (notif.status === 'delivered' || notif.status === 'failed') {
          continue;
        }
        notif.status = newStatus;
        if (errorMessage) notif.error = errorCode ? `${errorCode}: ${errorMessage}` : errorMessage;
        notif.notes = newStatus === 'delivered'
          ? 'Expo push receipt confirmed APNs/FCM handoff (does not confirm user read)'
          : `Expo push receipt failed: ${errorCode || errorMessage || 'Unknown error'}`;
        changed = true;
      }
    }

    if (changed) {
      if (!sos.auditLog) sos.auditLog = [];
      sos.auditLog.push({
        action: 'expo_receipt_processed',
        timestamp: new Date(),
        notes: `Expo receipt for ticket ${ticket.ticketId} resolved to ${newStatus}`,
        metadata: {
          ticketId: ticket.ticketId,
          status: newStatus,
          errorCode: errorCode || null
        }
      });
      await sos.save();
    }
  } catch (err) {
    console.error('[PushReceiptWorker] Failed updating linked SOS record:', err.message);
  }
}

/**
 * Processes pending Expo push receipts in batches.
 * Optionally accepts a custom fetcher function for deterministic unit/integration testing.
 */
async function processPendingPushReceipts(receiptFetcher = verifyPushReceipts) {
  const summary = {
    claimed: 0,
    delivered: 0,
    failedPermanent: 0,
    retriedTransient: 0,
    failedMaxRetries: 0
  };

  try {
    const tickets = await claimDueTickets(BATCH_SIZE);
    if (!tickets.length) return summary;
    summary.claimed = tickets.length;

    const ticketIds = tickets.map(t => t.ticketId);
    const receiptsMap = (await receiptFetcher(ticketIds)) || {};
    const now = new Date();

    for (const ticket of tickets) {
      const receipt = receiptsMap[ticket.ticketId];

      if (receipt && receipt.status === 'ok') {
        // Receipt confirmed by Expo -> handed off to APNs/FCM
        ticket.status = 'delivered';
        ticket.resolvedAt = now;
        ticket.processingLockUntil = null;
        ticket.receiptDetails = {
          providerOutcome: 'ok',
          note: 'Accepted by push provider (APNs/FCM); does not confirm human view'
        };
        await ticket.save();
        await syncSosNotificationReceipt(ticket, 'delivered');
        summary.delivered++;
        continue;
      }

      if (receipt && receipt.status === 'error') {
        const errCode = receipt.details?.error || 'ExpoReceiptError';
        const errMsg = receipt.message || 'Push delivery failed at provider receipt check';
        const isPermanent = PERMANENT_EXPO_ERRORS.has(errCode);

        if (errCode === 'DeviceNotRegistered' && ticket.pushToken) {
          // Prune stale invalid Expo push token from User profile
          await User.updateOne(
            { _id: ticket.userId, pushToken: ticket.pushToken },
            { $set: { pushToken: null } }
          ).catch(() => {});
        }

        if (isPermanent) {
          ticket.status = 'failed';
          ticket.providerError = errMsg;
          ticket.providerErrorCode = errCode;
          ticket.receiptDetails = receipt.details || null;
          ticket.resolvedAt = now;
          ticket.processingLockUntil = null;
          await ticket.save();
          await syncSosNotificationReceipt(ticket, 'failed', errMsg, errCode);
          summary.failedPermanent++;
          continue;
        }

        // Transient provider error (e.g., MessageRateExceeded) -> backoff & retry up to maxRetries
        const nextCount = (ticket.retryCount || 0) + 1;
        const maxR = ticket.maxRetries || DEFAULT_MAX_RETRIES;
        if (nextCount >= maxR) {
          ticket.retryCount = nextCount;
          ticket.status = 'failed';
          ticket.providerError = `Max retries exceeded: ${errMsg}`;
          ticket.providerErrorCode = errCode;
          ticket.receiptDetails = receipt.details || null;
          ticket.resolvedAt = now;
          ticket.processingLockUntil = null;
          await ticket.save();
          await syncSosNotificationReceipt(ticket, 'failed', ticket.providerError, errCode);
          summary.failedMaxRetries++;
        } else {
          const delayMs = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, nextCount));
          ticket.retryCount = nextCount;
          ticket.providerError = errMsg;
          ticket.providerErrorCode = errCode;
          ticket.nextRetryAt = new Date(now.getTime() + delayMs);
          ticket.processingLockUntil = null;
          await ticket.save();
          summary.retriedTransient++;
        }
        continue;
      }

      // Receipt not yet present in Expo response (transient delay)
      const nextCount = (ticket.retryCount || 0) + 1;
      const maxR = ticket.maxRetries || DEFAULT_MAX_RETRIES;
      if (nextCount >= maxR) {
        ticket.retryCount = nextCount;
        ticket.status = 'failed';
        ticket.providerError = 'Push receipt unavailable after maximum retry attempts';
        ticket.providerErrorCode = 'RECEIPT_TIMEOUT';
        ticket.resolvedAt = now;
        ticket.processingLockUntil = null;
        await ticket.save();
        await syncSosNotificationReceipt(ticket, 'failed', ticket.providerError, 'RECEIPT_TIMEOUT');
        summary.failedMaxRetries++;
      } else {
        const delayMs = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, nextCount));
        ticket.retryCount = nextCount;
        ticket.nextRetryAt = new Date(now.getTime() + delayMs);
        ticket.processingLockUntil = null;
        await ticket.save();
        summary.retriedTransient++;
      }
    }
  } catch (err) {
    console.error('[PushReceiptWorker] Batch processing error:', err.message);
  }

  return summary;
}

/**
 * Deletes resolved/expired push ticket records older than the retention window (30 days default).
 */
async function cleanupOldPushReceipts(retentionDays = 30) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const res = await PushTicket.deleteMany({
    createdAt: { $lt: cutoff },
    status: { $in: ['delivered', 'failed', 'client_action_required'] }
  });
  return res.deletedCount || 0;
}

let workerInterval = null;
function startPushReceiptWorker(intervalMs = 30 * 1000) {
  if (workerInterval) return;
  workerInterval = setInterval(() => {
    processPendingPushReceipts().catch(err => console.error('[PushReceiptWorker]', err.message));
  }, intervalMs);
  if (workerInterval.unref) workerInterval.unref();
  console.log(`📡 Expo Push Receipt Worker started (${intervalMs / 1000}s interval)`);
}

function stopPushReceiptWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}

module.exports = {
  processPendingPushReceipts,
  cleanupOldPushReceipts,
  startPushReceiptWorker,
  stopPushReceiptWorker,
  PERMANENT_EXPO_ERRORS
};
