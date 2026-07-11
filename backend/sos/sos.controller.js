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
    
    // Get emergency contacts
    const user = await User.findById(userId);
    const emergencyContacts = user.emergencyContacts || [];
    
    // TODO: Send actual notifications
    // - SMS to emergency contacts
    // - Push notification to other ride participants
    // - Alert to admin dashboard
    // - Email to user
    
    // Notify via socket
    const io = req.app.get('io');
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
    
    // Broadcast to admin channel
    io.emit('adminSOSAlert', {
      sosId: sos._id,
      rideId,
      userId,
      type: sos.type,
      timestamp: sos.createdAt
    });
    
    res.status(201).json({
      message: 'SOS triggered successfully',
      sos,
      emergencyContactsNotified: emergencyContacts.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Acknowledge SOS (admin or provider)
exports.acknowledgeSOS = async (req, res) => {
  try {
    const { sosId } = req.params;
    const userId = req.user.userId;
    
    const sos = await SOS.findById(sosId);
    if (!sos) return res.status(404).json({ message: 'SOS not found' });
    
    if (sos.status !== 'active') {
      return res.status(400).json({ message: 'SOS is not active' });
    }
    
    sos.status = 'acknowledged';
    sos.acknowledgedBy = userId;
    sos.acknowledgedAt = new Date();
    await sos.save();
    
    // Notify ride participants
    const io = req.app.get('io');
    io.to(`ride-${sos.rideId}`).emit('sosAcknowledged', {
      sosId: sos._id,
      acknowledgedBy: userId,
      timestamp: sos.acknowledgedAt
    });
    
    res.json({ message: 'SOS acknowledged', sos });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Resolve SOS
exports.resolveSOS = async (req, res) => {
  try {
    const { sosId } = req.params;
    const { resolutionNotes, isFalseAlarm } = req.body;
    
    const sos = await SOS.findById(sosId);
    if (!sos) return res.status(404).json({ message: 'SOS not found' });
    
    sos.status = isFalseAlarm ? 'false_alarm' : 'resolved';
    sos.resolvedAt = new Date();
    sos.resolutionNotes = resolutionNotes;
    await sos.save();
    
    // Notify ride participants
    const io = req.app.get('io');
    io.to(`ride-${sos.rideId}`).emit('sosResolved', {
      sosId: sos._id,
      status: sos.status,
      timestamp: sos.resolvedAt
    });
    
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
    const isAdmin = user.role === 'admin';
    
    if (!isAdmin) {
      const ride = await Ride.findById(sos.rideId);
      const isProvider = ride.providerId.toString() === req.user.userId;
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

// Get active SOS for a ride
exports.getActiveSOSForRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    
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