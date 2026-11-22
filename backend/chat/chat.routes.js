const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Chat = require('./chat.model');
const Ride = require('../rides/rides.model');
const Booking = require('../bookings/bookings.model');
const User = require('../users/users.model');

// Strictly authorized ride chat: only active participants (provider or accepted passenger) or admin
router.get('/:rideId', auth, async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.userId;

    const [user, ride] = await Promise.all([
      User.findById(userId).select('role blocked suspended'),
      Ride.findById(rideId).select('providerId')
    ]);

    if (!user || user.blocked || user.suspended) {
      return res.status(403).json({ message: 'Account is restricted' });
    }

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    const isAdmin = user.role === 'admin';
    const isProvider = ride.providerId.toString() === userId.toString();
    const isSeeker = await Booking.exists({
      rideId,
      seekerId: userId,
      status: { $in: ['accepted', 'completed'] }
    });

    if (!isAdmin && !isProvider && !isSeeker) {
      return res.status(403).json({ message: 'Access denied: You are not an authorized participant in this ride.' });
    }

    const messages = await Chat.find({ rideId })
      .populate('sender', 'name')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;