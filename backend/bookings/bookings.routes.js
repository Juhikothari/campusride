// backend/bookings/bookings.routes.js
const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/auth');
const controller = require('./bookings.controller');

router.use(auth);

// ── Static routes (MUST precede parameterized routes) ────────
router.post('/request', controller.requestBooking);
router.post('/',        controller.requestBooking); // alias for POST /api/booking

router.get('/my',            controller.getMyBookings);
router.get('/my-bookings',   controller.getMyBookings); // alias for GET /api/booking/my-bookings
router.get('/requests',      controller.getRideRequests);

router.put('/respond',       controller.respondBooking);

router.get('/ride/:rideId',  controller.getBookingsForRide);

// ── Parameterized routes ─────────────────────────────────────
router.put('/:bookingId/accept', (req, res, next) => {
  req.body.bookingId = req.params.bookingId;
  req.body.status = 'accepted';
  controller.respondBooking(req, res, next);
});

router.put('/:bookingId/reject', (req, res, next) => {
  req.body.bookingId = req.params.bookingId;
  req.body.status = 'rejected';
  controller.respondBooking(req, res, next);
});

router.put('/:bookingId/cancel',    controller.cancelBooking);
router.delete('/:bookingId/cancel', controller.cancelBooking);
router.delete('/:bookingId',        controller.cancelBooking);

module.exports = router;
