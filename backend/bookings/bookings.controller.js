// backend/bookings/bookings.controller.js - CORRECTED
const Booking = require('./bookings.model');
const Ride = require('../rides/rides.model');
const User = require('../users/users.model');
const Notification = require('../notifications/notifications.model');

// ================= REQUEST BOOKING (Seeker) =================
exports.requestBooking = async (req, res) => {
  try {
    //const { rideId } = req.body;
    const { rideId, seats } = req.body;
    const seekerId = req.user.userId;

    // Check if ride exists and is active
    const ride = await Ride.findById(rideId).populate('providerId', 'name fcmToken socketId college kycDocuments usn');
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }
    if (ride.status !== 'active') {
      return res.status(400).json({ message: 'Ride is not active' });
    }
    if (ride.seatsAvailable < 1) {
      return res.status(400).json({ message: 'No seats available' });
    }

    // Same college check — seeker and provider must be from same college
    const seeker = await User.findById(seekerId).select('college gender');
    if (seeker?.college && ride.college) {
      if (seeker.college.trim().toLowerCase() !== ride.college.trim().toLowerCase()) {
        return res.status(403).json({ message: 'You can only book rides from your own college.' });
      }
    }

    // Women-only ride check
    if (ride.womenOnly && seeker?.gender !== 'female') {
      return res.status(403).json({ message: 'This is a women-only ride.' });
    }

    // Check if user already requested this ride
    const existingBooking = await Booking.findOne({ rideId, seekerId });
    if (existingBooking) {
      return res.status(400).json({ message: 'You already requested this ride' });
    }

    // Create booking
    const requestedSeats = Math.max(1, parseInt(seats) || 1);

    // Validate seats
    if (requestedSeats < 1 || requestedSeats > ride.seatsAvailable) {
      return res.status(400).json({ message: `Invalid seat count. Available: ${ride.seatsAvailable}` });
    }

// Create booking WITH seats
const booking = new Booking({
  rideId,
  seekerId,
  seats: requestedSeats, // ✅ FIX
  status: 'pending'
});

await booking.save();

// Decrease seats properly
ride.seatsAvailable -= requestedSeats; // ✅ FIX
await ride.save();
    // ================= PROVIDER NOTIFICATION: New Booking Request =================
    try {
      const providerNotification = new Notification({
        userId: ride.providerId._id,
        userType: 'provider',
        type: 'BOOKING_REQUEST',
        title: '🎉 New Booking Request!',
        body: `${req.user.name || 'A seeker'} requested to book your ride from ${ride.pickup?.name || 'pickup'} to ${ride.drop?.name || 'drop'}`,
        data: {
          bookingId: booking._id,
          rideId: ride._id,
          seekerId: seekerId,
          seekerName: req.user.name,
          pickup: ride.pickup,
          drop: ride.drop,
          date: ride.date,
          time: ride.time
        },
        priority: 'high',
        channels: ['in_app', 'socket']
      });
      await providerNotification.save();

      // Real-time socket notification
      const io = req.app.get('io');
      if (io) {
        io.to(`provider-${ride.providerId._id}`).emit('new-booking', {
          notification: providerNotification.toObject(),
          booking: {
            _id: booking._id,
            seeker: {
              _id: seekerId,
              name: req.user.name,
              phone: req.user.phone
            },
            ride: {
              _id: ride._id,
              pickup: ride.pickup,
              drop: ride.drop,
              date: ride.date,
              time: ride.time
            },
            createdAt: booking.createdAt
          }
        });
      }
    } catch (notifError) {
      console.error('Provider notification error:', notifError);
      // Don't fail the booking if notification fails
    }

    // ================= SEEKER ALERT: Low Availability Notification =================
    // If seats remaining is 2 or less, notify other seekers with matching alerts
    if (ride.seatsAvailable <= 2 && ride.seatsAvailable > 0) {
      try {
        const Alert = require('../alerts/alerts.model');
        
        // Find active alerts matching this ride's route
        const matchingAlerts = await Alert.find({
          isActive: true,
          userId: { $ne: seekerId }, // Don't notify the booker
          pickup: {
            $near: {
              $geometry: ride.pickup,
              $maxDistance: 10000 // 10km radius
            }
          },
          date: {
            $gte: new Date(ride.date.setHours(0,0,0,0)),
            $lt: new Date(ride.date.setHours(23,59,59,999))
          }
        }).populate('userId', 'name');

        // Filter by drop distance
        const alertsToNotify = matchingAlerts.filter(alert => {
          if (!alert.drop || !alert.drop.coordinates || !ride.drop?.coordinates) return false;
          
          const R = 6371e3;
          const φ1 = ride.drop.coordinates[1] * Math.PI / 180;
          const φ2 = alert.drop.coordinates[1] * Math.PI / 180;
          const Δφ = (alert.drop.coordinates[1] - ride.drop.coordinates[1]) * Math.PI / 180;
          const Δλ = (alert.drop.coordinates[0] - ride.drop.coordinates[0]) * Math.PI / 180;
          const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                    Math.cos(φ1) * Math.cos(φ2) *
                    Math.sin(Δλ/2) * Math.sin(Δλ/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;
          
          return distance <= (alert.dropRadius || 5000);
        });

        // Create urgent notifications
        for (const alert of alertsToNotify) {
          const urgentNotification = new Notification({
            userId: alert.userId._id,
            userType: 'seeker',
            type: 'URGENT_AVAILABILITY',
            title: `🔥 Only ${ride.seatsAvailable} seat${ride.seatsAvailable > 1 ? 's' : ''} left!`,
            body: `Hurry! Ride from ${ride.pickup?.name || 'pickup'} to ${ride.drop?.name || 'drop'} on ${ride.date?.toDateString()} has only ${ride.seatsAvailable} seat${ride.seatsAvailable > 1 ? 's' : ''} remaining.`,
            data: {
              rideId: ride._id,
              remainingSeats: ride.seatsAvailable,
              pickup: ride.pickup,
              drop: ride.drop,
              date: ride.date,
              time: ride.time,
              urgency: 'critical'
            },
            priority: 'critical',
            channels: ['in_app', 'socket'],
            expiresAt: new Date(Date.now() + 3600000) // 1 hour
          });
          await urgentNotification.save();

          // Real-time notification
          const io = req.app.get('io');
          if (io) {
            io.to(`user-${alert.userId._id}`).emit('urgent-availability', {
              notification: urgentNotification.toObject(),
              ride: {
                _id: ride._id,
                pickup: ride.pickup,
                drop: ride.drop,
                date: ride.date,
                time: ride.time,
                seatsAvailable: ride.seatsAvailable,
                price: ride.costPerSeat
              }
            });
          }
        }

        console.log(`[URGENT] Sent ${alertsToNotify.length} low availability notifications`);
      } catch (alertError) {
        console.error('Low availability notification error:', alertError);
        // Don't fail the booking if alert notification fails
      }
    }

    res.status(201).json({
      message: 'Booking requested successfully',
      booking
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= RESPOND TO BOOKING (Provider) =================
exports.respondBooking = async (req, res) => {
  try {
    const { bookingId, status } = req.body; // status: 'accepted' or 'rejected'
    const providerId = req.user.userId;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Use accepted or rejected' });
    }

    const booking = await Booking.findById(bookingId).populate('rideId').populate('seekerId', 'name');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Verify the provider owns this ride
    if (booking.rideId.providerId.toString() !== providerId) {
      return res.status(403).json({ message: 'Not authorized to respond to this booking' });
    }

    // If rejecting, restore the seat — only if not already rejected
    if (status === 'rejected' && booking.status === 'pending') {
      const ride = await Ride.findById(booking.rideId._id);
      if (ride) {
        ride.seatsAvailable += booking.seats || 1;
        await ride.save();
      }
    }

    booking.status = status;
    await booking.save();

    // ================= SEEKER NOTIFICATION: Booking Response =================
    try {
      const seekerNotification = new Notification({
        userId: booking.seekerId._id,
        userType: 'seeker',
        type: status === 'accepted' ? 'BOOKING_CONFIRMED' : 'BOOKING_CANCELLED',
        title: status === 'accepted' ? '✅ Booking Accepted!' : '❌ Booking Declined',
        body: status === 'accepted' 
          ? `Your booking for ${booking.rideId.pickup?.name || 'pickup'} to ${booking.rideId.drop?.name || 'drop'} has been accepted by ${req.user.name || 'the provider'}.`
          : `Your booking request was declined. ${booking.rideId.seatsAvailable > 0 ? 'Seats are still available - try booking again.' : 'No seats available.'}`,
        data: {
          bookingId: booking._id,
          rideId: booking.rideId._id,
          status: status,
          pickup: booking.rideId.pickup,
          drop: booking.rideId.drop
        },
        priority: status === 'accepted' ? 'high' : 'normal',
        channels: ['in_app', 'socket']
      });
      await seekerNotification.save();

      // Real-time notification to seeker
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${booking.seekerId._id}`).emit('booking-response', {
          notification: seekerNotification.toObject(),
          booking: {
            _id: booking._id,
            status: status,
            ride: {
              _id: booking.rideId._id,
              pickup: booking.rideId.pickup,
              drop: booking.rideId.drop
            }
          }
        });
      }
    } catch (notifError) {
      console.error('Seeker notification error:', notifError);
    }

    res.json({
      message: `Booking ${status}`,
      booking
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET MY BOOKINGS (Seeker) =================
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ seekerId: req.user.userId })
      .populate({
        path: 'rideId',
        select: 'pickup drop date time costPerSeat status vehicleType college womenOnly',
        populate: {
          path: 'providerId',
          select: 'name phone usn gender kycDocuments rating',
        }
      })
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET RIDE REQUESTS (Provider) =================
exports.getRideRequests = async (req, res) => {
  try {
    const providerId = req.user.userId;

    // Get all rides by this provider
    const rides = await Ride.find({ providerId });
    const rideIds = rides.map(r => r._id);

    // Get all accepted+pending bookings for these rides
    const bookings = await Booking.find({ 
      rideId: { $in: rideIds },
      status: { $in: ['pending', 'accepted'] }
    })
    .populate('rideId', 'pickup drop date time vehicleType college')
    .populate('seekerId', 'name phone rating usn gender college')
    .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET BOOKINGS FOR SPECIFIC RIDE =================
exports.getBookingsForRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const providerId = req.user.userId;

    // Verify provider owns this ride
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }
    if (ride.providerId.toString() !== providerId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const bookings = await Booking.find({ rideId })
      .populate('seekerId', 'name phone rating college usn gender')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};