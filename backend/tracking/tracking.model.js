const mongoose = require("mongoose");

const trackingSchema = new mongoose.Schema({
  rideId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ride',
    required: true 
  },
  providerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: "active"
  },
  locations: [
    {
      lat: Number,
      lng: Number,
      time: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

// Index for faster queries
trackingSchema.index({ rideId: 1 });
trackingSchema.index({ providerId: 1 });
trackingSchema.index({ status: 1 });

module.exports = mongoose.model("Tracking", trackingSchema);