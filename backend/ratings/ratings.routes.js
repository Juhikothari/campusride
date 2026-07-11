const express = require('express');
const router = express.Router();
const ratingsController = require('./ratings.controller');
const authMiddleware = require('../middleware/auth');

// POST /api/ratings/add  — requires auth
router.post('/add', authMiddleware, ratingsController.addRating);

// GET /api/ratings/ride/:rideId — get all ratings for a specific ride
router.get('/ride/:rideId', ratingsController.getRideRatings);

// GET /api/ratings/reviewer/:userId — ratings submitted by this user
router.get('/reviewer/:userId', ratingsController.getRatingsByReviewer);

// GET /api/ratings/:userId  — public (no auth required to view ratings)
router.get('/:userId', ratingsController.getUserRatings);

module.exports = router;