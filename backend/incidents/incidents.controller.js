const { notifyAdmins } = require('../notifications/notifications.helper');
const User = require('../users/users.model');
const Incident = require('./incidents.model');

function computeIncidentSeverity(type = '', subject = '', description = '') {
  const combined = `${type} ${subject} ${description}`.toLowerCase();

  // Critical: accident, assault, kidnap, collision, physical violence, medical emergency
  if (
    combined.includes('accident') || combined.includes('collision') ||
    combined.includes('assault') || combined.includes('kidnap') ||
    combined.includes('violence') || combined.includes('medical')
  ) {
    return 'Critical';
  }

  // High: harassment, threat, rash driving, safety intervention, near-miss, dangerous, security, theft, robbery
  if (
    combined.includes('harassment') || combined.includes('threat') ||
    combined.includes('rash driving') || combined.includes('unsafe') ||
    combined.includes('near-miss') || combined.includes('dangerous') ||
    combined.includes('theft') || combined.includes('robbery') ||
    combined.includes('security') || combined.includes('safety')
  ) {
    return 'High';
  }

  // Medium: misuse, fraud, fake identity/booking, verbal abuse, rude, fare dispute, non-payment, vehicle damage, spills, prohibited items, traffic
  if (
    combined.includes('fake') || combined.includes('privacy') ||
    combined.includes('fraud') || combined.includes('misuse') ||
    combined.includes('fare dispute') || combined.includes('non-payment') ||
    combined.includes('verbal abuse') || combined.includes('rude') ||
    combined.includes('damage') || combined.includes('spills') ||
    combined.includes('prohibited') || combined.includes('traffic') ||
    combined.includes('law enforcement')
  ) {
    return 'Medium';
  }

  // Low: notification, ride, app crash, glitch, booking, pickup, cancellation, breakdown, tyre, fuel
  return 'Low';
}

exports.reportIncident = async (req, res) => {
  try {
    const { rideId, type, subject, description, severity } = req.body;
    if (!rideId || !type || !description)
      return res.status(400).json({ message: 'rideId, type and description are required' });

    const determinedSeverity = severity || computeIncidentSeverity(type, subject, description);

    const incident = new Incident({
      rideId,
      reportedBy: req.user.userId,
      type,
      subject: subject || '',
      description,
      severity: determinedSeverity,
    });
    await incident.save();

    // Notify administrators immediately of reported incident
    User.findById(req.user.userId).select('name college').then(reporter => {
      notifyAdmins({
        title: `⚠️ New Incident Reported (${determinedSeverity})`,
        message: `${reporter?.name || 'A user'} reported an incident: ${subject || type}. "${(description || '').slice(0, 100)}"`,
        type: 'incident_report',
        data: {
          incidentId: incident._id,
          rideId,
          type,
          severity: determinedSeverity,
          reportedBy: req.user.userId,
        },
        priority: 'critical',
      }).catch(e => console.log('Admin incident notif error:', e));
    }).catch(() => {});

    res.status(201).json({ message: 'Incident reported', incident });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.addEvidence = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: 'Incident not found' });

    const isReporter = String(incident.reportedBy) === String(req.user.userId);
    const isAdmin = req.user.role === 'admin';
    if (!isReporter && !isAdmin) {
      return res.status(403).json({ message: 'Access denied: Only the incident reporter or admin can attach evidence.' });
    }

    const incoming = Array.isArray(req.body.evidence) ? req.body.evidence.slice(0, 10) : [];
    if (incoming.length === 0) {
      return res.status(400).json({ message: 'Valid evidence array is required.' });
    }

    incident.evidence.push(...incoming);
    await incident.save();
    res.json({ message: 'Evidence added', incident });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getMyIncidents = async (req, res) => {
  try {
    const incidents = await Incident.find({ reportedBy: req.user.userId })
      .select('-severity')
      .populate('rideId', 'date time pickup drop')
      .sort({ createdAt: -1 });
    res.json(incidents);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getAllIncidents = async (req, res) => {
  try {
    const incidents = await Incident.find()
      .populate({
        path: 'rideId',
        select: 'date time pickup drop status costPerSeat seatsAvailable providerId',
        populate: { path: 'providerId', select: 'name email phone college role' }
      })
      .populate('reportedBy', 'name email phone college role kycData')
      .sort({ createdAt: -1 });
    res.json(incidents);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.exportIncident = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate('rideId')
      .populate('reportedBy', 'name email phone');
    if (!incident) return res.status(404).json({ message: 'Incident not found' });
    incident.status    = 'exported_to_authorities';
    incident.exportedAt= new Date();
    incident.exportRef = `CR-${incident._id.toString().slice(-8).toUpperCase()}-${Date.now()}`;
    await incident.save();
    res.json({ message: 'Incident exported', exportRef: incident.exportRef, incident });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['open','under_review','resolved','exported_to_authorities'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });

    // Find incident first to check current status
    const existing = await Incident.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Incident not found' });

    // Lock: once resolved or exported, status cannot be changed back
    const locked = ['resolved', 'exported_to_authorities'];
    if (locked.includes(existing.status)) {
      return res.status(403).json({
        message: `Incident is already ${existing.status.replace(/_/g,' ')} and cannot be modified. If the issue persists, the user must file a new incident report.`
      });
    }

    const incident = await Incident.findByIdAndUpdate(
      req.params.id,
      { status, ...(status === 'resolved' ? { resolvedAt: new Date() } : {}) },
      { new: true }
    );
    res.json(incident);
  } catch (err) { res.status(500).json({ message: err.message }); }
};
