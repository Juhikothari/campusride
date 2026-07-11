// backend/bookings/bookings.routes.js - CORRECTED
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const controller = require('./bookings.controller');

// All booking routes require authentication
router.use(auth);

// FIXED: Single /request route with correct controller
router.post('/request', controller.requestBooking);

// FIXED: Added /my route for getting user's bookings
router.get('/my', controller.getMyBookings);

// FIXED: Added /respond route for providers to respond
router.put('/respond', controller.respondBooking);

// FIXED: Added /requests route for providers to see all requests
router.get('/requests', controller.getRideRequests);

// FIXED: Added /ride/:rideId route to get bookings for specific ride
router.get('/ride/:rideId', controller.getBookingsForRide);

module.exports = router;