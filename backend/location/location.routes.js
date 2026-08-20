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
    // 1. TRY GEOAPIFY FIRST (If API KEY available)
    // =====================================================
    if (process.env.GEOAPIFY_API_KEY) {
      try {
        const geoResponse = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?` +
          new URLSearchParams({
            text: q,
            apiKey: process.env.GEOAPIFY_API_KEY,
            limit: 8,
            filter: 'countrycode:in',
            bias: 'proximity:77.5946,12.9716',
          }),
          { signal: AbortSignal.timeout(5000) }
        );

        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          if (Array.isArray(geoData.features) && geoData.features.length) {
            results = geoData.features.map(place => ({
              display_name: place.properties.formatted,
              lat: Number(place.properties.lat.toFixed(5)),
              lng: Number(place.properties.lon.toFixed(5)),
              label: place.properties.name || place.properties.street || place.properties.suburb || place.properties.city || place.properties.formatted?.split(',')[0] || 'Location'
            }));
          }
        }
      } catch (err) {
        console.log('Geoapify autocomplete failed, trying fallbacks...');
      }
    }

    // =====================================================
    // 2. TRY PHOTON (Komoot OSM)
    // =====================================================
    if (!results.length) {
      try {
        const photonResponse = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lat=12.9716&lon=77.5946`,
          { signal: AbortSignal.timeout(5000) }
        );

        if (photonResponse.ok) {
          const photonData = await photonResponse.json();
          if (Array.isArray(photonData.features) && photonData.features.length) {
            results = photonData.features.map(place => ({
              display_name: [
                place.properties.name,
                place.properties.street,
                place.properties.suburb,
                place.properties.city,
                place.properties.state,
                place.properties.country
              ].filter(Boolean).join(', '),
              lat: Number(place.geometry.coordinates[1].toFixed(5)),
              lng: Number(place.geometry.coordinates[0].toFixed(5)),
              label: place.properties.name || place.properties.street || place.properties.suburb || place.properties.city || 'Location'
            }));
          }
        }
      } catch (err) {
        console.log('Photon search failed, trying Nominatim fallback...');
      }
    }

    // =====================================================
    // 3. NOMINATIM FALLBACK (Direct OSM Search)
    // =====================================================
    if (!results.length) {
      try {
        const nomResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8&countrycodes=in&addressdetails=1`,
          {
            headers: { 'User-Agent': 'HOGO-App/1.0 (contact@hogo.app)' },
            signal: AbortSignal.timeout(6000)
          }
        );

        if (nomResponse.ok) {
          const nomData = await nomResponse.json();
          if (Array.isArray(nomData) && nomData.length) {
            results = nomData.map(item => ({
              display_name: item.display_name,
              lat: Number(parseFloat(item.lat).toFixed(5)),
              lng: Number(parseFloat(item.lon).toFixed(5)),
              label: item.name || item.display_name.split(',')[0] || 'Location'
            }));
          }
        }
      } catch (nomErr) {
        console.error('Nominatim search failed:', nomErr.message);
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Location search error:', error);
    res.status(500).json({ message: 'Location search failed' });
  }
});

router.get('/reverse', auth, async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ message: 'lat and lng required' });

    let address = null;

    if (process.env.GEOAPIFY_API_KEY) {
      try {
        const geoResponse = await fetch(
          `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${process.env.GEOAPIFY_API_KEY}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          const place = geoData.features?.[0];
          if (place?.properties?.formatted) address = place.properties.formatted;
        }
      } catch (err) {
        console.log('Geoapify reverse failed...');
      }
    }

    if (!address) {
      try {
        const photonResponse = await fetch(
          `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (photonResponse.ok) {
          const photonData = await photonResponse.json();
          const place = photonData.features?.[0];
          if (place) {
            address = [place.properties.name, place.properties.street, place.properties.city, place.properties.state].filter(Boolean).join(', ');
          }
        }
      } catch (err) {
        console.error('Photon reverse failed:', err);
      }
    }

    if (!address) {
      try {
        const nomResponse = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          {
            headers: { 'User-Agent': 'HOGO-App/1.0 (contact@hogo.app)' },
            signal: AbortSignal.timeout(6000)
          }
        );
        if (nomResponse.ok) {
          const nomData = await nomResponse.json();
          if (nomData?.display_name) address = nomData.display_name;
        }
      } catch (nomErr) {
        console.error('Nominatim reverse failed:', nomErr);
      }
    }

    res.json({ display_name: address || 'Current Location' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Reverse geocode failed' });
  }
});

// ── Road distance & route info ──────────────────────────────────
router.get('/distance', auth, async (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;
    if (!fromLat || !fromLng || !toLat || !toLng) {
      return res.status(400).json({ message: 'fromLat, fromLng, toLat, toLng required' });
    }

    const R = 6371;
    const lat1 = parseFloat(fromLat), lng1 = parseFloat(fromLng);
    const lat2 = parseFloat(toLat), lng2 = parseFloat(toLng);

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
    const straightLine = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm = +(straightLine * 1.25).toFixed(2);

    return res.json({ distanceKm, source: 'road-estimate' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Optimal route via OSRM with fallback ────────────────────────
router.get('/route', auth, async (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;
    if (!fromLat || !fromLng || !toLat || !toLng) {
      return res.status(400).json({ message: 'fromLat, fromLng, toLat, toLng required' });
    }

    const lat1 = parseFloat(fromLat), lng1 = parseFloat(fromLng);
    const lat2 = parseFloat(toLat), lng2 = parseFloat(toLng);

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (resp.ok) {
        const data = await resp.json();
        if (data.code === 'Ok' && data.routes?.length) {
          const route = data.routes[0];
          return res.json({
            coordinates: route.geometry.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
            distanceKm: (route.distance / 1000).toFixed(1),
            durationMin: Math.ceil(route.duration / 60),
            summary: `Optimal route (${(route.distance / 1000).toFixed(1)} km, ~${Math.ceil(route.duration / 60)} min)`
          });
        }
      }
    } catch (osrmErr) {
      console.log('OSRM route failed, using geometric fallback...');
    }

    // Fallback: direct line interpolation
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm = (dist * 1.3).toFixed(1);
    const durationMin = Math.max(5, Math.ceil((dist * 1.3) / 25 * 60)); // ~25km/h city speed

    return res.json({
      coordinates: [
        { latitude: lat1, longitude: lng1 },
        { latitude: (lat1 + lat2) / 2, longitude: (lng1 + lng2) / 2 },
        { latitude: lat2, longitude: lng2 }
      ],
      distanceKm,
      durationMin,
      summary: `Estimated route (${distanceKm} km, ~${durationMin} min)`
    });
  } catch (err) {
    res.status(500).json({ message: 'Route calculation failed' });
  }
});

module.exports = router;
