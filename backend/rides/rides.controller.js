// backend/rides/rides.controller.js - CORRECTED
const Ride = require('./rides.model');
const Booking = require('../bookings/bookings.model');
const User = require('../users/users.model');
const Notification = require('../notifications/notifications.model');

// ================= 3-HOUR AUTO-CANCEL HELPER =================
const autoCancelStaleRides = async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleRides = await Ride.find({
      status: 'active',
      date: { $lt: oneDayAgo },
      createdAt: { $lt: oneDayAgo }
    });
    for (const sr of staleRides) {
      sr.status = 'cancelled';
      sr.cancelReason = 'Auto-cancelled after 24 hours of inactivity';
      sr.cancelledAt = new Date();
      await sr.save();
      await Booking.updateMany(
        { rideId: sr._id, status: { $in: ['pending', 'accepted'] } },
        { status: 'cancelled', cancelReason: 'Ride auto-cancelled after 24 hours' }
      );
    }
  } catch (e) {
    console.error('Auto-cancel stale rides error:', e.message);
  }
};
exports.autoCancelStaleRides = autoCancelStaleRides;

// ================= CREATE RIDE =================
exports.createRide = async (req, res) => {
  try {
    const { pickup, drop, date, time, seatsAvailable, costPerSeat, vehicleName, vehicleNumber } = req.body;

    // Run auto-cancel on stale rides
    autoCancelStaleRides().catch(() => {});

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
      return res.status(403).json({ message: 'Access denied. Provider role required.' });
    }

    // Require KYC approval to offer rides
    if (user.kycStatus !== 'approved') {
      return res.status(403).json({
        message: 'Your KYC documents must be approved by campus admin before you can offer rides.'
      });
    }

    // ── Prevent simultaneous offering & seeking ──────────────────────
    const activeSeekerBooking = await Booking.findOne({
      seekerId: userId,
      status: { $in: ['pending', 'accepted'] }
    }).populate('rideId');

    if (activeSeekerBooking && activeSeekerBooking.rideId && activeSeekerBooking.rideId.status === 'active') {
      return res.status(400).json({
        message: 'You currently have an active ride request as a seeker. Complete or cancel it before offering a ride.'
      });
    }

    // If user provided vehicle details on the fly, save them to profile
    const effectiveVehicleNum = vehicleNumber ? vehicleNumber.toUpperCase().trim() : (user.kycDocuments?.vehicleNumber || '');
    const effectiveVehicleName = vehicleName ? vehicleName.trim() : (user.kycDocuments?.vehicleName || 'Vehicle');

    if (vehicleNumber || vehicleName) {
      user.kycDocuments = {
        ...(user.kycDocuments || {}),
        vehicleNumber: effectiveVehicleNum,
        vehicleName: effectiveVehicleName,
      };
      if (!user.vehicles) user.vehicles = [];
      const vIdx = user.vehicles.findIndex(v => v.vehicleNumber === effectiveVehicleNum);
      if (vIdx >= 0) {
        user.vehicles[vIdx].vehicleName = effectiveVehicleName;
      } else if (effectiveVehicleNum) {
        user.vehicles.push({
          vehicleNumber: effectiveVehicleNum,
          vehicleName: effectiveVehicleName,
          vehicleType: req.body.vehicleType || 'car',
          isDefault: true,
        });
      }
      await user.save();
    }

    // Check if the vehicle is currently under admin review
    const matchingVeh = (user.vehicles || []).find(v => v.vehicleNumber === effectiveVehicleNum);
    const isVehPending = (matchingVeh && (matchingVeh.status === 'pending' || matchingVeh.status === 'in_review')) ||
                         (!matchingVeh && user.kycDocuments?.vehicleStatus === 'pending');
    if (isVehPending) {
      return res.status(400).json({
        message: 'This vehicle is currently under admin verification (within 24 hrs). You cannot offer rides with this vehicle until verified.'
      });
    }

    const extractAddress = (location, fallback = 'Campus Area') => {
      if (!location) return fallback;
      const clean = (str) => {
        if (!str || typeof str !== 'string') return '';
        const trimmed = str.trim();
        // Ignore raw coordinate strings
        if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(trimmed)) return '';
        if (trimmed === 'Unknown Location') return '';
        return trimmed;
      };

      return clean(location.address) ||
             clean(location.display_name) ||
             clean(location.label) ||
             clean(location.formatted) ||
             fallback;
    };

    const pickupAddress = extractAddress(pickup, 'Pickup Spot');
    const dropAddress   = extractAddress(drop, 'Drop-off Spot');

    // Women-only ride: only female accounts can set this
    const womenOnly = req.body.womenOnly === true && user.gender === 'female';

    const now = new Date();
    const effectiveDate = date ? new Date(date) : now;
    const effectiveTime = time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const userCollege = user.college || req.body.college || '';
    const normalizedCollege = userCollege ? require('../config/collegeDomains').normalizeCollege(userCollege) : '';

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
      date: effectiveDate,
      time: effectiveTime,
      seatsAvailable,
      costPerSeat,
      womenOnly,
      vehicleType: req.body.vehicleType || 'car',
      vehicleName: effectiveVehicleName || 'Car',
      college: normalizedCollege,
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

// Helper: Haversine distance in meters
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return Infinity;
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Helper: Distance from a point to a route segment (in meters)
const distanceToSegment = (pLat, pLng, r1Lat, r1Lng, r2Lat, r2Lng) => {
  if (pLat === undefined || pLng === undefined || r1Lat === undefined || r1Lng === undefined || r2Lat === undefined || r2Lng === undefined) {
    return Infinity;
  }
  const d1 = calculateDistance(pLat, pLng, r1Lat, r1Lng);
  const d2 = calculateDistance(pLat, pLng, r2Lat, r2Lng);
  const lineLenSq = (r2Lat - r1Lat) ** 2 + (r2Lng - r1Lng) ** 2;
  if (lineLenSq === 0) return d1;
  const t = ((pLat - r1Lat) * (r2Lat - r1Lat) + (pLng - r1Lng) * (r2Lng - r1Lng)) / lineLenSq;
  if (t <= 0) return d1;
  if (t >= 1) return d2;
  const projLat = r1Lat + t * (r2Lat - r1Lat);
  const projLng = r1Lng + t * (r2Lng - r1Lng);
  return calculateDistance(pLat, pLng, projLat, projLng);
};

// Helper: Smart coordinate extractor handling both [lng, lat] GeoJSON and [lat, lng] array/object formats
const extractCoords = (loc) => {
  if (!loc) return null;
  if (loc.lat !== undefined && loc.lng !== undefined) {
    let lat = parseFloat(loc.lat);
    let lng = parseFloat(loc.lng);
    if (isNaN(lat) || isNaN(lng)) return null;
    if (lat > 50 && lng < 40) [lat, lng] = [lng, lat];
    return { lat, lng };
  }
  if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
    const c0 = parseFloat(loc.coordinates[0]);
    const c1 = parseFloat(loc.coordinates[1]);
    if (isNaN(c0) || isNaN(c1)) return null;
    // In India: Longitude is > 50 (e.g. 77.59), Latitude is < 40 (e.g. 12.97)
    if (c0 > 50 && c1 < 40) return { lat: c1, lng: c0 };
    if (c1 > 50 && c0 < 40) return { lat: c0, lng: c1 };
    return { lat: c1, lng: c0 };
  }
  return null;
};

// ================= SEARCH RIDES =================
exports.searchRides = async (req, res) => {
  try {
    const { lat, lng, maxDistance = 5000, date, time, dropLat, dropLng, vehicleType, pickupText, dropText } = req.query;
    
    // If no search parameters are provided, return empty array (do NOT show all offered rides before search)
    if (!lat && !lng && !dropLat && !dropLng && !pickupText && !dropText) {
      return res.json([]);
    }

    const distanceInMeters = Math.max(parseInt(maxDistance) || 5000, 5000); // 5km radius limit

    // Build base query — only active rides with available seats
    const query = { 
      status: 'active',
      seatsAvailable: { $gt: 0 }
    };

    // Vehicle type filter if provided
    if (vehicleType) {
      const vt = vehicleType.toLowerCase();
      if (vt === 'bike' || vt === 'motorcycle' || vt === 'scooter') {
        query.vehicleType = { $in: ['bike', 'motorcycle', 'scooter', 'two-wheeler'] };
      } else if (vt === 'car') {
        query.vehicleType = { $in: ['car', 'sedan', 'hatchback'] };
      } else if (vt === 'suv' || vt === 'xuv') {
        query.vehicleType = { $in: ['suv', 'xuv'] };
      } else {
        query.vehicleType = vt;
      }
    }

    const seekerId = req.user?.userId || req.user?.id;
    const seeker = await User.findById(seekerId).select('college gender');

    // Women-only safety logic:
    // 1. Hide women-only rides from male accounts
    if (seeker?.gender === 'male') {
      query.womenOnly = { $ne: true };
    }

    // 2. If women-only is requested by a female seeker:
    // Show only rides where the provider is female OR the ride is tagged women-only
    let femaleProviderIds = [];
    if (req.query.womenOnly === 'true') {
      const femaleUsers = await User.find({ gender: 'female' }).select('_id');
      femaleProviderIds = femaleUsers.map(u => u._id);
      query.$or = [
        { womenOnly: true },
        { providerId: { $in: femaleProviderIds } }
      ];
    }

    // Add specific date filter ONLY if provided
    if (date) {
      const searchDate = new Date(date);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      
      query.date = {
        $gte: searchDate,
        $lt: nextDay
      };
    }

    // Helper: Parse time string "HH:MM" or "HH:MM AM/PM" to minutes from midnight
    const parseTimeToMinutes = (tStr) => {
      if (!tStr) return null;
      const clean = tStr.trim().toUpperCase();
      const match = clean.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?/);
      if (!match) return null;
      let hours = parseInt(match[1], 10);
      const mins = parseInt(match[2], 10);
      const meridiem = match[3];
      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
      return hours * 60 + mins;
    };

    const searchTimeMins = time ? parseTimeToMinutes(time) : null;

    // Helper: check if a ride's scheduled date+time is still relevant
    const now = new Date();
    const isRideUpcoming = (ride) => {
      if (!ride.date) return true;
      try {
        const rideDate = new Date(ride.date);
        const withinFuture = (rideDate.getTime() + 48 * 60 * 60 * 1000) > now.getTime();
        if (!withinFuture) return false;

        // If user searched for a specific scheduled time, match within +/- 60 minutes
        if (searchTimeMins !== null && ride.time) {
          const rideMins = parseTimeToMinutes(ride.time);
          if (rideMins !== null) {
            const diff = Math.abs(rideMins - searchTimeMins);
            // Allow +/- 60 mins window
            if (diff > 60 && diff < (1440 - 60)) {
              return false;
            }
          }
        }
        return true;
      } catch {
        return true;
      }
    };

    // Retrieve active candidate rides
    const candidateRides = await Ride.find(query)
      .populate('providerId', 'name rating gender college')
      .sort({ createdAt: -1 });

    const upcomingRides = candidateRides.filter(isRideUpcoming);

    const sPick = (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng)))
      ? extractCoords({ lat: parseFloat(lat), lng: parseFloat(lng) })
      : null;
    const sDrop = (dropLat && dropLng && !isNaN(parseFloat(dropLat)) && !isNaN(parseFloat(dropLng)))
      ? extractCoords({ lat: parseFloat(dropLat), lng: parseFloat(dropLng) })
      : null;

    // Filter strictly to rides along the seeker's route and within 5km (5000m)
    let matchedRides = upcomingRides.filter(ride => {
      const rPick = extractCoords(ride.pickup);
      const rDrop = extractCoords(ride.drop);

      let geoMatched = false;
      let textMatched = false;

      // 1. Coordinate-based route & proximity match
      if (rPick && rDrop && (sPick || sDrop)) {
        let pMatch = true;
        let dMatch = true;

        if (sPick) {
          const directPickupDist = calculateDistance(sPick.lat, sPick.lng, rPick.lat, rPick.lng);
          const routePickupDist = distanceToSegment(sPick.lat, sPick.lng, rPick.lat, rPick.lng, rDrop.lat, rDrop.lng);
          pMatch = directPickupDist <= distanceInMeters || routePickupDist <= distanceInMeters;
        }

        if (sDrop) {
          const directDropDist = calculateDistance(sDrop.lat, sDrop.lng, rDrop.lat, rDrop.lng);
          const routeDropDist = distanceToSegment(sDrop.lat, sDrop.lng, rPick.lat, rPick.lng, rDrop.lat, rDrop.lng);
          dMatch = directDropDist <= distanceInMeters || routeDropDist <= distanceInMeters;
        }

        if (pMatch && dMatch) geoMatched = true;
      }

      // 2. Text-based route match (if user typed names or landmarks without exact GPS)
      if (pickupText || dropText) {
        const stopWords = new Set(['road', 'street', 'cross', 'main', 'near', 'opp', 'opposite', 'behind', 'stage', 'layout', 'city', 'state', 'india', 'bangalore', 'bengaluru', 'the', 'and', 'for', 'with', 'at', 'in', 'to', 'from']);
        let pTextMatch = !pickupText?.trim();
        let dTextMatch = !dropText?.trim();

        if (pickupText && pickupText.trim() && ride.pickup?.address) {
          const pWords = pickupText.trim().toLowerCase().split(/[\s,]+/).filter(w => w.length > 2 && !stopWords.has(w));
          const rPickAddr = ride.pickup.address.toLowerCase();
          if (pWords.length === 0 || pWords.some(w => rPickAddr.includes(w))) {
            pTextMatch = true;
          }
        }

        if (dropText && dropText.trim() && ride.drop?.address) {
          const dWords = dropText.trim().toLowerCase().split(/[\s,]+/).filter(w => w.length > 2 && !stopWords.has(w));
          const rDropAddr = ride.drop.address.toLowerCase();
          if (dWords.length === 0 || dWords.some(w => rDropAddr.includes(w))) {
            dTextMatch = true;
          }
        }

        if (pTextMatch && dTextMatch) textMatched = true;
      }

      // 3. Campus college match fallback:
      let collegeMatched = false;
      if (ride.college && seeker?.college) {
        const normSeeker = require('../config/collegeDomains').normalizeCollege(seeker.college);
        if (ride.college === normSeeker) {
          const pWords = (pickupText || '').toLowerCase();
          const dWords = (dropText || '').toLowerCase();
          const cName = (seeker.college || '').toLowerCase();
          if (pWords.includes('campus') || pWords.includes('college') || (normSeeker && pWords.includes(normSeeker)) || (cName && pWords.includes(cName)) ||
              dWords.includes('campus') || dWords.includes('college') || (normSeeker && dWords.includes(normSeeker)) || (cName && dWords.includes(cName))) {
            collegeMatched = true;
          }
        }
      }

      return geoMatched || textMatched || collegeMatched;
    });

    // Privacy safeguard: Ensure provider's phone and USN are NEVER exposed in search results
    const sanitized = matchedRides.map(r => {
      const rObj = r.toObject ? r.toObject() : { ...r };
      if (rObj.providerId && typeof rObj.providerId === 'object') {
        rObj.providerId.phone = null;
        rObj.providerId.usn = null;
      }
      // Mask vehicle plate number in search (seeker only sees vehicle name & vehicle type)
      rObj.vehicleNumber = null;
      return rObj;
    });

    res.json(sanitized);
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
      'name phone usn rating gender college kycDocuments'
    );

    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    const currentUserId = String(req.user?.userId || req.user?.id || '');
    const isOwner = String(ride.providerId?._id || ride.providerId) === currentUserId;

    // Check if user has an accepted booking
    const Booking = require('../bookings/bookings.model');
    const acceptedBooking = await Booking.findOne({
      rideId: ride._id,
      seekerId: currentUserId,
      status: 'accepted'
    });

    const rideObj = ride.toObject();

    // Privacy Protection: Only reveal phone, USN, and vehicle plate number after booking is accepted
    if (!isOwner && !acceptedBooking) {
      if (rideObj.providerId && typeof rideObj.providerId === 'object') {
        rideObj.providerId.phone = null;
        rideObj.providerId.usn = null;
      }
      rideObj.vehicleNumber = null;
    }

    // Attach passenger/seeker details for provider view
    if (isOwner) {
      const acceptedBookings = await Booking.find({
        rideId: ride._id,
        status: { $in: ['accepted', 'pending'] }
      }).populate('seekerId', 'name phone usn college gender');
      rideObj.passengers = acceptedBookings.map(b => ({
        bookingId: b._id,
        status: b.status,
        seats: b.seats || 1,
        seeker: b.seekerId,
      }));
    }

    res.json(rideObj);
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
    const { rideId } = req.params;
    const currentUserId = req.user?.userId || req.user?.id;
    const ride = await Ride.findById(rideId);

    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    const isProvider = ride.providerId?.toString() === currentUserId?.toString();
    const booking = await Booking.findOne({
      rideId,
      seekerId: currentUserId,
      status: 'accepted'
    });

    if (!isProvider && !booking) {
      return res.status(403).json({ message: 'You are not an active participant of this ride.' });
    }

    if (isProvider) {
      ride.providerChecklistCompleted = true;
      ride.providerChecklistCompletedAt = new Date();
      ride.preRideChecklist = { ...req.body, completedAt: new Date() };
    } else {
      ride.seekerChecklistCompleted = true;
      ride.seekerChecklistCompletedAt = new Date();
      if (booking) {
        booking.checklistCompleted = true;
        booking.checklistCompletedAt = new Date();
        await booking.save();
      }
    }
    await ride.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`ride-${rideId}`).emit('checklistCompleted', {
        rideId,
        seekerChecklistCompleted: ride.seekerChecklistCompleted,
        providerChecklistCompleted: ride.providerChecklistCompleted
      });
    }

    res.json({
      message: 'Safety checklist verified successfully',
      ride,
      seekerChecklistCompleted: ride.seekerChecklistCompleted,
      providerChecklistCompleted: ride.providerChecklistCompleted
    });
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

    // Get accepted bookings to notify passengers
    const acceptedBookings = await Booking.find({ 
      rideId: ride._id, 
      status: 'accepted' 
    }).populate('seekerId', 'name fcmToken');

    if (acceptedBookings.length === 0) {
      return res.status(400).json({ message: 'No accepted booking found. Wait for a passenger to book and accept before picking up.' });
    }

    if (!ride.seekerChecklistCompleted && !acceptedBookings.some(b => b.checklistCompleted)) {
      return res.status(400).json({ message: 'Passenger has not completed their pre-ride safety checklist yet. Ride cannot start until passenger completes checklist.' });
    }

    ride.status = 'in-progress';
    ride.passengerPickedUpAt = new Date();
    await ride.save();

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
    const currentUserId = req.user?.userId || req.user?.id;
    const ride = await Ride.findOne({ _id: rideId, providerId: currentUserId });

    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    
    if (ride.status !== 'active') {
      return res.status(400).json({ message: 'Ride cannot be started. Current status: ' + ride.status });
    }

    // Enforce that matched passenger exists and has completed their safety checklist before driver can start the ride
    const acceptedBookings = await Booking.find({ rideId, status: 'accepted' });
    if (acceptedBookings.length === 0) {
      return res.status(400).json({
        message: 'No accepted booking found. A passenger must book and you must accept before starting the ride.'
      });
    }

    if (!ride.seekerChecklistCompleted && !acceptedBookings.some(b => b.checklistCompleted)) {
      return res.status(400).json({
        message: 'Passenger has not completed their pre-ride safety checklist yet. For campus safety, wait for the passenger to complete the checklist before starting the ride.'
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
      return res.status(400).json({ message: 'Ride cannot be completed before it has been started (ride must be in-progress).' });
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