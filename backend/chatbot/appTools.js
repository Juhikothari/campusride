// backend/chatbot/appTools.js
// Authenticated, user-scoped read-only HOGO app queries for chatbot personalization.
// Security guarantees:
// - Strictly uses verified req.user.userId from auth middleware (never client-supplied userId).
// - Never exposes email, USN, Aadhaar, raw KYC file paths/URLs, passwords, or session seeds.
// - Strictly read-only (AI cannot approve KYC, modify bookings, or cancel rides).

const mongoose = require('mongoose');
const User = require('../users/users.model');
const Ride = require('../rides/rides.model');
const Booking = require('../bookings/bookings.model');

const ACCOUNT_INTENT_PATTERNS = {
  profile: /\b(my\s+profile|my\s+account|my\s+role|my\s+college|who\s+am\s+i|my\s+rating|my\s+warnings?|am\s+i\s+suspended)\b/i,
  kyc: /\b(my\s+kyc|kyc\s+status|is\s+my\s+kyc|my\s+verification|my\s+vehicle|my\s+car|my\s+bike|vehicle\s+status|approved\s+yet|rejected\s+why)\b/i,
  bookings: /\b(my\s+booking|my\s+bookings|my\s+request|booking\s+status|did\s+he\s+accept|did\s+they\s+accept|pickup\s+code)\b/i,
  activeRide: /\b(my\s+active\s+ride|my\s+current\s+ride|my\s+posted\s+ride|my\s+ongoing\s+ride|am\s+i\s+in\s+a\s+ride|current\s+trip)\b/i,
  history: /\b(my\s+history|my\s+ride\s+history|my\s+past\s+rides?|my\s+completed\s+rides?|how\s+many\s+rides?\s+(?:have\s+i|did\s+i))\b/i,
};

function sanitizeShortAddr(loc) {
  if (!loc) return 'Unknown location';
  if (typeof loc === 'string') return loc.split(',')[0].trim();
  return (loc.address || '').split(',')[0].trim() || 'Pinned location';
}

async function getMyProfile(verifiedUserId) {
  const u = await User.findById(verifiedUserId).select(
    'name role college kycStatus averageRating totalRatings warningsCount suspended suspendedUntil blocked'
  ).lean();
  if (!u) return null;
  return {
    firstName: String(u.name || '').split(' ')[0] || 'Student',
    role: u.role,
    college: u.college || 'Not set',
    kycStatus: u.kycStatus || 'not_submitted',
    averageRating: Number(u.averageRating || 0),
    totalRatings: Number(u.totalRatings || 0),
    warningsCount: Number(u.warningsCount || 0),
    suspended: Boolean(u.suspended),
    blocked: Boolean(u.blocked),
  };
}

async function getMyKYCStatus(verifiedUserId) {
  const u = await User.findById(verifiedUserId).select(
    'kycStatus kycRemarks kycRejectionReason kycDocuments vehicles'
  ).lean();
  if (!u) return null;

  const docs = u.kycDocuments || {};
  const vehicles = Array.isArray(u.vehicles) && u.vehicles.length > 0
    ? u.vehicles.map((v) => ({
        vehicleNumber: v.vehicleNumber,
        vehicleName: v.vehicleName || 'Vehicle',
        vehicleType: v.vehicleType || 'car',
        status: v.status || 'pending',
      }))
    : (docs.vehicleNumber
      ? [{
          vehicleNumber: docs.vehicleNumber,
          vehicleName: docs.vehicleName || 'Vehicle',
          vehicleType: docs.vehicleType || 'car',
          status: docs.vehicleStatus || 'pending',
        }]
      : []);

  return {
    kycStatus: u.kycStatus || 'not_submitted',
    remarks: u.kycRejectionReason || u.kycRemarks || null,
    documentsOnFile: {
      collegeIdCard: Boolean(docs.collegeIdCard),
      selfie: Boolean(docs.selfie),
      drivingLicense: Boolean(docs.drivingLicense),
    },
    vehicles,
  };
}

async function getMyBookings(verifiedUserId, limit = 5) {
  const list = await Booking.find({ seekerId: verifiedUserId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('rideId', 'pickup drop date time status costPerSeat')
    .lean();

  return list.map((b) => ({
    bookingId: String(b._id),
    status: b.status,
    seatsBooked: b.seatsBooked || b.seats || 1,
    fare: b.fare || b.cost || null,
    pickup: sanitizeShortAddr(b.rideId?.pickup),
    drop: sanitizeShortAddr(b.rideId?.drop),
    date: b.rideId?.date || null,
    time: b.rideId?.time || null,
    rideStatus: b.rideId?.status || null,
  }));
}

async function getMyActiveRide(verifiedUserId) {
  const [offeredRide, activeBooking] = await Promise.all([
    Ride.findOne({ providerId: verifiedUserId, status: { $in: ['active', 'in-progress'] } })
      .sort({ createdAt: -1 })
      .select('pickup drop date time status seatsAvailable costPerSeat womenOnly')
      .lean(),
    Booking.findOne({ seekerId: verifiedUserId, status: { $in: ['pending', 'accepted'] } })
      .sort({ createdAt: -1 })
      .populate('rideId', 'pickup drop date time status costPerSeat')
      .lean(),
  ]);

  const activeBookedRide = activeBooking && ['active', 'in-progress'].includes(activeBooking.rideId?.status)
    ? {
        bookingStatus: activeBooking.status,
        seats: activeBooking.seatsBooked || activeBooking.seats || 1,
        pickup: sanitizeShortAddr(activeBooking.rideId.pickup),
        drop: sanitizeShortAddr(activeBooking.rideId.drop),
        date: activeBooking.rideId.date,
        time: activeBooking.rideId.time,
        rideStatus: activeBooking.rideId.status,
      }
    : null;

  return {
    activeOfferedRide: offeredRide
      ? {
          rideId: String(offeredRide._id),
          status: offeredRide.status,
          pickup: sanitizeShortAddr(offeredRide.pickup),
          drop: sanitizeShortAddr(offeredRide.drop),
          date: offeredRide.date,
          time: offeredRide.time,
          seatsAvailable: offeredRide.seatsAvailable,
          costPerSeat: offeredRide.costPerSeat,
          womenOnly: Boolean(offeredRide.womenOnly),
        }
      : null,
    activeBookedRide,
  };
}

async function getMyRideHistory(verifiedUserId, limit = 5) {
  const [offeredPast, seekerBookings] = await Promise.all([
    Ride.find({ providerId: verifiedUserId, status: { $in: ['completed', 'cancelled'] } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('pickup drop date time status')
      .lean(),
    Booking.find({ seekerId: verifiedUserId })
      .sort({ createdAt: -1 })
      .limit(limit * 3)
      .populate('rideId', 'pickup drop date time status')
      .lean(),
  ]);

  const bookedPast = seekerBookings
    .filter((b) =>
      b.status === 'cancelled' ||
      b.status === 'rejected' ||
      b.rideId?.status === 'completed' ||
      b.rideId?.status === 'cancelled'
    )
    .slice(0, limit);

  return {
    offeredHistory: offeredPast.map((r) => ({
      role: 'provider',
      status: r.status,
      pickup: sanitizeShortAddr(r.pickup),
      drop: sanitizeShortAddr(r.drop),
      date: r.date,
      time: r.time,
    })),
    bookedHistory: bookedPast.map((b) => ({
      role: 'seeker',
      bookingStatus: b.status,
      rideStatus: b.rideId?.status || null,
      pickup: sanitizeShortAddr(b.rideId?.pickup),
      drop: sanitizeShortAddr(b.rideId?.drop),
      date: b.rideId?.date || null,
      time: b.rideId?.time || null,
    })),
  };
}

async function getRideDetails(verifiedUserId, rideId, userRole = 'seeker') {
  if (!rideId || !mongoose.Types.ObjectId.isValid(String(rideId))) {
    return { error: 'INVALID_RIDE_ID' };
  }
  const ride = await Ride.findById(rideId)
    .select('providerId pickup drop date time status seatsAvailable costPerSeat womenOnly college')
    .lean();
  if (!ride) return null;

  const isProvider = String(ride.providerId) === String(verifiedUserId);
  const isAdmin = userRole === 'admin';
  const isParticipant = isProvider || isAdmin || Boolean(
    await Booking.exists({
      rideId,
      seekerId: verifiedUserId,
      status: { $in: ['pending', 'accepted', 'completed'] },
    })
  );

  if (!isParticipant) {
    return { error: 'FORBIDDEN' };
  }

  return {
    rideId: String(ride._id),
    status: ride.status,
    pickup: sanitizeShortAddr(ride.pickup),
    drop: sanitizeShortAddr(ride.drop),
    date: ride.date,
    time: ride.time,
    seatsAvailable: ride.seatsAvailable,
    costPerSeat: ride.costPerSeat,
    womenOnly: Boolean(ride.womenOnly),
    college: ride.college,
  };
}

/**
 * Inspects message (and recent turn) for account-specific intent and executes
 * strictly authorized read-only queries for req.user.userId only.
 */
async function fetchAuthorizedLiveContext(verifiedUserId, latestMessage, history = []) {
  const combined = [
    String(latestMessage || ''),
    ...history.slice(-2).filter((m) => m.role === 'user').map((m) => m.content || ''),
  ].join(' ');

  const wantsProfile = ACCOUNT_INTENT_PATTERNS.profile.test(combined);
  const wantsKyc = ACCOUNT_INTENT_PATTERNS.kyc.test(combined);
  const wantsBookings = ACCOUNT_INTENT_PATTERNS.bookings.test(combined);
  const wantsActive = ACCOUNT_INTENT_PATTERNS.activeRide.test(combined);
  const wantsHistory = ACCOUNT_INTENT_PATTERNS.history.test(combined);

  // Also check explicit 24-hex ObjectId if user asks about a specific ride ID they belong to
  const idMatch = String(latestMessage || '').match(/\b([a-f0-9]{24})\b/i);

  if (!wantsProfile && !wantsKyc && !wantsBookings && !wantsActive && !wantsHistory && !idMatch) {
    return { usedTools: [], snapshot: null };
  }

  const usedTools = [];
  const snapshot = {};

  try {
    const tasks = [];
    if (wantsProfile) {
      usedTools.push('getMyProfile');
      tasks.push(getMyProfile(verifiedUserId).then((r) => { snapshot.profile = r; }));
    }
    if (wantsKyc) {
      usedTools.push('getMyKYCStatus');
      tasks.push(getMyKYCStatus(verifiedUserId).then((r) => { snapshot.kyc = r; }));
    }
    if (wantsBookings) {
      usedTools.push('getMyBookings');
      tasks.push(getMyBookings(verifiedUserId).then((r) => { snapshot.recentBookings = r; }));
    }
    if (wantsActive) {
      usedTools.push('getMyActiveRide');
      tasks.push(getMyActiveRide(verifiedUserId).then((r) => { snapshot.activeRide = r; }));
    }
    if (wantsHistory) {
      usedTools.push('getMyRideHistory');
      tasks.push(getMyRideHistory(verifiedUserId).then((r) => { snapshot.rideHistory = r; }));
    }
    if (idMatch) {
      usedTools.push('getRideDetails');
      const u = await User.findById(verifiedUserId).select('role').lean();
      tasks.push(getRideDetails(verifiedUserId, idMatch[1], u?.role).then((r) => { snapshot.requestedRide = r; }));
    }

    await Promise.all(tasks);
    return { usedTools, snapshot };
  } catch (err) {
    console.warn('[Chatbot AppTools] Read error:', err.message);
    return { usedTools, snapshot: null, error: 'LIVE_DATA_UNAVAILABLE' };
  }
}

module.exports = {
  getMyProfile,
  getMyKYCStatus,
  getMyBookings,
  getMyActiveRide,
  getMyRideHistory,
  getRideDetails,
  fetchAuthorizedLiveContext,
};
