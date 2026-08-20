// backend/rides/rides.routes.js
const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/auth');
const controller = require('./rides.controller');

// All ride routes require authentication
router.use(auth);

// ── Static routes (MUST come before /:id wildcard) ───────────
router.post('/create', controller.createRide);
router.post('/',       controller.createRide); // alias for POST /api/ride

router.get('/search',             controller.searchRides);
router.get('/my',                 controller.getMyRides);
router.get('/my-rides',           controller.getMyRides); // alias for GET /api/ride/my-rides
router.get('/no-match-suggest',   controller.noMatchSuggest);
router.get('/nearby-suggestions', controller.findNearbyRides);
router.get('/recurring/:rideId/instances', controller.getRecurringInstances);

// Trip status flow (specific parameterized routes before generic /:id)
router.post('/:rideId/checklist', controller.submitChecklist);
router.post('/:rideId/pickup',    controller.pickupPassenger);
router.post('/:rideId/drop',      controller.dropPassenger);

router.post('/:rideId/start',     controller.startRide);
router.put('/:rideId/start',      controller.startRide);

router.post('/:rideId/complete',  controller.completeRide);
router.put('/:rideId/complete',   controller.completeRide);

router.post('/:rideId/cancel',    controller.cancelRide);
router.put('/:rideId/cancel',     controller.cancelRide);

router.get('/:rideId/status',     controller.getRideStatus);

// ── Generic /:id routes (at the end) ─────────────────────────
router.get('/:id',    controller.getRide);
router.put('/:id',    controller.updateRide);
router.delete('/:id', controller.deleteRide);

module.exports = router;