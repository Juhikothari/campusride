const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ride',
      required: false,   // optional — not all reviews are tied to a tracked ride
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

// Index for fast lookup of all ratings for a user
ratingSchema.index({ reviewedUser: 1, createdAt: -1 });

// Enforce one rating per reviewer per ride (ride-linked ratings only)
ratingSchema.index(
  { rideId: 1, reviewer: 1 },
  { unique: true, partialFilterExpression: { rideId: { $exists: true, $ne: null } } }
);

const Rating = mongoose.model('Rating', ratingSchema);

module.exports = Rating;