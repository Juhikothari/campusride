const Incident = require('./incidents.model');

exports.reportIncident = async (req, res) => {
  try {
    const { rideId, type, subject, description, severity } = req.body;
    if (!rideId || !type || !description)
      return res.status(400).json({ message: 'rideId, type and description are required' });
    const incident = new Incident({
      rideId,
      reportedBy: req.user.userId,
      type, subject: subject || '', description, severity: severity || 'Medium'
    });
    await incident.save();
    res.status(201).json({ message: 'Incident reported', incident });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.addEvidence = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: 'Incident not found' });
    incident.evidence.push(...(req.body.evidence || []));
    await incident.save();
    res.json({ message: 'Evidence added', incident });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getMyIncidents = async (req, res) => {
  try {
    const incidents = await Incident.find({ reportedBy: req.user.userId })
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
