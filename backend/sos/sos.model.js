const mongoose = require('mongoose');

const sosSchema = new mongoose.Schema({
  rideId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ride', 
    required: true 
  },
  
  // Who triggered
  triggeredBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['provider', 'seeker'], required: true }
  },
  
  // Location when triggered
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String }
  },
  
  // SOS details
  type: { 
    type: String, 
    enum: ['medical', 'accident', 'harassment', 'vehicle_breakdown', 'other'],
    default: 'other'
  },
  description: { type: String },
  
  // Status tracking
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'false_alarm', 'cancelled'],
    default: 'active'
  },
  
  // Idempotency to prevent duplicate activations
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // Response tracking
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acknowledgedAt: { type: Date },
  resolvedAt: { type: Date },
  resolutionNotes: { type: String },
  cancelledAt: { type: Date },
  cancellationReason: { type: String },
  
  // Explicit notification states
  notificationsSent: [{
    type: { type: String, enum: ['sms', 'email', 'push', 'admin'], required: true },
    recipient: { type: String },
    sentAt: { type: Date, default: Date.now },
    status: { 
      type: String, 
      enum: ['pending', 'queued', 'provider_accepted', 'sent', 'delivered', 'failed', 'client_action_required'],
      required: true
    },
    provider: { type: String },
    messageId: { type: String },
    idempotencyKey: { type: String },
    attempts: { type: Number, default: 1 },
    error: { type: String },
    notes: { type: String }
  }],
  
  // Emergency contacts details & per-contact delivery status
  emergencyContacts: [{
    name: { type: String },
    phone: { type: String },
    relation: { type: String },
    deliveryStatus: { 
      type: String, 
      enum: ['pending', 'queued', 'provider_accepted', 'sent', 'delivered', 'failed', 'client_action_required'],
      default: 'client_action_required'
    },
    provider: { type: String },
    messageId: { type: String },
    notifiedAt: { type: Date }
  }],

  // Audit trail for every lifecycle event
  auditLog: [{
    action: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed }
  }],
  
  createdAt: { type: Date, default: Date.now }
});

sosSchema.index({ rideId: 1 });
sosSchema.index({ status: 1 });
sosSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SOS', sosSchema);
