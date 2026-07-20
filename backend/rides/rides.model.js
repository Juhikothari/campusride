const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pickup: {
    type:        { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true },  // [lng, lat]
    address:     { type: String, default: '' },
  },
  drop: {
    type:        { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true },
    address:     { type: String, default: '' },
  },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  seatsAvailable: { type: Number, required: true },
  costPerSeat:    { type: Number, required: true },
  status: { type: String, enum: ['active', 'completed', 'cancelled', 'in-progress'], default: 'active' },

  // Women-only ride safety feature
  womenOnly: { type: Boolean, default: false },

  // College-scoped rides — only same college seekers can book
  college: { type: String, default: '' },

  // Vehicle type for filtering
  vehicleType: { type: String, enum: ['motorcycle', 'car', 'suv', 'xuv', ''], default: '' },

  isRecurring: { type: Boolean, default: false },
  recurringPattern: {
    frequency:         { type: String, enum: ['daily', 'weekly', 'weekdays', 'weekends', 'custom'], default: null },
    daysOfWeek:        [{ type: Number, min: 0, max: 6 }],
    endDate:           { type: Date },
    occurrences:       { type: Number },
    currentOccurrence: { type: Number, default: 1 }
  },
  parentRideId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', default: null },
  recurringGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', default: null },
  preRideChecklist: {
    vehicleInspected:  { type: Boolean, default: false },
    emergencyKitReady: { type: Boolean, default: false },
    routeConfirmed:    { type: Boolean, default: false },
    contactsNotified:  { type: Boolean, default: false },
    completedAt:       { type: Date }
  },
  passengerPickedUpAt: { type: Date },
  passengerDroppedAt:  { type: Date },
  startedAt:           { type: Date },
  completedAt:         { type: Date },
  cancelledAt:         { type: Date },
  cancelReason:        { type: String },
}, { timestamps: true });

rideSchema.index({ pickup: '2dsphere' });
rideSchema.index({ recurringGroupId: 1 });
rideSchema.index({ parentRideId: 1 });

module.exports = mongoose.model('Ride', rideSchema);
