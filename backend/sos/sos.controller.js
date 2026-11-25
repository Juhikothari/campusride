// backend/sos/sos.controller.js - Hardened Emergency SOS Controller with Explicit Status Tracking
const twilio = require('twilio');
const { notifyAdmins } = require('../notifications/notifications.helper');
const { sendPushToUser } = require('../notifications/push.helper');
const { smsService } = require('../services/sms/sms.service');
const SOS = require('./sos.model');
const Ride = require('../rides/rides.model');
const User = require('../users/users.model');
const Booking = require('../bookings/bookings.model');

const ALLOWED_DELIVERY_TRANSITIONS = {
  pending:                new Set(['queued', 'provider_accepted', 'sent', 'delivered', 'failed']),
  queued:                 new Set(['provider_accepted', 'sent', 'delivered', 'failed']),
  provider_accepted:      new Set(['sent', 'delivered', 'failed']),
  sent:                   new Set(['delivered', 'failed']),
  delivered:              new Set([]),
  failed:                 new Set([]),
  client_action_required: new Set([])
};

function normalizePhoneTail(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Resolves the authoritative external Twilio webhook URL from trusted deployment configuration.
 * Never trusts client-spoofable X-Forwarded-Host or X-Forwarded-Proto headers.
 */
function resolveTrustedTwilioWebhookUrl(req) {
  if (process.env.TWILIO_WEBHOOK_URL) {
    return process.env.TWILIO_WEBHOOK_URL.trim();
  }
  const baseUrl = (process.env.WEBHOOK_BASE_URL || process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').trim();
  const pathWithBase = `${req.baseUrl || ''}${req.path || ''}` || '/api/sos/webhook/twilio';
  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, '')}${pathWithBase}`;
  }
  // Local/test environment fallback using direct socket protocol & host header (without forwarded headers)
  const host = req.headers.host || `127.0.0.1:${process.env.PORT || 5000}`;
  const proto = req.socket && req.socket.encrypted ? 'https' : 'http';
  return `${proto}://${host}${pathWithBase}`;
}

// Trigger SOS
exports.triggerSOS = async (req, res) => {
  try {
    const { rideId, type, description, location, idempotencyKey } = req.body;
    const userId = req.user.userId;
    
    // Check idempotency if key provided
    const key = idempotencyKey || req.headers['idempotency-key'];
    if (key) {
      const existingKeySOS = await SOS.findOne({ idempotencyKey: key });
      if (existingKeySOS) {
        return res.status(200).json({
          message: 'SOS alert already processed for this idempotency key',
          sos: existingKeySOS,
          emergencyContactsNotified: existingKeySOS.emergencyContacts.filter(c => c.deliveryStatus === 'delivered').length,
          idempotentReplay: true
        });
      }
    }

    // Verify ride existence
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
    
    // Check if active or acknowledged SOS already exists for this ride
    const existingSOS = await SOS.findOne({ 
      rideId, 
      status: { $in: ['active', 'acknowledged'] } 
    });
    if (existingSOS) {
      return res.status(400).json({ 
        message: 'Active SOS already exists for this ride',
        sosId: existingSOS._id
      });
    }

    const user = await User.findById(userId);
    if (!user || user.blocked || user.suspended) {
      return res.status(403).json({ message: 'Account is restricted from triggering SOS' });
    }
    
    // Create SOS record
    const sos = new SOS({
      rideId,
      idempotencyKey: key || undefined,
      triggeredBy: {
        userId,
        role: isProvider ? 'provider' : 'seeker'
      },
      location: location || { lat: 0, lng: 0 },
      type: type || 'other',
      description,
      status: 'active',
      auditLog: [{
        action: 'triggered',
        performedBy: userId,
        timestamp: new Date(),
        notes: `SOS triggered by ${user.name || 'User'} (${isProvider ? 'provider' : 'seeker'})`
      }]
    });
    
    // Dispatch Push notifications to other ride participants and await results
    try {
      if (isProvider) {
        // Provider triggered: alert all accepted passengers
        const bookings = await Booking.find({ rideId, status: 'accepted' });
        for (const b of bookings) {
          const pushRes = await sendPushToUser(b.seekerId, {
            title: '🚨 EMERGENCY ALERT ON YOUR RIDE',
            body: `Emergency SOS triggered by ride provider. Please remain safe.`,
            data: { type: 'sos_alert', rideId, sosId: String(sos._id) },
            sosId: sos._id,
            notificationType: 'sos_alert'
          });
          sos.notificationsSent.push({
            type: 'push',
            recipient: String(b.seekerId),
            status: pushRes?.status === 'provider_accepted' ? 'provider_accepted' : (pushRes?.status || 'failed'),
            provider: pushRes?.provider || 'EXPO',
            messageId: pushRes?.messageId || null,
            attempts: pushRes?.attempts || 1,
            error: pushRes?.error || null
          });
        }
      } else {
        // Seeker triggered: alert the ride provider
        const pushRes = await sendPushToUser(ride.providerId, {
          title: '🚨 PASSENGER EMERGENCY SOS TRIGGERED',
          body: `Emergency SOS triggered by your passenger. Immediate assistance required.`,
          data: { type: 'sos_alert', rideId, sosId: String(sos._id) },
          sosId: sos._id,
          notificationType: 'sos_alert'
        });
        sos.notificationsSent.push({
          type: 'push',
          recipient: String(ride.providerId),
          status: pushRes?.status === 'provider_accepted' ? 'provider_accepted' : (pushRes?.status || 'failed'),
          provider: pushRes?.provider || 'EXPO',
          messageId: pushRes?.messageId || null,
          attempts: pushRes?.attempts || 1,
          error: pushRes?.error || null
        });
      }
    } catch (pushErr) {
      console.warn('[SOS] Participant push notification warning:', pushErr.message);
    }

    // Process Emergency Contacts Notification
    const rawContacts = Array.isArray(user.emergencyContacts) && user.emergencyContacts.length > 0
      ? user.emergencyContacts
      : (user.emergencyContact ? [{ phone: user.emergencyContact, name: 'Primary Contact', relation: 'Emergency' }] : []);

    let confirmedNotifiedCount = 0;

    for (const contact of rawContacts) {
      if (!contact.phone) continue;

      const emergencyMessage = `[HOGO EMERGENCY] SOS alert from ${user.name || 'User'}. Location: https://maps.google.com/?q=${sos.location.lat},${sos.location.lng}. Ride #${rideId}.`;
      
      const smsRes = await smsService.sendSMS({
        to: contact.phone,
        message: emergencyMessage,
        idempotencyKey: `sos-${sos._id}-${contact.phone}`
      });

      // Record in notificationsSent
      sos.notificationsSent.push({
        type: 'sms',
        recipient: contact.phone,
        status: smsRes.status, // 'provider_accepted', 'delivered', 'failed', or 'client_action_required'
        provider: smsRes.provider,
        messageId: smsRes.messageId || null,
        attempts: smsRes.attempts || 1,
        error: smsRes.error || null,
        notes: smsRes.notes || null
      });

      // Record in emergencyContacts — strictly count confirmed 'delivered' state
      const isConfirmed = smsRes.status === 'delivered';
      if (isConfirmed) confirmedNotifiedCount++;

      sos.emergencyContacts.push({
        name: contact.name || 'Emergency Contact',
        phone: contact.phone,
        relation: contact.relation || 'Emergency',
        deliveryStatus: smsRes.status,
        provider: smsRes.provider,
        messageId: smsRes.messageId || null,
        notifiedAt: isConfirmed ? new Date() : null
      });
    }

    await sos.save();

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
      emergencyContactsNotified: confirmedNotifiedCount,
      emergencyContactsStatus: sos.emergencyContacts.map(c => ({
        name: c.name,
        phone: c.phone,
        deliveryStatus: c.deliveryStatus,
        provider: c.provider,
        notes: c.deliveryStatus === 'client_action_required'
          ? 'Native client SMS composer required on device'
          : c.deliveryStatus
      }))
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
      return res.status(400).json({ message: `Cannot acknowledge SOS: current status is ${sos.status}` });
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
    sos.auditLog.push({
      action: 'acknowledged',
      performedBy: userId,
      timestamp: new Date(),
      notes: `SOS acknowledged by ${user.role === 'admin' ? 'Administrator' : 'Provider'}`
    });
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

    if (!['active', 'acknowledged'].includes(sos.status)) {
      return res.status(400).json({ message: `Cannot resolve SOS: current status is ${sos.status}` });
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
    const isTriggerer = sos.triggeredBy?.userId?.toString() === userId.toString();

    if (!isAdmin && !isProvider && !isTriggerer) {
      return res.status(403).json({ message: 'Access denied: Only authorized administrators, the provider, or the triggerer can resolve this alert.' });
    }
    
    sos.status = isFalseAlarm ? 'false_alarm' : 'resolved';
    sos.resolvedAt = new Date();
    sos.resolutionNotes = resolutionNotes || '';
    sos.auditLog.push({
      action: sos.status,
      performedBy: userId,
      timestamp: new Date(),
      notes: resolutionNotes || `Marked as ${sos.status}`
    });
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

// Cancel SOS (triggerer or admin only)
exports.cancelSOS = async (req, res) => {
  try {
    const { sosId } = req.params;
    const { cancellationReason } = req.body;
    const userId = req.user.userId;

    const sos = await SOS.findById(sosId);
    if (!sos) return res.status(404).json({ message: 'SOS alert not found' });

    if (sos.status !== 'active') {
      return res.status(400).json({ message: `Cannot cancel SOS: current status is ${sos.status}` });
    }

    const user = await User.findById(userId).select('role blocked suspended');
    if (!user || user.blocked || user.suspended) {
      return res.status(403).json({ message: 'Account is restricted' });
    }

    const isAdmin = user.role === 'admin';
    const isTriggerer = sos.triggeredBy?.userId?.toString() === userId.toString();

    if (!isAdmin && !isTriggerer) {
      return res.status(403).json({ message: 'Access denied: Only the user who triggered the SOS or an admin can cancel it.' });
    }

    sos.status = 'cancelled';
    sos.cancelledAt = new Date();
    sos.cancellationReason = cancellationReason || 'Cancelled by user';
    sos.auditLog.push({
      action: 'cancelled',
      performedBy: userId,
      timestamp: new Date(),
      notes: cancellationReason || 'Cancelled by user'
    });
    await sos.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`ride-${sos.rideId}`).emit('sosCancelled', {
        sosId: sos._id,
        cancelledBy: userId,
        timestamp: sos.cancelledAt
      });
    }

    res.json({ message: 'SOS cancelled successfully', sos });
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
        return res.status(403).json({ message: 'Not authorized to view this SOS record' });
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
      { returnDocument: 'after' }
    ).select('-password');
    
    res.json({ message: 'Emergency contacts updated', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Handle Twilio Delivery Status Callbacks / Webhooks with Official Signature Verification
exports.handleTwilioWebhook = async (req, res) => {
  try {
    // 1. Verify Twilio is configured on server (never skip signature checks)
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      return res.status(503).json({
        error: 'Twilio webhook verification is NOT CONFIGURED',
        code: 'TWILIO_NOT_CONFIGURED'
      });
    }

    // 2. Validate X-Twilio-Signature header using official twilio.validateRequest
    const signature = req.get('X-Twilio-Signature');
    if (!signature) {
      return res.status(401).json({
        error: 'Missing X-Twilio-Signature header',
        code: 'MISSING_TWILIO_SIGNATURE'
      });
    }

    const trustedUrl = resolveTrustedTwilioWebhookUrl(req);
    const params = req.body && typeof req.body === 'object' ? req.body : {};
    const isSignatureValid = twilio.validateRequest(authToken, signature, trustedUrl, params);

    if (!isSignatureValid) {
      return res.status(403).json({
        error: 'Invalid Twilio request signature',
        code: 'INVALID_TWILIO_SIGNATURE'
      });
    }

    // 3. Validate AccountSid if configured
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage, AccountSid, To } = params;
    if (process.env.TWILIO_ACCOUNT_SID && AccountSid && AccountSid !== process.env.TWILIO_ACCOUNT_SID) {
      return res.status(403).json({
        error: 'Twilio AccountSid mismatch',
        code: 'ACCOUNT_SID_MISMATCH'
      });
    }

    if (!MessageSid || !MessageStatus) {
      return res.status(400).json({
        error: 'MessageSid and MessageStatus are required',
        code: 'MISSING_CALLBACK_PARAMS'
      });
    }

    // Map Twilio status to internal delivery state
    let normalizedStatus;
    if (MessageStatus === 'delivered') {
      normalizedStatus = 'delivered';
    } else if (['failed', 'undelivered'].includes(MessageStatus)) {
      normalizedStatus = 'failed';
    } else if (MessageStatus === 'sent') {
      normalizedStatus = 'sent';
    } else if (MessageStatus === 'queued') {
      normalizedStatus = 'queued';
    } else {
      normalizedStatus = 'provider_accepted';
    }

    // 4. Verify MessageSid matches an existing SOS notification record
    const sos = await SOS.findOne({
      $or: [
        { 'notificationsSent.messageId': MessageSid },
        { 'emergencyContacts.messageId': MessageSid }
      ]
    });

    if (!sos) {
      return res.status(404).json({
        error: 'Unknown provider message ID',
        code: 'UNKNOWN_NOTIFICATION'
      });
    }

    // 5. Verify notification belongs to TWILIO provider & recipient matches (if 'To' supplied or required)
    const matchedNotif = sos.notificationsSent.find(n => n.messageId === MessageSid);
    const matchedContact = sos.emergencyContacts.find(c => c.messageId === MessageSid);

    if ((matchedNotif && matchedNotif.provider && matchedNotif.provider !== 'TWILIO') ||
        (matchedContact && matchedContact.provider && matchedContact.provider !== 'TWILIO')) {
      return res.status(403).json({
        error: 'Provider mismatch for notification callback',
        code: 'PROVIDER_MISMATCH'
      });
    }

    const expectedRecipient = matchedContact?.phone || matchedNotif?.recipient || '';
    if (To && expectedRecipient) {
      if (normalizePhoneTail(To) !== normalizePhoneTail(expectedRecipient)) {
        if (!sos.auditLog) sos.auditLog = [];
        sos.auditLog.push({
          action: 'webhook_rejected_recipient_mismatch',
          timestamp: new Date(),
          notes: `Rejected Twilio callback for message ${MessageSid}: recipient mismatch`,
          metadata: { MessageSid, MessageStatus }
        });
        await sos.save();
        return res.status(403).json({
          error: 'Callback recipient does not match SOS notification recipient',
          code: 'RECIPIENT_MISMATCH'
        });
      }
    }

    // 6. Strict duplicate / idempotency check
    const callbackKey = `${MessageSid}:${MessageStatus}`;
    if (Array.isArray(sos.processedCallbacks) && sos.processedCallbacks.includes(callbackKey)) {
      return res.status(200).json({
        ok: true,
        idempotent: true,
        status: matchedContact?.deliveryStatus || matchedNotif?.status
      });
    }

    // 7. Enforce state machine transition validity
    const currentStatus = matchedNotif?.status || matchedContact?.deliveryStatus || 'provider_accepted';
    if (currentStatus === normalizedStatus) {
      // Same state reached via different Twilio sub-status -> idempotent accept
      if (!sos.processedCallbacks) sos.processedCallbacks = [];
      sos.processedCallbacks.push(callbackKey);
      await sos.save();
      return res.status(200).json({ ok: true, idempotent: true, status: currentStatus });
    }

    const allowedNext = ALLOWED_DELIVERY_TRANSITIONS[currentStatus];
    if (!allowedNext || !allowedNext.has(normalizedStatus)) {
      if (!sos.auditLog) sos.auditLog = [];
      sos.auditLog.push({
        action: 'webhook_rejected_invalid_transition',
        timestamp: new Date(),
        notes: `Rejected illegal status transition ${currentStatus} -> ${normalizedStatus} for ${MessageSid}`,
        metadata: { MessageSid, currentStatus, attemptedStatus: normalizedStatus }
      });
      await sos.save();
      return res.status(409).json({
        error: `Unauthorized status transition from ${currentStatus} to ${normalizedStatus}`,
        code: 'INVALID_STATUS_TRANSITION'
      });
    }

    // 8. Apply valid state transition atomically
    let updated = false;
    sos.notificationsSent.forEach(n => {
      if (n.messageId === MessageSid) {
        n.status = normalizedStatus;
        if (ErrorCode) n.error = `Twilio Code ${ErrorCode}: ${ErrorMessage || ''}`;
        updated = true;
      }
    });

    sos.emergencyContacts.forEach(c => {
      if (c.messageId === MessageSid) {
        c.deliveryStatus = normalizedStatus;
        if (normalizedStatus === 'delivered' && !c.notifiedAt) {
          c.notifiedAt = new Date();
        }
        updated = true;
      }
    });

    if (updated) {
      if (!sos.processedCallbacks) sos.processedCallbacks = [];
      sos.processedCallbacks.push(callbackKey);
      if (!sos.auditLog) sos.auditLog = [];
      sos.auditLog.push({
        action: 'delivery_callback',
        timestamp: new Date(),
        notes: `Twilio verified callback for ${MessageSid}: ${currentStatus} -> ${normalizedStatus}`,
        metadata: { MessageSid, previousStatus: currentStatus, newStatus: normalizedStatus, MessageStatus, ErrorCode: ErrorCode || null }
      });
      await sos.save();
    }

    res.type('text/xml').status(200).send('<Response></Response>');
  } catch (err) {
    console.error('[SOS Twilio Webhook Error]:', err.message);
    res.status(500).json({ error: 'Webhook processing error' });
  }
};
