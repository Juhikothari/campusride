const express = require('express');
const router = express.Router();
const ratingsController = require('./ratings.controller');
const authMiddleware = require('../middleware/auth');

// POST /api/ratings and /api/ratings/add — requires auth
router.post('/', authMiddleware, ratingsController.addRating);
router.post('/add', authMiddleware, ratingsController.addRating);

// GET /api/ratings/my-ratings — get ratings received by current user
router.get('/my-ratings', authMiddleware, (req, res) => {
  req.params.userId = req.user.userId;
  return ratingsController.getUserRatings(req, res);
});

// GET /api/ratings/ride/:rideId — get all ratings for a specific ride
router.get('/ride/:rideId', ratingsController.getRideRatings);

// GET /api/ratings/reviewer/:userId — ratings submitted by this user
router.get('/reviewer/:userId', ratingsController.getRatingsByReviewer);

// GET /api/ratings/:userId — public (no auth required to view ratings)
router.get('/:userId', ratingsController.getUserRatings);

module.exports = router;