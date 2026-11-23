const { notifyAdmins } = require('../notifications/notifications.helper');
const SOS = require('./sos.model');
const Ride = require('../rides/rides.model');
const User = require('../users/users.model');
const Booking = require('../bookings/bookings.model');

// Trigger SOS
exports.triggerSOS = async (req, res) => {
  try {
    const { rideId, type, description, location } = req.body;
    
    const userId = req.user.userId;
    
    // Verify user is part of this ride
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    
    // Check if user is provider or accepted seeker
    const isProvider = ride.providerId.toString() === userId;
    let isSeeker = false;
    
    if (!isProvider) {
      const booking = await Booking.findOne({
        rideId,
        seekerId: userId,
        status: 'accepted'
      });
      isSeeker = !!booking;
    }
    
    if (!isProvider && !isSeeker) {
      return res.status(403).json({ message: 'Not authorized for this ride' });
    }
    
    // Check if active SOS already exists
    const existingSOS = await SOS.findOne({ rideId, status: 'active' });
    if (existingSOS) {
      return res.status(400).json({ 
        message: 'Active SOS already exists for this ride',
        sosId: existingSOS._id
      });
    }
    
    // Create SOS record
    const sos = new SOS({
      rideId,
      triggeredBy: {
        userId,
        role: isProvider ? 'provider' : 'seeker'
      },
      location: location || { lat: 0, lng: 0 },
      type: type || 'other',
      description,
      status: 'active'
    });
    
    await sos.save();
    
    // Get emergency contact
    const user = await User.findById(userId);
    const emergencyContact = user?.emergencyContact || '';
    const emergencyContacts = emergencyContact ? [emergencyContact] : (user?.emergencyContacts || []);
    
    // Send actual notifications to other ride participants
    try {
      const { sendPushToUser } = require('../notifications/push.helper');
      if (isProvider) {
        // Provider triggered: alert all accepted passengers
        const bookings = await Booking.find({ rideId, status: 'accepted' });
        for (const b of bookings) {
          sendPushToUser(b.seekerId, {
            title: '🚨 EMERGENCY ALERT ON YOUR RIDE',
            body: `Emergency SOS triggered by ride provider. Please remain safe.`,
            data: { type: 'sos_alert', rideId, sosId: sos._id }
          }).catch(() => {});
          sos.notificationsSent.push({ type: 'push', recipient: String(b.seekerId), status: 'sent' });
        }
      } else {
        // Seeker triggered: alert the ride provider
        sendPushToUser(ride.providerId, {
          title: '🚨 PASSENGER EMERGENCY SOS TRIGGERED',
          body: `Emergency SOS triggered by your passenger. Immediate assistance required.`,
          data: { type: 'sos_alert', rideId, sosId: sos._id }
        }).catch(() => {});
        sos.notificationsSent.push({ type: 'push', recipient: String(ride.providerId), status: 'sent' });
      }

      if (emergencyContact) {
        sos.emergencyContacts.push({
          phone: emergencyContact,
          notifiedAt: new Date()
        });
        // Note: No backend SMS gateway (e.g. Twilio/SNS/Fast2SMS) is configured.
        // SMS alert is delegated to the mobile client's native SMS application via sms: intent.
        sos.notificationsSent.push({
          type: 'sms',
          recipient: emergencyContact,
          status: 'client_delegated',
          notes: 'Delegated to mobile client native SMS composer (sms: URI)'
        });
      }
      await sos.save();
    } catch (notifErr) {
      console.warn('SOS participant notification dispatch warning:', notifErr.message);
    }
    
    // Notify via socket to this ride room only
    const io = req.app.get('io');
    if (io) {
      io.to(`ride-${rideId}`).emit('sosTriggered', {
        sosId: sos._id,
        rideId,
        triggeredBy: {
          userId,
          role: isProvider ? 'provider' : 'seeker',
          name: user.name
        },
        location: sos.location,
        type: sos.type,
        timestamp: sos.createdAt
      });
      
      // Targeted emit to verified administrators ONLY (never broadcast to all sockets)
      io.to('admin').to('admins').emit('adminSOSAlert', {
        sosId: sos._id,
        rideId,
        userId,
        type: sos.type,
        timestamp: sos.createdAt
      });
    }

    notifyAdmins({
      title: '🚨 CRITICAL: EMERGENCY SOS ALERT TRIGGERED!',
      message: `Emergency SOS triggered by ${user.name || 'User'} on ride #${rideId}! Immediate assistance required!`,
      type: 'emergency_sos',
      data: {
        sosId: sos._id,
        rideId,
        userId,
        location: sos.location,
      },
      priority: 'critical',
    }).catch(e => console.log('Admin SOS notif error:', e));
    
    res.status(201).json({
      message: 'SOS triggered successfully',
      sos,
      emergencyContact,
      emergencyContactsNotified: emergencyContacts.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Acknowledge SOS (admin or provider only)
exports.acknowledgeSOS = async (req, res) => {
  try {
    const { sosId } = req.params;
    const userId = req.user.userId;
    
    const sos = await SOS.findById(sosId);
    if (!sos) return res.status(404).json({ message: 'SOS alert not found' });
    
    if (sos.status !== 'active') {
      return res.status(400).json({ message: 'SOS is not active' });
    }

    const [user, ride] = await Promise.all([
      User.findById(userId).select('role blocked suspended'),
      Ride.findById(sos.rideId).select('providerId')
    ]);

    if (!user || user.blocked || user.suspended) {
      return res.status(403).json({ message: 'Account is restricted' });
    }

    const isAdmin = user.role === 'admin';
    const isProvider = ride && ride.providerId.toString() === userId.toString();

    if (!isAdmin && !isProvider) {
      return res.status(403).json({ message: 'Access denied: Only administrators or the ride provider can acknowledge this alert.' });
    }
    
    sos.status = 'acknowledged';
    sos.acknowledgedBy = userId;
    sos.acknowledgedAt = new Date();
    await sos.save();
    
    // Notify ride participants
    const io = req.app.get('io');
    if (io) {
      io.to(`ride-${sos.rideId}`).emit('sosAcknowledged', {
        sosId: sos._id,
        acknowledgedBy: userId,
        timestamp: sos.acknowledgedAt
      });
    }
    
    res.json({ message: 'SOS acknowledged', sos });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Resolve SOS (admin, provider, or caller who triggered)
exports.resolveSOS = async (req, res) => {
  try {
    const { sosId } = req.params;
    const { resolutionNotes, isFalseAlarm } = req.body;
    const userId = req.user.userId;
    
    const sos = await SOS.findById(sosId);
    if (!sos) return res.status(404).json({ message: 'SOS alert not found' });

    const [user, ride] = await Promise.all([
      User.findById(userId).select('role blocked suspended'),
      Ride.findById(sos.rideId).select('providerId')
    ]);

    if (!user || user.blocked || user.suspended) {
      return res.status(403).json({ message: 'Account is restricted' });
    }

    const isAdmin = user.role === 'admin';
    const isProvider = ride && ride.providerId.toString() === userId.toString();
    const isTriggerer = sos.triggeredBy?.userId?.toString() === userId.toString();

    if (!isAdmin && !isProvider && !isTriggerer) {
      return res.status(403).json({ message: 'Access denied: Only authorized administrators, the provider, or the triggerer can resolve this alert.' });
    }
    
    sos.status = isFalseAlarm ? 'false_alarm' : 'resolved';
    sos.resolvedAt = new Date();
    sos.resolutionNotes = resolutionNotes;
    await sos.save();
    
    // Notify ride participants
    const io = req.app.get('io');
    if (io) {
      io.to(`ride-${sos.rideId}`).emit('sosResolved', {
        sosId: sos._id,
        status: sos.status,
        timestamp: sos.resolvedAt
      });
    }
    
    res.json({ message: 'SOS resolved', sos });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get SOS details
exports.getSOS = async (req, res) => {
  try {
    const { sosId } = req.params;
    
    const sos = await SOS.findById(sosId)
      .populate('triggeredBy.userId', 'name phone')
      .populate('acknowledgedBy', 'name')
      .populate('rideId');
    
    if (!sos) return res.status(404).json({ message: 'SOS not found' });
    
    // Verify user is part of the ride or admin
    const user = await User.findById(req.user.userId);
    const isAdmin = user?.role === 'admin';
    
    if (!isAdmin) {
      const ride = await Ride.findById(sos.rideId);
      const isProvider = ride && ride.providerId.toString() === req.user.userId;
      const isSeeker = await Booking.exists({
        rideId: sos.rideId,
        seekerId: req.user.userId,
        status: 'accepted'
      });
      
      if (!isProvider && !isSeeker) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }
    
    res.json(sos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get active SOS for a ride (participants or admin only)
exports.getActiveSOSForRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.userId;

    const user = await User.findById(userId).select('role');
    const isAdmin = user?.role === 'admin';

    if (!isAdmin) {
      const ride = await Ride.findById(rideId).select('providerId');
      const isProvider = ride && ride.providerId.toString() === userId.toString();
      const isSeeker = await Booking.exists({
        rideId,
        seekerId: userId,
        status: { $in: ['accepted', 'completed'] }
      });

      if (!isProvider && !isSeeker) {
        return res.status(403).json({ message: 'Access denied: You are not a participant of this ride.' });
      }
    }
    
    const sos = await SOS.findOne({ 
      rideId, 
      status: { $in: ['active', 'acknowledged'] }
    }).populate('triggeredBy.userId', 'name phone');
    
    res.json({ hasActiveSOS: !!sos, sos });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all SOS alerts (admin only)
exports.getAllSOS = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    
    const sosList = await SOS.find(query)
      .populate('triggeredBy.userId', 'name phone')
      .populate('rideId', 'pickup drop date')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await SOS.countDocuments(query);
    
    res.json({
      sosList,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update user's emergency contacts
exports.updateEmergencyContacts = async (req, res) => {
  try {
    const { emergencyContacts } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { emergencyContacts },
      { new: true }
    ).select('-password');
    
    res.json({ message: 'Emergency contacts updated', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};