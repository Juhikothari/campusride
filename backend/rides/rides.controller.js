// backend/rides/rides.controller.js - CORRECTED
const Ride = require('./rides.model');
const Booking = require('../bookings/bookings.model');
const User = require('../users/users.model');
const Notification = require('../notifications/notifications.model');

// ================= CREATE RIDE =================
exports.createRide = async (req, res) => {
  try {
    const { pickup, drop, date, time, seatsAvailable, costPerSeat } = req.body;

    // Validate coordinates
    if (!Array.isArray(pickup?.coordinates) || pickup.coordinates.length !== 2 ||
        !Array.isArray(drop?.coordinates)   || drop.coordinates.length !== 2) {
      return res.status(400).json({ message: 'Valid pickup and drop coordinates are required' });
    }

    // Validate seats
    if (!seatsAvailable || seatsAvailable < 1 || seatsAvailable > 6) {
      return res.status(400).json({ message: 'Seats must be between 1 and 6' });
    }

    const userId = req.user?.userId || req.user?.id;
    const user = await User.findById(userId);

    if (!user || (user.role !== 'provider' && user.role !== 'both')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (user.kycStatus !== 'approved') {
      return res.status(403).json({ message: 'KYC not approved' });
    }

    //const pickupAddress = pickup?.address || pickup?.label || 'Unknown Location';
    //const dropAddress = drop?.address || drop?.label || 'Unknown Location';
    const extractAddress = (location, fallback = 'Location') => {

  if (!location) return fallback;

  // Full address first
  if (
    typeof location.address === 'string' &&
    location.address.trim() &&
    location.address !== 'Unknown Location'
  ) {
    return location.address.trim();
  }

  // Display name next
  if (
    typeof location.display_name === 'string' &&
    location.display_name.trim() &&
    location.display_name !== 'Unknown Location'
  ) {
    return location.display_name.trim();
  }

  // Label next
  if (
    typeof location.label === 'string' &&
    location.label.trim() &&
    location.label !== 'Unknown Location'
  ) {
    return location.label.trim();
  }

  // Geoapify formatted fallback
  if (
    typeof location.formatted === 'string' &&
    location.formatted.trim()
  ) {
    return location.formatted.trim();
  }

  return fallback;
};

const pickupAddress =
  extractAddress(pickup, 'Pickup Location');

const dropAddress =
  extractAddress(drop, 'Drop Location');

    // Women-only ride: only female accounts can set this
    const womenOnly = req.body.womenOnly === true && user.gender === 'female';

    const ride = new Ride({
      providerId: userId,

      pickup: {
        type: 'Point',
        coordinates: Array.isArray(pickup?.coordinates) ? pickup.coordinates : [],
        address: pickupAddress
      },
      drop: {
        type: 'Point',
        coordinates: Array.isArray(drop?.coordinates) ? drop.coordinates : [],
        address: dropAddress
      },

      date,
      time,
      seatsAvailable,
      costPerSeat,
      womenOnly,
      college: user.college || '',
    });

    await ride.save();
    const Alert = require('../alerts/alerts.model');

const alerts = await Alert.find({ isActive: true });

for (const alert of alerts) {
  try {
    const pickupDistance = calculateDistance(
      ride.pickup.coordinates[1],
      ride.pickup.coordinates[0],
      alert.pickup.coordinates[1],
      alert.pickup.coordinates[0]
    );

    if (pickupDistance > alert.pickupRadius) continue;

    const dropDistance = calculateDistance(
      ride.drop.coordinates[1],
      ride.drop.coordinates[0],
      alert.drop.coordinates[1],
      alert.drop.coordinates[0]
    );

    if (dropDistance > alert.dropRadius) continue;

    await Notification.create({
      userId: alert.userId,
      type: 'alert_match',
      title: '🚗 New Ride Available!',
      message: `New ride from ${ride.pickup.address} → ${ride.drop.address}`,
      data: { rideId: ride._id }
    });

  } catch (err) {
    console.error('Alert match error:', err);
  }
}

    res.status(201).json({
      message: 'Ride created successfully',
      ride,
    });
  } catch (error) {
    console.error('Create ride error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ================= SEARCH RIDES =================
exports.searchRides = async (req, res) => {
  try {
    const { lat, lng, maxDistance = 5000, date, dropLat, dropLng } = req.query;
    
    console.log('Search params:', { lat, lng, maxDistance, date, dropLat, dropLng });

    // Build base query - only active rides with available seats
    const query = { 
      status: 'active',
      seatsAvailable: { $gt: 0 }
    };

    // College filter — only show rides from same college as the seeker
    const seekerId = req.user?.userId || req.user?.id;
    const seeker = await User.findById(seekerId).select('college');
    if (seeker?.college) {
      query.college = { $regex: new RegExp(`^${seeker.college.trim()}$`, 'i') };
    }

    // Women-only filter: if requested, only show women-only rides
    if (req.query.womenOnly === 'true') {
      query.womenOnly = true;
    }

    // Add specific date filter if provided
    if (date) {
      const searchDate = new Date(date);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      
      query.date = {
        $gte: searchDate,
        $lt: nextDay
      };
      console.log('Date filter:', searchDate, 'to', nextDay);
    } else {
      // No date provided ("Ride Now") - show rides from start of today and future
      // Rides past their scheduled time are filtered in JS below (date+time combined check)
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      query.date = { $gte: startOfToday };
      console.log('Ride Now - showing rides from start of today:', startOfToday);
    }

    // Helper: check if a ride's scheduled date+time is still in the future
    // The `time` field is stored as "HH:MM" string; `date` is stored as midnight UTC
    const now = new Date();
    const isRideUpcoming = (ride) => {
      if (!ride.time) return true; // no time set, don't filter out
      const [hours, minutes] = ride.time.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return true;

      // Reconstruct the ride's full scheduled datetime using the date's
      // year/month/day in local time, combined with the stored HH:MM time
      const rideDate = new Date(ride.date);
      const scheduled = new Date(
        rideDate.getFullYear(),
        rideDate.getMonth(),
        rideDate.getDate(),
        hours,
        minutes,
        0,
        0
      );
      return scheduled > now;
    };

    // If coordinates provided, use geo-proximity search
    let rides = [];
    
    if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      const distanceInMeters = parseInt(maxDistance) || 5000;
      
      console.log('Geo search:', { latitude, longitude, distanceInMeters });

      rides = await Ride.find({
        ...query,
        pickup: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude] // [lng, lat] for MongoDB
            },
            $maxDistance: distanceInMeters
          }
        }
      }).populate('providerId', 'name rating gender');
      
      console.log(`Found ${rides.length} rides within ${distanceInMeters}m (before time filter)`);

      // Filter out rides whose scheduled time has already passed
      rides = rides.filter(isRideUpcoming);
      console.log(`Found ${rides.length} rides after past-time filter`);

      // If drop location provided, also filter by drop distance
      if (dropLat && dropLng && !isNaN(parseFloat(dropLat)) && !isNaN(parseFloat(dropLng))) {
        const dropLatitude = parseFloat(dropLat);
        const dropLongitude = parseFloat(dropLng);
        
        rides = rides.filter(ride => {
          if (!ride.drop?.coordinates || ride.drop.coordinates.length !== 2) return false;
          
          const R = 6371e3;
          const φ1 = dropLatitude * Math.PI / 180;
          const φ2 = ride.drop.coordinates[1] * Math.PI / 180;
          const Δφ = (ride.drop.coordinates[1] - dropLatitude) * Math.PI / 180;
          const Δλ = (ride.drop.coordinates[0] - dropLongitude) * Math.PI / 180;
          
          const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                    Math.cos(φ1) * Math.cos(φ2) *
                    Math.sin(Δλ/2) * Math.sin(Δλ/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;
          
          return distance <= distanceInMeters;
        });
        
        console.log(`After drop filter: ${rides.length} rides`);
      }
    } else {
      // No coordinates - return all rides matching date filter
      rides = await Ride.find(query)
        .populate('providerId', 'name rating gender')
        .sort({ date: 1, time: 1 });

      // Filter out rides whose scheduled time has already passed
      rides = rides.filter(isRideUpcoming);
      console.log(`Found ${rides.length} rides (no geo filter, after time filter)`);
    }

    res.json(rides);
  } catch (error) {
    console.error('Search rides error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ================= GET SINGLE RIDE =================
exports.getRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id).populate(
      'providerId',
      'name phone rating gender'
    );

    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    res.json(ride);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= UPDATE RIDE =================
exports.updateRide = async (req, res) => {
  try {
    const ride = await Ride.findOneAndUpdate(
      { _id: req.params.id, providerId: req.user.userId },
      req.body,
      { new: true }
    );

    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    res.json(ride);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= DELETE RIDE =================
exports.deleteRide = async (req, res) => {
  try {
    const ride = await Ride.findOneAndDelete({
      _id: req.params.id,
      providerId: req.user.userId
    });

    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    res.json({ message: 'Ride deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET MY RIDES =================
exports.getMyRides = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const rides = await Ride.find({ providerId: userId }).sort({ createdAt: -1 });
    res.json(rides);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= SUBMIT CHECKLIST =================
exports.submitChecklist = async (req, res) => {
  try {
    const ride = await Ride.findOne({
      _id: req.params.rideId,
      providerId: req.user.userId
    });

    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    ride.preRideChecklist = { ...req.body, completedAt: new Date() };
    await ride.save();

    res.json({ message: 'Checklist saved', ride });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= PICKUP PASSENGER =================
exports.pickupPassenger = async (req, res) => {
  try {
    const ride = await Ride.findOne({
      _id: req.params.rideId,
      providerId: req.user.userId
    });

    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    // FIXED: Check if pre-ride checklist is completed
    const preRide = ride.preRideChecklist || {};
    const allChecksDone = preRide.vehicleInspected && 
                          preRide.emergencyKitReady && 
                          preRide.routeConfirmed && 
                          preRide.contactsNotified;
    
    if (!allChecksDone) {
      return res.status(400).json({ 
        message: 'Pre-ride checklist not completed. Please complete all safety checks first.' 
      });
    }

    ride.status = 'in-progress';
    ride.passengerPickedUpAt = new Date();
    await ride.save();

    // Get accepted bookings to notify passengers
    const acceptedBookings = await Booking.find({ 
      rideId: ride._id, 
      status: 'accepted' 
    }).populate('seekerId', 'name fcmToken');

    // Send notifications to all accepted passengers
    for (const booking of acceptedBookings) {
      try {
        const passengerNotification = new Notification({
          userId: booking.seekerId._id,
          userType: 'seeker',
          type: 'PASSENGER_PICKED_UP',
          title: '🚗 Ride Has Started — Pickup Confirmed',
          body: `Your provider has picked you up! Travelling from ${ride.pickup?.name || 'pickup'} to ${ride.drop?.name || 'drop'}.`,
          data: {
            rideId: ride._id,
            bookingId: booking._id,
            pickup: ride.pickup,
            drop: ride.drop,
            date: ride.date,
            time: ride.time,
            pickedUpAt: ride.passengerPickedUpAt
          }
        });

        await passengerNotification.save();

        // Send push notification if FCM token available
        if (booking.seekerId.fcmToken) {
          // TODO: Implement FCM push notification
          console.log(`Would send push notification to ${booking.seekerId.name}`);
        }
      } catch (notifErr) {
        console.error('Failed to create passenger notification:', notifErr);
      }
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`ride-${ride._id}`).emit('passengerPickedUp', {
        rideId: ride._id,
        status: 'in-progress',
        pickedUpAt: ride.passengerPickedUpAt
      });
    }

    res.json({ message: 'Passenger picked up', ride });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= DROP PASSENGER =================
exports.dropPassenger = async (req, res) => {
  try {
    const ride = await Ride.findOne({
      _id: req.params.rideId,
      providerId: req.user.userId
    });

    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    // Only allow drop if ride is in-progress
    if (ride.status !== 'in-progress') {
      return res.status(400).json({ message: 'Ride is not in progress' });
    }

    ride.status = 'completed';
    ride.passengerDroppedAt = new Date();
    ride.completedAt = new Date();
    await ride.save();

    // Get accepted bookings to notify passengers
    const acceptedBookings = await Booking.find({ 
      rideId: ride._id, 
      status: 'accepted' 
    }).populate('seekerId', 'name fcmToken');

    // Send notifications to all accepted passengers
    for (const booking of acceptedBookings) {
      try {
        const passengerNotification = new Notification({
          userId: booking.seekerId._id,
          userType: 'seeker',
          type: 'PASSENGER_DROPPED',
          title: '📍 You Have Been Dropped Off',
          body: `Successfully reached ${ride.drop?.name || 'destination'} from ${ride.pickup?.name || 'pickup'} on ${new Date(ride.date).toLocaleDateString('en-IN')}.`,
          data: {
            rideId: ride._id,
            bookingId: booking._id,
            pickup: ride.pickup,
            drop: ride.drop,
            date: ride.date,
            time: ride.time,
            droppedAt: ride.passengerDroppedAt,
            completedAt: ride.completedAt
          }
        });

        await passengerNotification.save();

        // Send push notification if FCM token available
        if (booking.seekerId.fcmToken) {
          // TODO: Implement FCM push notification
          console.log(`Would send drop notification to ${booking.seekerId.name}`);
        }
      } catch (notifErr) {
        console.error('Failed to create drop notification:', notifErr);
      }
    }

    // Update provider stats
    const user = await User.findById(req.user.userId);
    if (user) {
      user.totalRides = (user.totalRides || 0) + 1;
      await user.save();
    }

    res.json({ message: 'Passenger dropped', ride });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= START RIDE =================
exports.startRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const ride = await Ride.findOne({ _id: rideId, providerId: req.user.userId });

    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    
    if (ride.status !== 'active') {
      return res.status(400).json({ message: 'Ride cannot be started' });
    }

    // FIXED: Check if pre-ride checklist is completed
    const preRide = ride.preRideChecklist || {};
    const allChecksDone = preRide.vehicleInspected && 
                          preRide.emergencyKitReady && 
                          preRide.routeConfirmed && 
                          preRide.contactsNotified;
    
    if (!allChecksDone) {
      return res.status(400).json({ 
        message: 'Pre-ride checklist not completed. Please complete all safety checks first.' 
      });
    }

    ride.status = 'in-progress';
    ride.startedAt = new Date();
    await ride.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`ride-${rideId}`).emit('rideStarted', {
        rideId,
        status: 'in-progress',
        startedAt: ride.startedAt
      });
    }

    res.json({ message: 'Ride started successfully', ride });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 

// ================= COMPLETE RIDE =================
exports.completeRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const ride = await Ride.findOne({ _id: rideId, providerId: req.user.userId });

    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (ride.status !== 'in-progress') {
      return res.status(400).json({ message: 'Ride is not in progress' });
    }

    ride.status = 'completed';
    ride.completedAt = new Date();
    await ride.save();

    const user = await User.findById(req.user.userId);
    if (user) {
      user.totalRides = (user.totalRides || 0) + 1;
      await user.save();
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`ride-${rideId}`).emit('rideCompleted', {
        rideId,
        status: 'completed',
        completedAt: ride.completedAt
      });
    }

    res.json({ message: 'Ride completed', ride });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= CANCEL RIDE =================
exports.cancelRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { reason } = req.body;

    const ride = await Ride.findOne({ _id: rideId, providerId: req.user.userId });
    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    if (ride.status === 'completed' || ride.status === 'cancelled') {
      return res.status(400).json({ message: 'Ride already finished' });
    }

    ride.status = 'cancelled';
    ride.cancelledAt = new Date();
    ride.cancelReason = reason;
    await ride.save();

    // Cancel all pending/accepted bookings
    const Booking = require('../bookings/bookings.model');
    await Booking.updateMany(
      { rideId: ride._id, status: { $in: ['pending', 'accepted'] } },
      { status: 'cancelled' }
    );

    // FIXED: Emit socket event to notify all connected clients
    const io = req.app.get('io');
    if (io) {
      io.to(`ride-${rideId}`).emit('rideCancelled', { 
        rideId, 
        status: 'cancelled', 
        reason,
        cancelledAt: ride.cancelledAt,
        cancelledBy: 'provider'
      });
      
      console.log(`Emitted rideCancelled event to ride-${rideId}`);
    }

    res.json({ message: 'Ride cancelled', ride });
  } catch (error) {
    console.error('Cancel ride error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ================= GET RIDE STATUS =================
exports.getRideStatus = async (req, res) => {
  try {
    const { rideId } = req.params;
    const ride = await Ride.findById(rideId).populate('providerId', 'name phone rating');

    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    const Booking = require('../bookings/bookings.model');
    const bookings = await Booking.find({ rideId }).populate('seekerId', 'name phone rating');

    res.json({
      ride,
      participants: {
        provider: ride.providerId,
        seekers: bookings.filter(b => b.status === 'accepted').map(b => b.seekerId)
      },
      bookings: bookings.map(b => ({
        id: b._id,
        status: b.status,
        seeker: b.seekerId,
        createdAt: b.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= NO MATCH SUGGEST =================
exports.noMatchSuggest = async (req, res) => {
  try {
    // FIXED: Return properly formatted suggestions with unique rides only
    const { lat, lng } = req.query;
    
    let rides = [];
    
    if (lat && lng) {
      // Find rides near the seeker's location (even if not exact match)
      rides = await Ride.find({ 
        status: 'active',
        seatsAvailable: { $gt: 0 },
        pickup: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)]
            },
            $maxDistance: 50000 // 50km - wider search for suggestions
          }
        }
      })
      .populate('providerId', 'name rating gender')
      .limit(3);
    } else {
      // Fallback: return any active rides
      rides = await Ride.find({ status: 'active', seatsAvailable: { $gt: 0 } })
        .populate('providerId', 'name rating gender')
        .limit(3)
        .sort({ createdAt: -1 });
    }
    
    // Remove duplicates by pickup+drop+date combination
    const uniqueRides = rides.filter((ride, index, self) => 
      index === self.findIndex(r => 
        r.pickup?.address === ride.pickup?.address &&
        r.drop?.address === ride.drop?.address &&
        r.date?.toISOString() === ride.date?.toISOString()
      )
    );

    res.json(uniqueRides); // Return array directly, not wrapped in object
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET RECURRING INSTANCES =================
exports.getRecurringInstances = async (req, res) => {
  try {
    const { rideId } = req.params;

    const rides = await Ride.find({
      $or: [
        { parentRideId: rideId },
        { recurringGroupId: rideId }
      ]
    }).sort({ date: 1 });

    res.json(rides);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= FIND NEARBY/RELATED RIDES (for suggestions) =================
exports.findNearbyRides = async (req, res) => {
  try {
    const { 
      lat, 
      lng, 
      originalDistance = 5000, 
      date,
      expandDistance = true,
      expandDate = true 
    } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude required' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const originalDate = date ? new Date(date) : null;

    const results = {
      exactMatches: [],
      expandedDistance: [],
      expandedDate: [],
      message: ''
    };

    // 1. Find exact matches (original criteria)
    const exactQuery = {
      status: 'active',
      seatsAvailable: { $gt: 0 }
    };

    if (originalDate) {
      const nextDay = new Date(originalDate);
      nextDay.setDate(nextDay.getDate() + 1);
      exactQuery.date = { $gte: originalDate, $lt: nextDay };
    }

    results.exactMatches = await Ride.find({
      ...exactQuery,
      pickup: {
        $near: {
          $geometry: { type: 'Point', coordinates: [longitude, latitude] },
          $maxDistance: parseInt(originalDistance)
        }
      }
    }).populate('providerId', 'name rating gender');

    // 2. If few/no exact matches, expand distance (up to 25km)
    if (results.exactMatches.length < 3 && expandDistance === 'true') {
      const expandedQuery = { ...exactQuery };
      
      // Remove date filter if expanding date too
      if (expandDate !== 'true' && originalDate) {
        const nextDay = new Date(originalDate);
        nextDay.setDate(nextDay.getDate() + 1);
        expandedQuery.date = { $gte: originalDate, $lt: nextDay };
      }

      const expandedRides = await Ride.find({
        ...expandedQuery,
        pickup: {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            $maxDistance: 25000 // 25km expanded search
          }
        }
      }).populate('providerId', 'name rating gender');

      // Filter out exact matches to avoid duplicates
      const exactIds = results.exactMatches.map(r => r._id.toString());
      results.expandedDistance = expandedRides.filter(r => 
        !exactIds.includes(r._id.toString()) &&
        r.pickup.coordinates // Ensure coordinates exist
      ).slice(0, 5); // Limit to 5 suggestions

      // Calculate actual distance for each
      results.expandedDistance = results.expandedDistance.map(ride => {
        const dist = calculateDistance(
          latitude, longitude,
          ride.pickup.coordinates[1], ride.pickup.coordinates[0]
        );
        return { ...ride.toObject(), actualDistance: Math.round(dist / 100) / 10 }; // km with 1 decimal
      });
    }

    // 3. If still few, expand date range (±2 days)
    if ((results.exactMatches.length + results.expandedDistance.length) < 3 && expandDate === 'true' && originalDate) {
      const startDate = new Date(originalDate);
      startDate.setDate(startDate.getDate() - 2);
      const endDate = new Date(originalDate);
      endDate.setDate(endDate.getDate() + 3); // +3 to include day after

      const dateExpandedQuery = {
        status: 'active',
        seatsAvailable: { $gt: 0 },
        date: { $gte: startDate, $lt: endDate }
      };

      const dateRides = await Ride.find({
        ...dateExpandedQuery,
        pickup: {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            $maxDistance: parseInt(originalDistance) // Keep original distance for date expansion
          }
        }
      }).populate('providerId', 'name rating gender');

      // Filter out duplicates
      const existingIds = [
        ...results.exactMatches.map(r => r._id.toString()),
        ...results.expandedDistance.map(r => r._id.toString())
      ];
      
      results.expandedDate = dateRides.filter(r => 
        !existingIds.includes(r._id.toString())
      ).slice(0, 5).map(ride => ({
        ...ride.toObject(),
        daysFromTarget: Math.round((new Date(ride.date) - originalDate) / (1000 * 60 * 60 * 24))
      }));
    }

    // Generate helpful message
    const totalFound = results.exactMatches.length + results.expandedDistance.length + results.expandedDate.length;
    
    if (totalFound === 0) {
      results.message = 'No rides found nearby. Try increasing your search radius or selecting a different date.';
    } else if (results.exactMatches.length > 0) {
      results.message = `Found ${results.exactMatches.length} exact matches.`;
    } else if (results.expandedDistance.length > 0 || results.expandedDate.length > 0) {
      results.message = `No exact matches, but found ${totalFound} nearby options.`;
    }

    res.json(results);
  } catch (error) {
    console.error('Find nearby rides error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Helper: Calculate distance between two points
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};