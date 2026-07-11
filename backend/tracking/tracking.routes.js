const express = require("express");
const router = express.Router();
const controller = require("./tracking.controller");
const auth = require('../middleware/auth');
router.post("/update", auth, controller.updateLocation);
router.get("/:rideId", auth, controller.getTracking);
router.post("/end", auth, controller.endRide);

module.exports = router;