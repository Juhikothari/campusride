const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  // Alert criteria
  pickup: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  drop: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  pickupRadius: { type: Number, default: 5000 }, // meters
  dropRadius: { type: Number, default: 5000 }, // meters
  
  // Time preferences
  date: { type: Date }, // specific date or null for any
  timeRange: {
    start: { type: String }, // "08:00"
    end: { type: String }    // "10:00"
  },
  recurringDays: [{ type: Number, min: 0, max: 6 }], // for recurring alerts
  
  // Alert settings
  isActive: { type: Boolean, default: true },
  notifyEmail: { type: Boolean, default: true },
  notifyPush: { type: Boolean, default: true },
  
  // Matching results
  lastNotified: { type: Date },
  matchCount: { type: Number, default: 0 },
  
  // Metadata
  name: { type: String }, // optional name for this alert
  createdAt: { type: Date, default: Date.now }
});

alertSchema.index({ userId: 1 });
alertSchema.index({ pickup: '2dsphere' });
alertSchema.index({ isActive: 1 });

module.exports = mongoose.model('Alert', alertSchema);