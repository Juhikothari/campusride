const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  userType: {
    type: String,
    enum: ['provider', 'seeker', 'admin', 'user', 'both'],
    default: 'user',
  },
  type: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    required: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  channels: [{
    type: String,
  }],
  readAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);