// backend/admin/admin.controller.js - Complete Multi-Screen Admin Panel Controller
const User = require('../users/users.model');
const Ride = require('../rides/rides.model');
const Booking = require('../bookings/bookings.model');
const Incident = require('../incidents/incidents.model');
const AuditLog = require('./auditLog.model');
const Notification = require('../notifications/notifications.model');

// Helper to send in-app notification & real-time socket event
async function notifyUser(userId, title, message, type = 'admin_alert', data = {}) {
  try {
    const notif = new Notification({
      userId,
      title,
      body: message,
      type,
      data,
    });
    await notif.save();
    if (global.io) {
      global.io.to(`user-${userId}`).emit('notification', notif);
    }
  } catch (err) {
    console.error('Failed to notify user:', err.message);
  }
}

// ── GET /api/admin/stats ──────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeRides,
      pendingKyc,
      blockedUsers,
      totalRides,
      openIncidents,
      ridesAgg,
      signupsAgg,
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      Ride.countDocuments({ status: { $in: ['active', 'in_progress', 'started', 'scheduled'] } }),
      User.countDocuments({
        $or: [
          { kycStatus: 'pending' },
          { 'kycDocuments.vehicleStatus': 'pending' },
          { 'vehicles.status': 'pending' },
        ]
      }),
      User.countDocuments({ $or: [{ blocked: true }, { isBlocked: true }] }),
      Ride.countDocuments(),
      Incident.countDocuments({ status: { $in: ['open', 'investigating', 'reported'] } }),
      // Last 7 days rides aggregation
      Ride.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%m/%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      // Last 7 days signups aggregation
      User.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo }, role: { $ne: 'admin' } } },
        {
          $group: {
            _id: { $dateToString: { format: '%m/%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
    ]);

    // Build guaranteed 7-day chronological points
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      days.push(`${mm}/${dd}`);
    }

    const ridesMap = new Map((ridesAgg || []).map(r => [r._id, r.count]));
    const signupsMap = new Map((signupsAgg || []).map(s => [s._id, s.count]));

    const ridesPerDay = days.map(label => ({
      _id: label,
      label,
      value: ridesMap.get(label) || 0,
      count: ridesMap.get(label) || 0,
    }));

    const signupsPerDay = days.map(label => ({
      _id: label,
      label,
      value: signupsMap.get(label) || 0,
      count: signupsMap.get(label) || 0,
    }));

    res.json({
      totalUsers,
      activeRides,
      pendingKyc,
      pendingKYC: pendingKyc,
      blockedUsers,
      totalRides,
      openIncidents,
      ridesPerDay,
      signupsPerDay,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/admin/kyc ────────────────────────────────────────────
exports.getKYCSubmissions = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};

    if (status === 'approved') {
      query.kycStatus = 'approved';
    } else if (status === 'rejected') {
      query.kycStatus = 'rejected';
    } else if (status === 'all') {
      query = {
        $or: [
          { kycStatus: { $in: ['pending', 'approved', 'rejected'] } },
          { 'kycDocuments.aadhar': { $exists: true, $ne: null } },
        ]
      };
    } else {
      // Default: 'pending'
      query = {
        $or: [
          { kycStatus: 'pending' },
          { 'kycDocuments.vehicleStatus': 'pending' },
          { 'vehicles.status': 'pending' },
          { vehicles: { $elemMatch: { status: 'pending' } } },
          { kycStatus: 'not_submitted', 'kycDocuments.aadhar': { $exists: true, $ne: null } }
        ]
      };
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ updatedAt: -1, createdAt: -1 });

    const submissions = users.map(u => ({
      id: u._id.toString(),
      userId: u._id.toString(),
      name: u.name || 'Student Commuter',
      collegeName: u.college || 'Campus Community',
      phone: u.phone || '',
      aadhaarUrl: u.kycDocuments?.aadhar || '',
      collegeIdUrl: u.kycDocuments?.collegeIdCard || '',
      selfieUrl: u.profilePhoto || u.kycDocuments?.selfie || '',
      drivingLicenseUrl: u.kycDocuments?.drivingLicense || '',
      vehicleNumber: u.kycDocuments?.vehicleNumber || (u.vehicles?.[0]?.vehicleNumber) || '',
      vehicleName: u.kycDocuments?.vehicleName || (u.vehicles?.[0]?.vehicleName) || '',
      vehicleType: u.kycDocuments?.vehicleType || (u.vehicles?.[0]?.vehicleType) || 'car',
      status: u.kycStatus || 'pending',
      submittedAt: u.kycSubmittedAt || u.createdAt || new Date(),
      rejectionReason: u.kycRejectionReason || u.kycRemarks || '',
    }));

    res.json(submissions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/admin/kyc/approve ───────────────────────────────────
exports.approveKYC = async (req, res) => {
  try {
    const userId = req.body.userId || req.params.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.kycStatus = 'approved';
    user.kycVerifiedAt = new Date();
    user.kycRemarks = 'Approved by Campus Administrator';
    user.kycRejectionReason = '';

    if (user.kycDocuments) {
      user.kycDocuments.vehicleStatus = 'approved';
    }
    if (user.vehicles && Array.isArray(user.vehicles)) {
      user.vehicles.forEach(v => { v.status = 'approved'; });
    }

    await user.save();

    await notifyUser(
      userId,
      '🎉 KYC Approved!',
      'Your student identity and vehicle details have been verified and approved. You can now post and offer rides.',
      'kyc_approved'
    );

    await AuditLog.create({
      action: 'APPROVE_KYC',
      adminId: req.user.userId,
      targetId: userId,
      meta: { userName: user.name, college: user.college }
    });

    res.json({ success: true, message: 'KYC Approved successfully', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/admin/kyc/reject ────────────────────────────────────
exports.rejectKYC = async (req, res) => {
  try {
    const userId = req.body.userId || req.params.userId;
    const reason = req.body.reason || req.body.remarks || 'Documents do not match or are unclear';

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.kycStatus = 'rejected';
    user.kycRemarks = reason;
    user.kycRejectionReason = reason;

    if (user.kycDocuments) {
      user.kycDocuments.vehicleStatus = 'rejected';
    }
    if (user.vehicles && Array.isArray(user.vehicles)) {
      user.vehicles.forEach(v => { v.status = 'rejected'; });
    }

    await user.save();

    await notifyUser(
      userId,
      '⚠️ KYC Verification Rejected',
      `Your KYC was rejected: ${reason}. Please update and re-submit your documents.`,
      'kyc_rejected',
      { reason }
    );

    await AuditLog.create({
      action: 'REJECT_KYC',
      adminId: req.user.userId,
      targetId: userId,
      meta: { reason, userName: user.name }
    });

    res.json({ success: true, message: 'KYC Rejected', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/admin/kyc/revoke ────────────────────────────────────
exports.revokeKYC = async (req, res) => {
  try {
    const userId = req.body.userId || req.params.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.kycStatus = 'not_submitted';
    user.kycVerifiedAt = null;
    user.kycRemarks = 'KYC approval was revoked by admin.';

    if (user.kycDocuments) {
      user.kycDocuments.vehicleStatus = 'not_submitted';
    }
    if (user.vehicles && Array.isArray(user.vehicles)) {
      user.vehicles.forEach(v => { v.status = 'pending'; });
    }

    await user.save();

    await notifyUser(
      userId,
      'KYC Revoked',
      'Your KYC approval has been revoked by campus admin. You cannot offer rides until re-verified.',
      'kyc_revoked'
    );

    await AuditLog.create({
      action: 'REVOKE_KYC',
      adminId: req.user.userId,
      targetId: userId,
      meta: { userName: user.name }
    });

    res.json({ success: true, message: 'KYC Revoked', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Legacy reviewKYC adapter
exports.reviewKYC = async (req, res) => {
  const { status, remarks } = req.body;
  if (status === 'approved') return exports.approveKYC(req, res);
  if (status === 'rejected') {
    req.body.reason = remarks;
    return exports.rejectKYC(req, res);
  }
  res.status(400).json({ message: 'Invalid status' });
};

// ── GET /api/admin/users ──────────────────────────────────────────
exports.getUsers = async (req, res) => {
  try {
    const { search, role, page = 1, limit = 20 } = req.query;

    const filter = { role: { $ne: 'admin' } };

    if (role === 'student' || role === 'seeker') {
      filter.role = { $in: ['seeker', 'both'] };
    } else if (role === 'provider') {
      filter.role = { $in: ['provider', 'both'] };
    } else if (role && role !== 'all') {
      filter.role = role;
    }

    if (search) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { college: { $regex: q, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [rawUsers, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(filter)
    ]);

    // Enhance users with ride counts & normalized status flags
    const userIds = rawUsers.map(u => u._id);
    const rideCounts = await Ride.aggregate([
      { $match: { providerId: { $in: userIds } } },
      { $group: { _id: '$providerId', count: { $sum: 1 } } }
    ]);
    const rideCountMap = new Map(rideCounts.map(r => [r._id.toString(), r.count]));

    const users = rawUsers.map(u => ({
      _id: u._id.toString(),
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      phone: u.phone,
      collegeName: u.college || '—',
      college: u.college || '—',
      role: u.role,
      kycStatus: u.kycStatus || 'not_submitted',
      isBlocked: !!(u.blocked || u.isBlocked),
      blocked: !!(u.blocked || u.isBlocked),
      blockReason: u.blockReason || '',
      suspended: !!u.suspended,
      suspendedUntil: u.suspendedUntil || null,
      suspensionReason: u.suspensionReason || '',
      profilePhoto: u.profilePhoto || u.kycDocuments?.selfie || '',
      totalRides: rideCountMap.get(u._id.toString()) || 0,
      createdAt: u.createdAt,
    }));

    res.json({
      users,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/admin/users/suspend ────────────────────────────────
exports.suspendUser = async (req, res) => {
  try {
    const userId = req.body.userId || req.params.id;
    const { suspendUntil, reason = 'Policy violation', hours } = req.body;

    let targetDate = suspendUntil ? new Date(suspendUntil) : null;
    if (!targetDate && hours) {
      targetDate = new Date(Date.now() + Number(hours) * 3600000);
    }
    if (!targetDate) {
      targetDate = new Date(Date.now() + 24 * 3600000); // 24h default
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ message: 'Cannot suspend admin' });

    user.suspended = true;
    user.suspendedUntil = targetDate;
    user.suspensionReason = reason;
    await user.save();

    await notifyUser(
      userId,
      'Account Suspended',
      `Your account has been suspended until ${targetDate.toLocaleDateString('en-IN')}. Reason: ${reason}`,
      'account_suspended',
      { suspendUntil: targetDate, reason }
    );

    await AuditLog.create({
      action: 'SUSPEND_USER',
      adminId: req.user.userId,
      targetId: userId,
      meta: { suspendUntil: targetDate, reason, userName: user.name }
    });

    res.json({ success: true, message: 'User suspended successfully', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/admin/users/block & unblock ────────────────────────
exports.blockUser = async (req, res) => {
  try {
    const userId = req.body.userId || req.params.id;
    const reason = req.body.reason || 'Violation of campus community guidelines';

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ message: 'Cannot block admin' });

    user.blocked = true;
    user.isBlocked = true;
    user.blockReason = reason;
    user.blockedAt = new Date();
    user.blockedBy = req.user.userId;
    user.suspended = true;
    await user.save();

    await notifyUser(
      userId,
      'Account Blocked',
      `Your account has been blocked by administrator. Reason: ${reason}`,
      'account_blocked'
    );

    await AuditLog.create({
      action: 'BLOCK_USER',
      adminId: req.user.userId,
      targetId: userId,
      meta: { reason, userName: user.name }
    });

    res.json({ success: true, message: `User ${user.name} blocked`, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const userId = req.body.userId || req.params.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.blocked = false;
    user.isBlocked = false;
    user.blockReason = '';
    user.blockedAt = null;
    user.blockedBy = null;
    user.suspended = false;
    user.suspendedUntil = null;
    await user.save();

    await notifyUser(
      userId,
      'Account Unblocked',
      'Your account restriction has been lifted. You can now access CampusRide.',
      'account_unblocked'
    );

    await AuditLog.create({
      action: 'UNBLOCK_USER',
      adminId: req.user.userId,
      targetId: userId,
      meta: { userName: user.name }
    });

    res.json({ success: true, message: `User ${user.name} unblocked`, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE /api/admin/users/:userId ──────────────────────────────
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.userId || req.params.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ message: 'Cannot delete admin' });

    await User.findByIdAndDelete(userId);
    await Booking.deleteMany({ $or: [{ seekerId: userId }, { providerId: userId }] });
    await Ride.deleteMany({ providerId: userId });

    await AuditLog.create({
      action: 'DELETE_USER',
      adminId: req.user.userId,
      targetId: userId,
      meta: { userName: user.name, userEmail: user.email }
    });

    res.json({ success: true, message: 'User permanently deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/admin/rides ──────────────────────────────────────────
exports.getAllRides = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [rawRides, total] = await Promise.all([
      Ride.find(filter)
        .populate('providerId', 'name email phone college profilePhoto')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Ride.countDocuments(filter)
    ]);

    const rides = rawRides.map(r => ({
      _id: r._id.toString(),
      id: r._id.toString(),
      fromLocation: r.fromLocation?.address || r.fromLocation?.name || r.pickupLocation || 'Pickup Point',
      toLocation:   r.toLocation?.address   || r.toLocation?.name   || r.dropLocation   || 'Drop Point',
      providerName: r.providerId?.name || 'Commuter',
      providerPhone: r.providerId?.phone || '',
      college: r.college || r.providerId?.college || '',
      departureTime: r.departureTime || r.scheduledTime || r.date || r.createdAt,
      totalSeats: r.seatsAvailable !== undefined ? (Number(r.seatsAvailable) + (r.bookedSeats || 0)) : (r.seats || 3),
      bookedSeats: r.bookedSeats || 0,
      seatsAvailable: r.seatsAvailable,
      status: r.status,
      fare: r.pricePerSeat || r.fare || 0,
      vehicleType: r.vehicleType || 'car',
    }));

    res.json({ rides, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/admin/rides/force-cancel ────────────────────────────
exports.forceCancelRide = async (req, res) => {
  try {
    const rideId = req.body.rideId || req.params.id;
    const reason = req.body.reason || 'Cancelled by admin due to policy violation';

    const ride = await Ride.findByIdAndUpdate(
      rideId,
      {
        status: 'cancelled',
        cancellationReason: reason,
        cancelledBy: 'admin',
      },
      { new: true }
    );

    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    // Cancel all confirmed & pending bookings
    const bookings = await Booking.find({ rideId, status: { $in: ['accepted', 'pending', 'confirmed'] } });
    await Booking.updateMany({ rideId }, { status: 'cancelled' });

    // Notify all affected seekers
    for (const b of bookings) {
      if (b.seekerId) {
        await notifyUser(
          b.seekerId,
          'Ride Cancelled by Admin',
          `Your booked ride was cancelled by administrator: ${reason}`,
          'ride_cancelled',
          { rideId }
        );
      }
    }

    // Notify provider
    if (ride.providerId) {
      await notifyUser(
        ride.providerId,
        'Ride Force-Cancelled',
        `Your ride was cancelled by administrator: ${reason}`,
        'ride_cancelled',
        { rideId }
      );
    }

    if (global.io) {
      global.io.to(`ride-${rideId}`).emit('ride-cancelled', { rideId, reason });
    }

    await AuditLog.create({
      action: 'FORCE_CANCEL_RIDE',
      adminId: req.user.userId,
      targetId: rideId,
      meta: { reason }
    });

    res.json({ success: true, message: 'Ride cancelled and passengers notified' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteRide = exports.forceCancelRide;

// ── GET & PUT Incidents ──────────────────────────────────────────
exports.getAllIncidents = async (req, res) => {
  try {
    const incidents = await Incident.find()
      .populate('reportedBy', 'name email phone college')
      .populate('rideId', 'pickup drop date time status')
      .sort({ createdAt: -1 });
    res.json(incidents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateIncidentStatus = async (req, res) => {
  try {
    const { status, resolutionNotes } = req.body;
    const incident = await Incident.findByIdAndUpdate(
      req.params.id,
      {
        status,
        ...(resolutionNotes ? { resolutionNotes } : {})
      },
      { new: true }
    );
    if (!incident) return res.status(404).json({ message: 'Incident not found' });

    await AuditLog.create({
      action: 'RESOLVE_INCIDENT',
      adminId: req.user.userId,
      targetId: req.params.id,
      meta: { status, resolutionNotes }
    });

    res.json({ success: true, message: 'Incident status updated', incident });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/admin/notifications/broadcast ──────────────────────
exports.broadcastNotification = async (req, res) => {
  try {
    const { title, message, audience = 'all', college } = req.body;
    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    const query = { role: { $ne: 'admin' } };
    if (audience === 'providers') query.role = { $in: ['provider', 'both'] };
    if (audience === 'seekers')   query.role = { $in: ['seeker', 'both'] };
    if (audience === 'college' && college) query.college = { $regex: college, $options: 'i' };

    const targetUsers = await User.find(query).select('_id');

    // Create notifications in batch
    const docs = targetUsers.map(u => ({
      userId: u._id,
      title: title.trim(),
      body: message.trim(),
      type: 'broadcast',
      data: { audience, college },
    }));

    if (docs.length > 0) {
      await Notification.insertMany(docs);
    }

    // Broadcast in real-time via socket
    if (global.io) {
      global.io.emit('broadcast-notification', {
        title: title.trim(),
        message: message.trim(),
        audience,
        college,
        createdAt: new Date().toISOString()
      });
    }

    await AuditLog.create({
      action: 'BROADCAST',
      adminId: req.user.userId,
      meta: { title, message, audience, college, count: targetUsers.length }
    });

    res.json({ success: true, sent: targetUsers.length, message: `Delivered to ${targetUsers.length} commuters` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/admin/audit-logs ─────────────────────────────────────
exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate('adminId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Settings & Export ─────────────────────────────────────────────
const settingsStore = {};
exports.getSetting    = async (req, res) => res.json({ key: req.params.key, value: settingsStore[req.params.key] ?? null });
exports.setSetting    = async (req, res) => { settingsStore[req.body.key] = req.body.value; res.json({ key: req.body.key, value: req.body.value }); };
exports.getAllSettings= async (req, res) => res.json(settingsStore);
exports.getBlockedUsers = async (req, res) => {
  try {
    const users = await User.find({ blocked: true }).select('name email phone college blocked blockReason blockedAt').sort({ blockedAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.exportData = async (req, res) => {
  try {
    const { type } = req.params;
    let data = [];
    if (type === 'users') {
      data = await User.find({ role: { $ne: 'admin' } }).select('name email phone college role kycStatus blocked createdAt');
    } else if (type === 'rides') {
      data = await Ride.find().select('status departureTime pricePerSeat seatsAvailable createdAt').populate('providerId', 'name');
    } else {
      data = await AuditLog.find().sort({ createdAt: -1 }).limit(200);
    }
    res.json({ type, count: data.length, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
