// backend/routing/stopOrder.js
//
// Works out the best order to visit every seeker's pickup and drop, for one provider's ride.
//
// Rules it respects:
//   * a seeker's pickup always comes BEFORE their own drop
//   * seats on board never exceed the vehicle capacity (when capacity is known)
//   * a seeker whose drop is (almost) the ride destination is simply dropped at the end
//   * seekers already picked up are on board from the start (only their drop is left)
//
// Travel times come from OSRM's /table call (free). If OSRM is unreachable we fall back to
// straight-line distance at ~25 km/h so the app still works.

const axios = require('axios');

const OSRM_URL     = (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
const MAX_EXACT    = 5;     // up to 5 seekers: try every valid order (max ~113k, instant)
const SAME_SPOT_M  = 150;   // drop within 150 m of destination = same as destination
const RIDER_WEIGHT = 0.25;  // slightly prefer less time with passengers in the car

// ── helpers ──────────────────────────────────────────────────────
const toRad = (d) => (d * Math.PI) / 180;
function haversineM(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function fallbackMatrix(points) {
  const mps = 25000 / 3600;
  return points.map((a) => points.map((b) => haversineM(a, b) / mps));
}

async function timeMatrix(points) {
  if (points.length < 2) return [[0]];
  try {
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
    const { data } = await axios.get(
      `${OSRM_URL}/table/v1/driving/${coords}?annotations=duration`,
      { timeout: 8000 }
    );
    const d = data && data.durations;
    if (data && data.code === 'Ok' && Array.isArray(d) &&
        d.every((row) => Array.isArray(row) && row.every((v) => typeof v === 'number'))) {
      return d;
    }
  } catch (e) {
    console.log('[stopOrder] OSRM table failed, using straight-line estimate:', e.message);
  }
  return fallbackMatrix(points);
}

async function routeGeometry(points) {
  if (points.length < 2) return [];
  try {
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
    const { data } = await axios.get(
      `${OSRM_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`,
      { timeout: 10000 }
    );
    const r = data && data.routes && data.routes[0];
    if (r && r.geometry && Array.isArray(r.geometry.coordinates)) {
      return { coords: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })), meters: r.distance };
    }
  } catch (e) {
    console.log('[stopOrder] OSRM route failed, using straight lines:', e.message);
  }
  return { coords: points.map((p) => ({ lat: p.lat, lng: p.lng })), meters: null };
}

const pt = (loc) => {
  if (!loc) return null;
  const c = loc.coordinates;
  if (Array.isArray(c) && c.length >= 2 && Number.isFinite(+c[0]) && Number.isFinite(+c[1])) {
    return { lat: +c[1], lng: +c[0], address: loc.address || loc.name || '' };
  }
  if (Number.isFinite(+loc.lat) && Number.isFinite(+loc.lng)) {
    return { lat: +loc.lat, lng: +loc.lng, address: loc.address || loc.name || '' };
  }
  return null;
};

// ── exact search with pruning ────────────────────────────────────
// nodes[0] = start, nodes[last] = destination, nodes[1..last-1] = pickups/drops
function solveExact(M, mids, destIdx, capacity, onboardAtStart) {
  let best = { cost: Infinity, order: null };
  const n = mids.length;
  const used = new Array(n).fill(false);
  const pickElapsed = {};           // rider key -> elapsed seconds at pickup
  const order = [];

  const finishRiders = onboardAtStart.concat(); // riders that stay on board until destination handled later

  function dfs(last, elapsed, ride, onboardSeats, onboardKeys) {
    if (elapsed + RIDER_WEIGHT * ride >= best.cost) return;
    if (order.length === n) {
      const finalElapsed = elapsed + M[last][destIdx];
      let r = ride;
      for (const k of onboardKeys) r += finalElapsed - (pickElapsed[k] || 0);
      const cost = finalElapsed + RIDER_WEIGHT * r;
      if (cost < best.cost) best = { cost, order: order.concat(), total: finalElapsed };
      return;
    }
    for (let i = 0; i < n; i += 1) {
      if (used[i]) continue;
      const m = mids[i];
      if (m.type === 'drop' && !onboardKeys.includes(m.key)) continue; // pickup first
      if (m.type === 'pickup' && onboardSeats + m.seats > capacity) continue;
      const t = elapsed + M[last][m.idx];
      used[i] = true; order.push(i);
      if (m.type === 'pickup') {
        pickElapsed[m.key] = t;
        dfs(m.idx, t, ride, onboardSeats + m.seats, onboardKeys.concat(m.key));
        delete pickElapsed[m.key];
      } else {
        const added = t - (pickElapsed[m.key] || 0);
        dfs(m.idx, t, ride + added, onboardSeats - m.seats,
          onboardKeys.filter((k) => k !== m.key));
      }
      order.pop(); used[i] = false;
    }
  }

  const seats0 = onboardAtStart.reduce((s, r) => s + r.seats, 0);
  dfs(0, 0, 0, seats0, finishRiders.map((r) => r.key));
  return best;
}

function solveGreedy(M, mids, destIdx, capacity, onboardAtStart) {
  const n = mids.length;
  const used = new Array(n).fill(false);
  const order = [];
  let last = 0; let elapsed = 0;
  let onboardSeats = onboardAtStart.reduce((s, r) => s + r.seats, 0);
  const onboard = new Set(onboardAtStart.map((r) => r.key));
  while (order.length < n) {
    let pick = -1; let bestT = Infinity;
    for (let i = 0; i < n; i += 1) {
      if (used[i]) continue;
      const m = mids[i];
      if (m.type === 'drop' && !onboard.has(m.key)) continue;
      if (m.type === 'pickup' && onboardSeats + m.seats > capacity) continue;
      if (M[last][m.idx] < bestT) { bestT = M[last][m.idx]; pick = i; }
    }
    if (pick === -1) return { cost: Infinity, order: null };
    const m = mids[pick];
    used[pick] = true; order.push(pick); elapsed += bestT; last = m.idx;
    if (m.type === 'pickup') { onboard.add(m.key); onboardSeats += m.seats; }
    else { onboard.delete(m.key); onboardSeats -= m.seats; }
  }
  return { cost: elapsed + M[last][destIdx], order, total: elapsed + M[last][destIdx] };
}

/**
 * planStops({ ride, bookings, from, capacity, withGeometry })
 *   ride      - Ride doc (pickup, drop with coordinates [lng, lat])
 *   bookings  - ACCEPTED bookings that still need a stop, each with
 *               { _id, seats, pickup, drop, stopStatus, seekerId: { name } }
 *   from      - optional { lat, lng } current vehicle position (defaults to ride pickup)
 */
async function planStops({ ride, bookings, from, capacity = Infinity, withGeometry = true }) {
  const start = from && Number.isFinite(+from.lat) && Number.isFinite(+from.lng)
    ? { lat: +from.lat, lng: +from.lng, address: 'Current location' }
    : pt(ride.pickup);
  const dest = pt(ride.drop);
  if (!start || !dest) throw new Error('Ride has no valid start / destination');

  const nodes = [{ ...start, key: 'start', type: 'start', label: 'Start' }];
  const mids = [];
  const onboardAtStart = [];

  for (const b of bookings) {
    const key = String(b._id);
    const seats = Math.max(1, b.seats || 1);
    const name = (b.seekerId && b.seekerId.name) || 'Passenger';
    const pu = pt(b.pickup) || pt(ride.pickup);
    const dr = pt(b.drop) || dest;
    const dropAtDest = haversineM(dr, dest) <= SAME_SPOT_M;

    if (b.stopStatus === 'dropped') continue;
    if (b.stopStatus === 'picked_up') {
      onboardAtStart.push({ key, seats });
    } else {
      nodes.push({ ...pu, key, type: 'pickup', bookingId: key, seats, name });
      mids.push({ idx: nodes.length - 1, type: 'pickup', key, seats });
    }
    if (!dropAtDest) {
      nodes.push({ ...dr, key, type: 'drop', bookingId: key, seats, name });
      mids.push({ idx: nodes.length - 1, type: 'drop', key, seats });
    }
  }
  nodes.push({ ...dest, key: 'dest', type: 'destination', label: 'Destination' });
  const destIdx = nodes.length - 1;

  const M = await timeMatrix(nodes);
  const solver = mids.length <= MAX_EXACT * 2 ? solveExact : solveGreedy;
  let result = solver(M, mids, destIdx, capacity, onboardAtStart);
  if (!result.order) result = solver(M, mids, destIdx, Infinity, onboardAtStart); // ignore capacity if it made it impossible

  const ordered = [nodes[0]].concat(result.order.map((i) => nodes[mids[i].idx]));
  ordered.push(nodes[destIdx]);

  // ETAs (minutes from now)
  let elapsed = 0;
  const idxOf = (n) => nodes.indexOf(n);
  const stops = ordered.map((n, i) => {
    if (i > 0) elapsed += M[idxOf(ordered[i - 1])][idxOf(n)];
    return {
      type: n.type, bookingId: n.bookingId || null, name: n.name || null,
      seats: n.seats || null, lat: n.lat, lng: n.lng, address: n.address || '',
      etaMinutes: Math.round(elapsed / 60),
    };
  });

  const geo = withGeometry ? await routeGeometry(ordered) : { coords: [], meters: null };
  return {
    stops,
    totalMinutes: Math.round(result.total / 60),
    totalKm: geo.meters ? +(geo.meters / 1000).toFixed(1) : null,
    geometry: geo.coords,
    googleMapsUrl: buildGoogleMapsUrl(stops),
  };
}

// Opens Google Maps with every stop in the optimised order (no API key needed).
function buildGoogleMapsUrl(stops) {
  if (!stops || stops.length < 2) return null;
  const isGeneric = (addr) => !addr ||
    /^(selected location|current location|start location|destination|pickup spot|drop spot|start|drop)$/i.test(String(addr).trim()) ||
    /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(String(addr).trim());

  const f = (s) => (s.address && !isGeneric(s.address)) ? String(s.address).trim() : `${s.lat},${s.lng}`;
  const origin = f(stops[0]);
  const destination = f(stops[stops.length - 1]);
  const waypoints = stops.slice(1, -1).map(f).join('|');
  let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
  return url;
}

module.exports = { planStops, buildGoogleMapsUrl, solveExact, solveGreedy, haversineM };
