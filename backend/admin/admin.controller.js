// backend/admin/admin.controller.js - CORRECTED
const User = require('../users/users.model');
const Ride = require('../rides/rides.model');
const Booking = require('../bookings/bookings.model');
const Incident = require('../incidents/incidents.model');

// ── Guard: only admin role ────────────────────────────────────────
function requireAdmin(req, res) {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  return true;
}

// ── GET /api/admin/stats ──────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalProviders,
      totalSeekers,
      totalRides,
      activeRides,
      completedRides,
      totalBookings,
      pendingKYC,
      openIncidents,
      highIncidents,
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      User.countDocuments({ role: { $in: ['provider', 'both'] } }),
      User.countDocuments({ role: { $in: ['seeker', 'both'] } }),
      Ride.countDocuments(),
      Ride.countDocuments({ status: 'active' }),
      Ride.countDocuments({ status: 'completed' }),
      Booking.countDocuments(),
      User.countDocuments({ kycStatus: 'pending' }),
      Incident.countDocuments({ status: 'open' }),
      Incident.countDocuments({ severity: { $in: ['high', 'critical'] }, status: { $ne: 'resolved' } }),
    ]);

    res.json({
      totalUsers,
      totalProviders,
      totalSeekers,
      totalRides,
      activeRides,
      completedRides,
      totalBookings,
      pendingKYC,
      openIncidents,
      highIncidents,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/admin/users ──────────────────────────────────────────
exports.getUsers = async (req, res) => {
  try {
    const { search, role, kyc } = req.query;

    const filter = { role: { $ne: 'admin' } };
    if (role === 'provider') {
      filter.role = { $in: ['provider', 'both'] };
    } else if (role) {
      filter.role = role;
    }
    if (kyc) filter.kycStatus = kyc;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('-password')  // This excludes password but includes kycDocuments
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/admin/users/:id/suspend ─────────────────────────────
exports.suspendUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ message: 'Cannot suspend admin' });

    user.suspended = !user.suspended;
    await user.save();

    res.json({ message: user.suspended ? 'User suspended' : 'User reactivated', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/admin/rides ──────────────────────────────────────────
exports.getAllRides = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const rides = await Ride.find(filter)
      .populate('providerId', 'name email college')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Ride.countDocuments(filter);

    res.json({ rides, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE /api/admin/rides/:id ───────────────────────────────────
exports.deleteRide = async (req, res) => {
  try {
    const ride = await Ride.findByIdAndDelete(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    await Booking.updateMany({ rideId: req.params.id }, { status: 'rejected' });
    res.json({ message: 'Ride deleted and bookings cancelled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/admin/kyc ────────────────────────────────────────────
exports.getPendingKYC = async (req, res) => {
  try {
    const users = await User.find({ kycStatus: 'pending' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/admin/kyc/:userId ────────────────────────────────────
exports.reviewKYC = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { kycStatus: status },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: `KYC ${status}`, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/admin/incidents ──────────────────────────────────────
exports.getAllIncidents = async (req, res) => {
  try {
    const incidents = await Incident.find()
      .populate('reportedBy', 'name email')
      .populate('rideId', 'date time pickup drop')
      .sort({ createdAt: -1 });
    res.json(incidents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/admin/incidents/:id/status ──────────────────────────
exports.updateIncidentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const incident = await Incident.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!incident) return res.status(404).json({ message: 'Incident not found' });
    res.json({ message: 'Status updated', incident });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── ADMIN SETTINGS (key-value store) ──────────────────────────────
const settingsStore = {}; // in-memory; replace with DB model if needed

exports.getSetting = async (req, res) => {
  try {
    const { key } = req.params;
    res.json({ key, value: settingsStore[key] ?? null });
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
};

exports.setSetting = async (req, res) => {
  try {
    const { key, value } = req.body;
    settingsStore[key] = value;
    res.json({ key, value });
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
};

exports.getAllSettings = async (req, res) => {
  try {
    res.json(settingsStore);
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot delete admin' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted successfully' });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Block a user
exports.blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      {
        blocked: true,
        blockReason: reason || 'Violation of terms',
        blockedAt: new Date(),
        blockedBy: req.user.userId, // Admin who blocked
        suspended: true // Also suspend while blocked
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: `User ${user.name} has been blocked`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        blocked: user.blocked,
        blockReason: user.blockReason,
        blockedAt: user.blockedAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Unblock a user
exports.unblockUser = async (req, res) => {
  try {
    const {id} = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      {
        blocked: false,
        blockReason: '',
        blockedAt: null,
        blockedBy: null,
        suspended: false // Unsuspend when unblocking
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: `User ${user.name} has been unblocked`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        blocked: user.blocked
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all blocked users
exports.getBlockedUsers = async (req, res) => {
  try {
    const blockedUsers = await User.find({ blocked: true })
      .select('name email phone college blocked blockReason blockedAt createdAt')
      .populate('blockedBy', 'name email')
      .sort({ blockedAt: -1 });

    res.json(blockedUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};