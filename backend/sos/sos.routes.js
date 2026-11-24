const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { isAdmin } = require('../admin/admin.middleware');
const controller = require('./sos.controller');

// User routes
router.post('/trigger', auth, controller.triggerSOS);
router.get('/ride/:rideId/active', auth, controller.getActiveSOSForRide);
router.get('/:sosId', auth, controller.getSOS);
router.put('/contacts', auth, controller.updateEmergencyContacts);

// SOS response routes
router.post('/:sosId/acknowledge', auth, controller.acknowledgeSOS);
router.post('/:sosId/resolve', auth, controller.resolveSOS);
router.post('/:sosId/cancel', auth, controller.cancelSOS);

// Public Provider Webhooks (Twilio status callbacks)
router.post('/webhook/twilio', express.urlencoded({ extended: false }), controller.handleTwilioWebhook);

// Admin routes - strictly requires admin role
router.get('/admin/all', auth, isAdmin, controller.getAllSOS);

module.exports = router;
