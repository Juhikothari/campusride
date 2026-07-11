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
    enum: ['active', 'acknowledged', 'resolved', 'false_alarm'],
    default: 'active'
  },
  
  // Response tracking
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acknowledgedAt: { type: Date },
  resolvedAt: { type: Date },
  resolutionNotes: { type: String },
  
  // Notifications sent
  notificationsSent: [{
    type: { type: String, enum: ['sms', 'email', 'push', 'admin'] },
    recipient: { type: String },
    sentAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['sent', 'delivered', 'failed'] }
  }],
  
  // Emergency contacts notified
  emergencyContacts: [{
    name: { type: String },
    phone: { type: String },
    relation: { type: String },
    notifiedAt: { type: Date }
  }],
  
  createdAt: { type: Date, default: Date.now }
});

sosSchema.index({ rideId: 1 });
sosSchema.index({ status: 1 });
sosSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SOS', sosSchema);