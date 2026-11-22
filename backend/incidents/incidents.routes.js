const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { isAdmin } = require('../admin/admin.middleware');
const controller = require('./incidents.controller');

router.post('/report', auth, controller.reportIncident);
router.post('/',       auth, controller.reportIncident);
router.post('/:id/evidence', auth, controller.addEvidence);
router.get('/my', auth, controller.getMyIncidents);

// Admin-only incident oversight routes
router.get('/all', auth, isAdmin, controller.getAllIncidents);
router.post('/:id/export', auth, isAdmin, controller.exportIncident);
router.put('/:id/status',  auth, isAdmin, controller.updateStatus);

module.exports = router;
