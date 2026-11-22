const Tracking = require("./tracking.model");
const Ride = require("../rides/rides.model");
const Booking = require("../bookings/bookings.model");
const User = require("../users/users.model");

// UPDATE LOCATION
const updateLocation = async (req, res) => {
  try {
    const { rideId, latitude, longitude } = req.body;
    const providerId = req.user.userId;

    // Verify ride is in progress
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }
    
    if (ride.status !== 'in-progress') {
      return res.status(400).json({ error: "Ride has not started yet" });
    }

    let tracking = await Tracking.findOne({ rideId });

    if (tracking && tracking.status === "completed") {
      tracking.locations = [];
      tracking.status = "active";
    }

    if (!tracking) {
      tracking = new Tracking({
        rideId,
        providerId,
        locations: [],
        status: "active"
      });
    }

    // Verify provider owns this ride
    if (tracking.providerId.toString() !== providerId) {
      return res.status(403).json({ error: "Not authorized to update this ride" });
    }

    tracking.locations.push({
      lat: latitude,
      lng: longitude,
      time: new Date()
    });

    tracking.status = "active";
    await tracking.save();

    const io = req.app.get("io");
    
    // Emit to specific ride room
    io.to(`ride-${rideId}`).emit("locationUpdate", {
      rideId,
      latitude,
      longitude,
      locations: tracking.locations,
      status: tracking.status
    });

    res.json({ success: true, locationsCount: tracking.locations.length });
  } catch (error) {
    console.error("Update location error:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET TRACKING (Strictly authorized to ride participants and admins)
const getTracking = async (req, res) => {
  try {
    const userId = req.user.userId;
    const rideId = req.params.rideId;

    const [user, ride] = await Promise.all([
      User.findById(userId).select('role blocked suspended'),
      Ride.findById(rideId).select('providerId status')
    ]);

    if (!user || user.blocked || user.suspended) {
      return res.status(403).json({ error: "Account is restricted" });
    }

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    const isAdmin = user.role === 'admin';
    const isProvider = ride.providerId.toString() === userId.toString();
    const isSeeker = await Booking.exists({
      rideId,
      seekerId: userId,
      status: { $in: ['accepted', 'completed'] }
    });

    if (!isAdmin && !isProvider && !isSeeker) {
      return res.status(403).json({ error: "Access denied: You are not an authorized participant in this ride." });
    }

    const tracking = await Tracking.findOne({
      rideId
    }).populate('providerId', 'name phone rating');

    if (!tracking) {
      return res.status(404).json({ error: "Tracking not found" });
    }

    res.json({
      ...tracking.toObject(),
      rideStatus: ride.status
    });
  } catch (error) {
    console.error("Get tracking error:", error);
    res.status(500).json({ error: error.message });
  }
};

// END RIDE
const endRide = async (req, res) => {
  try {
    const { rideId } = req.body;
    const providerId = req.user.userId;

    const tracking = await Tracking.findOne({
      rideId,
      providerId
    });

    if (!tracking) {
      return res.status(404).json({ error: "Tracking not found" });
    }

    tracking.status = "completed";
    await tracking.save();

    const io = req.app.get("io");
    io.to(`ride-${rideId}`).emit("rideEnded", {
      rideId: tracking.rideId
    });

    res.json({ message: "Ride Completed" });
  } catch (error) {
    console.error("End ride error:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  updateLocation,
  getTracking,
  endRide
};