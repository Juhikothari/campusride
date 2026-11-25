// backend/notifications/pushTicket.model.js
// Persistent storage for Expo Push Tickets awaiting asynchronous APNs/FCM receipt verification.
const mongoose = require('mongoose');

const pushTicketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  sosId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SOS',
    default: null,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  pushToken: {
    type: String,
    default: null
  },
  notificationType: {
    type: String,
    default: 'general'
  },
  status: {
    type: String,
    enum: ['pending', 'queued', 'provider_accepted', 'delivered', 'failed', 'client_action_required'],
    default: 'provider_accepted',
    index: true
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 5
  },
  nextRetryAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastCheckedAt: {
    type: Date,
    default: null
  },
  // Atomic lease lock to prevent duplicate processing across multiple backend instances
  processingLockUntil: {
    type: Date,
    default: null
  },
  providerError: {
    type: String,
    default: null
  },
  providerErrorCode: {
    type: String,
    default: null
  },
  receiptDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  // Retention & cleanup TTL (30 days by default)
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    index: { expires: 0 }
  }
}, { timestamps: true });

pushTicketSchema.index({ status: 1, nextRetryAt: 1, processingLockUntil: 1 });

module.exports = mongoose.model('PushTicket', pushTicketSchema);
