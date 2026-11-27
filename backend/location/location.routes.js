// backend/location/location.routes.js
// Hardened Location Search, Reverse Geocoding & Routing Proxy (OpenStreetMap / Photon / OSRM)
// Returns GeoJSON-compliant coordinates [longitude, latitude] alongside normalized labels.
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const auth = require('../middleware/auth');
const { resolveMapsLink } = require('./mapsLink');

const PHOTON_BASE_URL = (process.env.PHOTON_URL || 'https://photon.komoot.io').replace(/\/$/, '');
const NOMINATIM_BASE_URL = (process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
const OSRM_BASE_URL = (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');

// Dedicated rate limiter to protect third-party geocoding & routing providers
const locationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many location or routing requests. Please slow down.' }
});

// Simple bounded in-memory TTL cache to honor provider usage policies & prevent bursts
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const responseCache = new Map();

function getCached(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function parseCoordinate(val, min, max) {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return num;
}

function buildFeature({ name, displayName, lat, lng, category, source }) {
  const lon = Number(lng.toFixed(6));
  const latitude = Number(lat.toFixed(6));
  const cleanLabel = (name || displayName?.split(',')[0] || 'Selected Location').trim();
  const cleanDisplay = (displayName || cleanLabel).trim();

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [lon, latitude] // Standard GeoJSON [longitude, latitude]
    },
    properties: {
      label: cleanLabel,
      display_name: cleanDisplay,
      category: category || null,
      source,
      attribution: '© OpenStreetMap contributors'
    },
    // Normalized convenience properties for existing mobile screens
    label: cleanLabel,
    display_name: cleanDisplay,
    lat: latitude,
    lng: lon
  };
}

function scoreRelevance(item, queryLower, tokens, biasLat = 12.9716, biasLng = 77.5946) {
  const labelLower = (item.label || '').toLowerCase();
  const displayLower = (item.display_name || '').toLowerCase();
  let score = 0;

  if (labelLower === queryLower) score += 100;
  else if (labelLower.startsWith(queryLower)) score += 60;
  else if (labelLower.includes(queryLower)) score += 35;

  for (const t of tokens) {
    if (labelLower.includes(t)) score += 12;
    else if (displayLower.includes(t)) score += 5;
  }

  // Strong local proximity bias around user's active coordinates / Bengaluru campus region
  const dLat = Number.isFinite(item.lat) ? Math.abs(item.lat - biasLat) : 999;
  const dLng = Number.isFinite(item.lng) ? Math.abs(item.lng - biasLng) : 999;
  const inBengaluru =
    /bengaluru|bangalore/i.test(displayLower) ||
    (item.lat >= 12.75 && item.lat <= 13.20 && item.lng >= 77.35 && item.lng <= 77.85);
  const inIndia =
    /india/i.test(displayLower) ||
    (item.lat >= 6 && item.lat <= 37 && item.lng >= 68 && item.lng <= 98);

  if (dLat <= 0.35 && dLng <= 0.35) score += 90;
  else if ((dLat <= 0.75 && dLng <= 0.75) || inBengaluru) score += 60;
  else if (inIndia) score += 15;
  else score -= 80;

  return score;
}

function deduplicateResults(items) {
  const seen = [];
  for (const item of items) {
    const isDup = seen.some(existing =>
      Math.abs(existing.lat - item.lat) < 0.0004 &&
      Math.abs(existing.lng - item.lng) < 0.0004 &&
      existing.label.toLowerCase() === item.label.toLowerCase()
    );
    if (!isDup) seen.push(item);
  }
  return seen;
}

router.use(locationLimiter);

// ── GET /api/location/search ─────────────────────────────────────
router.get('/search', auth, async (req, res) => {
  try {
    const rawQ = typeof req.query.q === 'string' ? req.query.q : '';
    const q = rawQ.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 150);
    if (q.length < 2) {
      return res.json([]);
    }

    const biasLat = parseCoordinate(req.query.lat, -90, 90) ?? 12.9716;
    const biasLng = parseCoordinate(req.query.lng, -180, 180) ?? 77.5946;
    const cacheKey = `search:${q.toLowerCase()}:${biasLat.toFixed(2)}:${biasLng.toFixed(2)}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    let results = [];
    const qLower = q.toLowerCase();
    const tokens = qLower.split(/\s+/).filter(t => t.length >= 2);

    // Helper to safely parse JSON even if upstream proxy returns an HTML 502/rate-limit page
    async function safeParseJson(resp) {
      if (!resp || !resp.ok) return null;
      const text = await resp.text().catch(() => '');
      if (!text || text.trim().startsWith('<')) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }

    // 1. Primary OSM Autocomplete Provider: Photon (designed specifically for type-ahead OSM search)
    try {
      const photonParams = new URLSearchParams({
        q,
        limit: '12',
        lat: String(biasLat),
        lon: String(biasLng),
        location_bias_scale: '0.1',
        lang: 'en'
      });
      const photonResp = await fetch(`${PHOTON_BASE_URL}/api/?${photonParams.toString()}`, {
        headers: { 'User-Agent': 'HOGO-CampusRide/1.1 (campusride)' },
        signal: AbortSignal.timeout(4500)
      });

      const photonData = await safeParseJson(photonResp);
      if (photonData && Array.isArray(photonData.features) && photonData.features.length) {
        results = photonData.features
          .filter(f => Array.isArray(f?.geometry?.coordinates) && f.geometry.coordinates.length >= 2)
          .map(place => {
            const p = place.properties || {};
            const [lon, lat] = place.geometry.coordinates;
            const formattedParts = [
              p.name,
              p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street,
              p.district || p.suburb || p.locality,
              p.city || p.town || p.village,
              p.state,
              p.country
            ].filter(Boolean);
            const uniqueParts = [...new Set(formattedParts)];
            return buildFeature({
              name: p.name || p.street || p.suburb || p.locality || p.city,
              displayName: uniqueParts.join(', '),
              lat,
              lng: lon,
              category: p.osm_value || p.type,
              source: 'photon'
            });
          });
      }
    } catch (err) {
      console.warn('[Location] Photon search warning:', err.message);
    }

    // Check if primary returned strong local match (don't treat distant non-Bengaluru matches as strong when searching locally)
    const hasStrongMatch = () => results.some(r => {
      const isTextMatch =
        (r.label || '').toLowerCase().includes(qLower) ||
        tokens.every(t => (r.display_name || '').toLowerCase().includes(t));
      const nearBias =
        Number.isFinite(r.lat) &&
        Number.isFinite(r.lng) &&
        Math.abs(r.lat - biasLat) <= 0.5 &&
        Math.abs(r.lng - biasLng) <= 0.5;
      return isTextMatch && nearBias;
    });

    // 2. Controlled Fallback 1: Server-side Geoapify (if configured & primary empty/weak)
    if ((!results.length || !hasStrongMatch()) && process.env.GEOAPIFY_API_KEY) {
      try {
        const geoResp = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?` +
          new URLSearchParams({
            text: q,
            apiKey: process.env.GEOAPIFY_API_KEY,
            limit: '8',
            bias: `proximity:${biasLng},${biasLat}`
          }),
          { signal: AbortSignal.timeout(4500) }
        );
        const geoData = await safeParseJson(geoResp);
        if (geoData && Array.isArray(geoData.features) && geoData.features.length) {
          const geoItems = geoData.features.map(place => buildFeature({
            name: place.properties?.name || place.properties?.street || place.properties?.suburb || place.properties?.city,
            displayName: place.properties?.formatted,
            lat: place.properties?.lat,
            lng: place.properties?.lon,
            category: place.properties?.category,
            source: 'geoapify'
          })).filter(f => Number.isFinite(f.lat) && Number.isFinite(f.lng));
          results = results.concat(geoItems);
        }
      } catch (err) {
        console.warn('[Location] Geoapify fallback warning:', err.message);
      }
    }

    // 3. Controlled Fallback 2: Nominatim whenever results are empty OR lack a strong local match
    async function fetchNominatim(searchQuery) {
      const nomParams = new URLSearchParams({
        q: searchQuery,
        format: 'jsonv2',
        limit: '8',
        addressdetails: '1',
        countrycodes: 'in',
        viewbox: '77.35,13.20,77.85,12.75',
        bounded: '0'
      });
      const nomResp = await fetch(`${NOMINATIM_BASE_URL}/search?${nomParams.toString()}`, {
        headers: { 'User-Agent': 'HOGO-CampusRide/1.1 (support@hogo.app)' },
        signal: AbortSignal.timeout(5000)
      });
      const nomData = await safeParseJson(nomResp);
      if (Array.isArray(nomData) && nomData.length) {
        return nomData.map(item => buildFeature({
          name: item.name || item.display_name?.split(',')[0],
          displayName: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          category: item.type,
          source: 'nominatim'
        })).filter(f => Number.isFinite(f.lat) && Number.isFinite(f.lng));
      }
      return [];
    }

    if (!results.length || !hasStrongMatch()) {
      try {
        const nomItems = await fetchNominatim(q);
        results = results.concat(nomItems);

        // Bengaluru landmark/apartment fallback if still missing strong match
        if ((!results.length || !hasStrongMatch()) && !/bengaluru|bangalore|karnataka|india/i.test(q)) {
          const blrItems = await fetchNominatim(`${q}, Bengaluru`);
          results = results.concat(blrItems);
        }
      } catch (nomErr) {
        console.warn('[Location] Nominatim fallback warning:', nomErr.message);
      }
    }

    results = deduplicateResults(results);
    results.sort((a, b) => scoreRelevance(b, qLower, tokens, biasLat, biasLng) - scoreRelevance(a, qLower, tokens, biasLat, biasLng));
    const finalResults = results.slice(0, 10);

    setCached(cacheKey, finalResults);
    return res.json(finalResults);
  } catch (error) {
    console.error('[Location] Search error:', error.message);
    res.status(500).json({ message: 'Location search failed' });
  }
});

// ── GET /api/location/reverse ────────────────────────────────────
router.get('/reverse', auth, async (req, res) => {
  try {
    const lat = parseCoordinate(req.query.lat, -90, 90);
    const lng = parseCoordinate(req.query.lng, -180, 180);
    if (lat === null || lng === null) {
      return res.status(400).json({ message: 'Valid lat [-90..90] and lng [-180..180] are required' });
    }

    const cacheKey = `rev:${lat.toFixed(4)}:${lng.toFixed(4)}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    let resolved = null;

    // 1. Photon Reverse
    try {
      const photonResp = await fetch(`${PHOTON_BASE_URL}/reverse?lat=${lat}&lon=${lng}&lang=en`, {
        headers: { 'User-Agent': 'HOGO-CampusRide/1.1 (campusride)' },
        signal: AbortSignal.timeout(4500)
      });
      if (photonResp.ok) {
        const photonData = await photonResp.json();
        const place = photonData.features?.[0]?.properties;
        if (place) {
          const parts = [...new Set([place.name, place.street, place.district || place.suburb, place.city, place.state].filter(Boolean))];
          if (parts.length) {
            resolved = {
              label: place.name || place.street || place.suburb || place.city || 'Selected Location',
              display_name: parts.join(', '),
              lat,
              lng,
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lng, lat] },
              attribution: '© OpenStreetMap contributors'
            };
          }
        }
      }
    } catch (err) {
      console.warn('[Location] Photon reverse warning:', err.message);
    }

    // 2. Geoapify Reverse if configured
    if (!resolved && process.env.GEOAPIFY_API_KEY) {
      try {
        const geoResp = await fetch(
          `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${process.env.GEOAPIFY_API_KEY}`,
          { signal: AbortSignal.timeout(4500) }
        );
        if (geoResp.ok) {
          const geoData = await geoResp.json();
          const place = geoData.features?.[0]?.properties;
          if (place?.formatted) {
            resolved = {
              label: place.name || place.street || place.suburb || place.formatted.split(',')[0],
              display_name: place.formatted,
              lat,
              lng,
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lng, lat] }
            };
          }
        }
      } catch {}
    }

    // 3. Nominatim Reverse fallback
    if (!resolved) {
      try {
        const nomResp = await fetch(
          `${NOMINATIM_BASE_URL}/reverse?lat=${lat}&lon=${lng}&format=jsonv2`,
          {
            headers: { 'User-Agent': 'HOGO-CampusRide/1.1 (support@hogo.app)' },
            signal: AbortSignal.timeout(5000)
          }
        );
        if (nomResp.ok) {
          const nomData = await nomResp.json();
          if (nomData?.display_name) {
            resolved = {
              label: nomData.name || nomData.display_name.split(',')[0],
              display_name: nomData.display_name,
              lat,
              lng,
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lng, lat] },
              attribution: '© OpenStreetMap contributors'
            };
          }
        }
      } catch {}
    }

    if (!resolved) {
      resolved = {
        label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        display_name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lng,
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] }
      };
    }

    setCached(cacheKey, resolved);
    return res.json(resolved);
  } catch (err) {
    console.error('[Location] Reverse geocode error:', err.message);
    res.status(500).json({ message: 'Reverse geocode failed' });
  }
});

// ── Road distance & estimate (explicitly marked straight-line based estimate) ──
router.get('/distance', auth, async (req, res) => {
  try {
    const lat1 = parseCoordinate(req.query.fromLat, -90, 90);
    const lng1 = parseCoordinate(req.query.fromLng, -180, 180);
    const lat2 = parseCoordinate(req.query.toLat, -90, 90);
    const lng2 = parseCoordinate(req.query.toLng, -180, 180);

    if (lat1 === null || lng1 === null || lat2 === null || lng2 === null) {
      return res.status(400).json({ message: 'Valid fromLat, fromLng, toLat, toLng coordinates required' });
    }

    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const straightLine = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = +(straightLine * 1.25).toFixed(2);

    return res.json({ distanceKm, straightLineKm: +straightLine.toFixed(2), source: 'haversine-estimate' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to compute distance' });
  }
});

// ── GET /api/location/route — OSRM GeoJSON LineString proxy (Never fabricates unavailable routes) ──
router.get('/route', auth, async (req, res) => {
  try {
    const lat1 = parseCoordinate(req.query.fromLat, -90, 90);
    const lng1 = parseCoordinate(req.query.fromLng, -180, 180);
    const lat2 = parseCoordinate(req.query.toLat, -90, 90);
    const lng2 = parseCoordinate(req.query.toLng, -180, 180);

    if (lat1 === null || lng1 === null || lat2 === null || lng2 === null) {
      return res.status(400).json({ message: 'Valid fromLat, fromLng, toLat, toLng coordinates are required' });
    }

    const cacheKey = `route:${lat1.toFixed(4)},${lng1.toFixed(4)}->${lat2.toFixed(4)},${lng2.toFixed(4)}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    try {
      const url = `${OSRM_BASE_URL}/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson&steps=true`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(7000) });
      if (resp.ok) {
        const data = await resp.json();
        if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0 && data.routes[0].geometry?.coordinates?.length > 1) {
          const route = data.routes[0];
          const rawSteps = route.legs?.[0]?.steps || [];
          const steps = rawSteps.map(step => {
            const type = step.maneuver?.type || 'turn';
            const modifier = (step.maneuver?.modifier || '').toLowerCase();
            const name = step.name ? step.name.trim() : 'Road';
            let instruction = `Continue on ${name}`;
            let icon = '⬆️';

            if (type === 'depart') {
              instruction = `Head out towards ${name}`;
              icon = '🚗';
            } else if (type === 'arrive') {
              instruction = 'Arrive at destination';
              icon = '📍';
            } else if (modifier.includes('uturn') || modifier.includes('u-turn')) {
              instruction = `Make a U-Turn onto ${name}`;
              icon = '🔄';
            } else if (modifier.includes('left')) {
              instruction = modifier.includes('slight') ? `Keep slight left onto ${name}` : `Turn left onto ${name}`;
              icon = '⬅️';
            } else if (modifier.includes('right')) {
              instruction = modifier.includes('slight') ? `Keep slight right onto ${name}` : `Turn right onto ${name}`;
              icon = '➡️';
            }

            return {
              instruction,
              icon,
              type,
              modifier,
              name,
              distanceMeters: Math.round(step.distance || 0),
              durationSec: Math.round(step.duration || 0)
            };
          });

          const distKm = (route.distance / 1000).toFixed(1);
          const durMin = Math.ceil(route.duration / 60);

          const payload = {
            routeAvailable: true,
            provider: 'osrm',
            geojson: {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: route.geometry.coordinates // [lng, lat] order preserved
              },
              properties: {
                distanceKm: distKm,
                durationMin: durMin,
                distanceMeters: Math.round(route.distance),
                durationSeconds: Math.round(route.duration)
              }
            },
            // Backward-compatible array for legacy consumers
            coordinates: route.geometry.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
            distanceKm: distKm,
            durationMin: durMin,
            summary: `Route (${distKm} km, ~${durMin} min)`,
            steps
          };

          setCached(cacheKey, payload);
          return res.json(payload);
        }
      }
    } catch (osrmErr) {
      console.warn('[Location] OSRM routing error:', osrmErr.message);
    }

    // Unavailable route handling: NEVER invent route distances or travel times
    return res.json({
      routeAvailable: false,
      provider: 'osrm',
      unavailableReason: 'Routing service unavailable or no drivable road route found',
      geojson: null,
      coordinates: [],
      distanceKm: null,
      durationMin: null,
      summary: 'Route preview unavailable',
      steps: []
    });
  } catch (err) {
    console.error('[Location] Route endpoint error:', err.message);
    res.status(500).json({ message: 'Route lookup failed' });
  }
});

// ── Read a location from a pasted Google Maps link ─────────────────────────
router.post('/resolve-maps-link', auth, async (req, res) => {
  try {
    const url = String(req.body?.url || '').slice(0, 2000);
    const out = await resolveMapsLink(url);
    if (!out) {
      return res.status(422).json({ message: "Couldn't find a location in that link. Tap Share → Copy link, then paste it here." });
    }
    return res.json(out);
  } catch (err) {
    return res.status(err.status || 400).json({ message: err.status ? err.message : "Couldn't read that link." });
  }
});

module.exports = router;
