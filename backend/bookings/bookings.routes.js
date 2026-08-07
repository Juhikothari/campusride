// backend/bookings/bookings.routes.js
const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/auth');
const controller = require('./bookings.controller');

router.use(auth);

router.post('/request',            controller.requestBooking);
router.get('/my',                  controller.getMyBookings);
router.put('/respond',             controller.respondBooking);
router.get('/requests',            controller.getRideRequests);
router.get('/ride/:rideId',        controller.getBookingsForRide);
// FIX: was placed after module.exports so cancel never worked
router.delete('/:bookingId/cancel', controller.cancelBooking);

module.exports = router;
