// backend/rides/rides.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const controller = require('./rides.controller');

// All ride routes require authentication
router.use(auth);

// ── STATIC routes MUST come before /:id wildcard ──────────────────
router.post('/create', controller.createRide);
router.get('/search', controller.searchRides);
router.get('/my', controller.getMyRides);
router.get('/no-match-suggest', controller.noMatchSuggest);
router.get('/nearby-suggestions', controller.findNearbyRides);
router.get('/recurring/:rideId/instances', controller.getRecurringInstances);

// ── Dynamic /:id routes ───────────────────────────────────────────
router.get('/:id', controller.getRide);
router.put('/:id', controller.updateRide);
router.delete('/:id', controller.deleteRide);

// Trip status flow
router.post('/:rideId/checklist', controller.submitChecklist);
router.post('/:rideId/pickup', controller.pickupPassenger);
router.post('/:rideId/drop', controller.dropPassenger);
router.post('/:rideId/start', controller.startRide);
router.post('/:rideId/complete', controller.completeRide);
router.post('/:rideId/cancel', controller.cancelRide);

// Status
router.get('/:rideId/status', controller.getRideStatus);

module.exports = router;