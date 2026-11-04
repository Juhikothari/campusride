// backend/bookings/bookings.model.js - CORRECTED
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  rideId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ride', 
    required: true 
  },
  seekerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  seats: { type: Number, required: true, min: 1 },
  // FIXED: Added 'cancelled' to enum
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected', 'cancelled'], 
    default: 'pending' 
  },

  // Where THIS seeker wants to be picked up / dropped (defaults to the ride's own points)
  pickup: {
    type:        { type: String, default: 'Point' },
    coordinates: { type: [Number], default: undefined },   // [lng, lat]
    address:     { type: String, default: '' },
  },
  drop: {
    type:        { type: String, default: 'Point' },
    coordinates: { type: [Number], default: undefined },
    address:     { type: String, default: '' },
  },

  // Progress of this seeker along the provider's stop list
  // (kept separate from `status` so existing accepted/pending logic is untouched)
  stopStatus:  { type: String, enum: ['waiting', 'picked_up', 'dropped'], default: 'waiting' },
  pickedUpAt:  { type: Date },
  droppedAt:   { type: Date },

  // 4-digit code the seeker tells the provider at pickup. Hidden from normal queries.
  pickupCode:   { type: String, select: false },
  codeAttempts: { type: Number, default: 0, select: false },
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
