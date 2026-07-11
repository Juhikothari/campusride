const Rating = require('./ratings.model');
const User = require('../users/users.model');
const Notification = require('../notifications/notifications.model');

exports.addRating = async (req, res) => {
  try {
    const { rideId, reviewedUser, rating, comment } = req.body;
    const reviewer = req.user.userId;
    if (!rideId) {
      return res.status(400).json({ message: 'rideId is required to submit a ride rating' });
    }


    console.log('📥 addRating called:', { reviewer, reviewedUser, rating, rideId });

    if (!reviewedUser) {
      return res.status(400).json({ message: 'reviewedUser is required' });
    }

    // Prevent self-rating
    if (String(reviewer) === String(reviewedUser)) {
      return res.status(400).json({ message: 'You cannot rate yourself' });
    }

    // Validate rating value
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Prevent duplicate rating for the same ride by the same reviewer
    const existing = await Rating.findOne({ rideId, reviewer });
    if (existing) {
      return res.status(409).json({ message: 'You have already rated this ride' });
    }

    const newRating = new Rating({
      rideId: rideId || undefined,
      reviewer,
      reviewedUser,
      rating,
      comment: comment?.trim() || undefined,
    });

    await newRating.save();
    console.log('✅ Rating saved:', newRating._id);

    // Update the reviewed user's aggregate rating — defensive against missing fields
    const user = await User.findById(reviewedUser);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const prevTotal = user.totalRatings || 0;
    const prevAvg   = user.averageRating || 0;
    const newTotal  = prevTotal + 1;
    const newAvg    = ((prevAvg * prevTotal) + Number(rating)) / newTotal;

    await User.findByIdAndUpdate(reviewedUser, {
      totalRatings:  newTotal,
      averageRating: Number(newAvg.toFixed(2)),
    });

    const populated = await Rating.findById(newRating._id).populate('reviewer', 'name');

    // Notify provider/reviewed user about new rating
    try {
      await Notification.create({
        userId: reviewedUser,
        userType: 'provider',
        type: 'rating_received',
        title: '⭐ New rating received',
        body: `${populated?.reviewer?.name || 'A user'} rated your ride ${rating}/5.`,
        data: {
          rideId,
          ratingId: populated?._id,
          rating,
          reviewerId: reviewer,
        },
        channels: ['in_app'],
        priority: 'normal',
      });
    } catch (notifErr) {
      console.error('⚠ Failed to create rating notification:', notifErr.message);
    }

    res.status(201).json({
      message: 'Rating added successfully',
      rating: populated,
    });

  } catch (error) {
    console.error('❌ addRating error:', error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
};

exports.getUserRatings = async (req, res) => {
  try {
    const ratings = await Rating.find({ reviewedUser: req.params.userId })
      .populate('reviewer', 'name college')
      .populate('reviewedUser', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json(ratings);

  } catch (error) {
    console.error('getUserRatings error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getRatingsByReviewer = async (req, res) => {
  try {
    const ratings = await Rating.find({ reviewer: req.params.userId })
      .populate('reviewer', 'name college')
      .populate('reviewedUser', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json(ratings);
  } catch (error) {
    console.error('getRatingsByReviewer error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getRideRatings = async (req, res) => {
  try {
    const ratings = await Rating.find({ rideId: req.params.rideId })
      .populate('reviewer', 'name college')
      .populate('reviewedUser', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json(ratings);
  } catch (error) {
    console.error('getRideRatings error:', error);
    res.status(500).json({ error: error.message });
  }
};