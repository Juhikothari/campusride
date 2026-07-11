const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const controller = require('./incidents.controller');

router.post('/report', auth, controller.reportIncident);
router.post('/:id/evidence', auth, controller.addEvidence);
router.get('/my', auth, controller.getMyIncidents);
router.get('/all', auth, controller.getAllIncidents);
router.post('/:id/export', auth, controller.exportIncident);
router.put('/:id/status',  auth, controller.updateStatus);

module.exports = router;
