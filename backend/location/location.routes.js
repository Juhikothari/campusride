const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

router.get('/search', auth, async (req, res) => {

  try {

    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    let results = [];

    // =====================================================
    // 1. TRY GEOAPIFY FIRST
    // =====================================================

    try {

      const geoResponse = await fetch(

        `https://api.geoapify.com/v1/geocode/autocomplete?` +

        new URLSearchParams({
          text: q,
          apiKey: process.env.GEOAPIFY_API_KEY,
          limit: 8,
          filter: 'countrycode:in'
        })

      );

      if (geoResponse.ok) {

        const geoData = await geoResponse.json();

        results = geoData.features.map(place => ({

          display_name:
            place.properties.formatted,

          lat:
            Number(place.properties.lat.toFixed(5)),

          lng:
            Number(place.properties.lon.toFixed(5)),

          label:
          place.properties.name ||
          place.properties.street ||
          place.properties.suburb ||
          place.properties.city ||
          place.properties.county ||
          place.properties.state ||
          place.properties.formatted?.split(',')[0] ||
          'Location'
            

        }));

      }

    } catch (err) {

      console.log('Geoapify failed, trying Photon...');

    }

    // =====================================================
    // 2. FALLBACK TO PHOTON
    // =====================================================

    if (!results.length) {

      try {

        const photonResponse = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8`
        );

        if (photonResponse.ok) {

          const photonData = await photonResponse.json();

          results = photonData.features.map(place => ({

            display_name: [
              place.properties.name,
              place.properties.street,
              place.properties.city,
              place.properties.state,
              place.properties.country
            ]
              .filter(Boolean)
              .join(', '),

            lat:
              Number(place.geometry.coordinates[1].toFixed(5)),

            lng:
              Number(place.geometry.coordinates[0].toFixed(5)),

            label:
            place.properties.name ||
            place.properties.street ||
            place.properties.suburb ||
            place.properties.city ||
            place.properties.state ||
            place.properties.country ||
            'Location'

          }));

        }

      } catch (err) {

        console.error('Photon fallback failed:', err);

      }

    }

    res.json(results);

  } catch (error) {

    console.error('Location search error:', error);

    res.status(500).json({
      message: 'Location search failed'
    });

  }

});

router.get('/reverse', auth, async (req, res) => {

  try {

    const { lat, lng } = req.query;

    let address = null;

    // =====================================================
    // 1. TRY GEOAPIFY
    // =====================================================

    try {

      const geoResponse = await fetch(

        `https://api.geoapify.com/v1/geocode/reverse?` +

        new URLSearchParams({
          lat,
          lon: lng,
          apiKey: process.env.GEOAPIFY_API_KEY
        })

      );

      if (geoResponse.ok) {

        const geoData = await geoResponse.json();

        const place = geoData.features?.[0];

        if (place?.properties?.formatted) {

          address = place.properties.formatted;

        }

      }

    } catch (err) {

      console.log('Geoapify reverse failed, trying Photon...');

    }

    // =====================================================
    // 2. PHOTON FALLBACK
    // =====================================================

    if (!address) {

      try {

        const photonResponse = await fetch(
          `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`
        );

        if (photonResponse.ok) {

          const photonData = await photonResponse.json();

          const place = photonData.features?.[0];

          if (place) {

            address = [
              place.properties.name,
              place.properties.street,
              place.properties.city,
              place.properties.state
            ]
              .filter(Boolean)
              .join(', ');

          }

        }

      } catch (err) {

        console.error('Photon reverse failed:', err);

      }

    }

    res.json({
      display_name: address || 'Current Location'
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: 'Reverse geocode failed'
    });

  }

});


// ── Road distance (haversine × 1.4 road factor) ──────────────────
// OSRM public server is blocked in most server environments;
// haversine × 1.4 is accurate enough for campus-range trips (≤50km)
router.get('/distance', auth, async (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;
    if (!fromLat || !fromLng || !toLat || !toLng) {
      return res.status(400).json({ message: 'fromLat, fromLng, toLat, toLng required' });
    }

    const R    = 6371;
    const lat1 = parseFloat(fromLat), lng1 = parseFloat(fromLng);
    const lat2 = parseFloat(toLat),   lng2 = parseFloat(toLng);

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a    = Math.sin(dLat/2)**2
               + Math.cos(lat1 * Math.PI/180)
               * Math.cos(lat2 * Math.PI/180)
               * Math.sin(dLng/2)**2;

    const straightLine = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm   = +(straightLine * 1.0).toFixed(2);

    return res.json({ distanceKm, source: 'haversine' });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Nearby users ─────────────────────────────────────────────────
router.get('/nearby-users', auth, async (req, res) => {
  try {
    const { lat, lng, radius = 5000 } = req.query;
    if (!lat || !lng) return res.status(400).json({ message: 'lat and lng required' });
    const User = require('../users/users.model');
    const Ride = require('../rides/rides.model');
    const nearbyRides = await Ride.find({
      status: 'active',
      seatsAvailable: { $gt: 0 },
      pickup: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(radius)
        }
      }
    }).populate('providerId', 'name gender role').limit(20);
    const providers = nearbyRides.filter(r => r.providerId).map(r => ({
      userId: r.providerId._id, name: r.providerId.name,
      gender: r.providerId.gender, role: 'provider',
      lat: r.pickup.coordinates[1], lng: r.pickup.coordinates[0],
      rideId: r._id, pickup: r.pickup.address, drop: r.drop.address,
      costPerSeat: r.costPerSeat, seatsAvailable: r.seatsAvailable,
      womenOnly: r.womenOnly || false,
    }));
    res.json({ providers, total: providers.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Optimal route via OSRM ───────────────────────────────────────
router.get('/route', auth, async (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;
    if (!fromLat || !fromLng || !toLat || !toLng) {
      return res.status(400).json({ message: 'fromLat, fromLng, toLat, toLng required' });
    }
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await resp.json();
    if (data.code !== 'Ok' || !data.routes?.length) {
      return res.status(404).json({ message: 'No route found' });
    }
    const route = data.routes[0];
    res.json({
      coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceKm: (route.distance / 1000).toFixed(1),
      durationMin: Math.ceil(route.duration / 60),
    });
  } catch (err) {
    res.status(500).json({ message: 'Route fetch failed' });
  }
});

module.exports = router;
