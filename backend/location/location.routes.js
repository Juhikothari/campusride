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


module.exports = router;