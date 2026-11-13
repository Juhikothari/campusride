// campusride-mobile/src/utils/pricing.js - Shared Fair Distance-Based Price Calculation

export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const p1Lat = parseFloat(lat1), p1Lng = parseFloat(lon1);
  const p2Lat = parseFloat(lat2), p2Lng = parseFloat(lon2);
  if (!Number.isFinite(p1Lat) || !Number.isFinite(p1Lng) || !Number.isFinite(p2Lat) || !Number.isFinite(p2Lng)) {
    return 3.0; // fallback default distance
  }
  const R = 6371;
  const dLat = (p2Lat - p1Lat) * Math.PI / 180;
  const dLng = (p2Lng - p1Lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1Lat * Math.PI / 180) * Math.cos(p2Lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

export function calculateRideFare(distKm, vehicleType = 'car') {
  const vt = (vehicleType || 'car').toLowerCase();
  const is2W = vt.includes('bike') || vt.includes('motorcycle') || vt.includes('scooter');
  const base = is2W ? 15 : 20; // Reduced base price: Bike=15, Car/SUV/XUV=20
  const perKm = is2W ? 5 : (vt === 'xuv' ? 10 : 7);

  const d = Math.max(0.5, Number(distKm) || 1);
  if (d <= 1.0) {
    return base;
  }
  // Strictly different price per kilometer:
  // Car: 1km=20, 2km=34, 3km=41, 4km=48, 5km=55
  // Bike: 1km=15, 2km=25, 3km=30, 4km=35, 5km=40
  return Math.round(base + (d * perKm));
}

export function getEstimatedFare(pickup, drop, vehicleType = 'car', existingCost = null) {
  const pLat = pickup?.lat ?? pickup?.latitude ?? (Array.isArray(pickup?.coordinates) ? pickup.coordinates[1] : null);
  const pLng = pickup?.lng ?? pickup?.longitude ?? (Array.isArray(pickup?.coordinates) ? pickup.coordinates[0] : null);
  const dLat = drop?.lat ?? drop?.latitude ?? (Array.isArray(drop?.coordinates) ? drop.coordinates[1] : null);
  const dLng = drop?.lng ?? drop?.longitude ?? (Array.isArray(drop?.coordinates) ? drop.coordinates[0] : null);

  const km = (pLat && dLat) ? haversineDistanceKm(pLat, pLng, dLat, dLng) : null;
  if (km && km > 0.5) {
    return calculateRideFare(km, vehicleType);
  }
  if (Number.isFinite(existingCost) && existingCost > 0) {
    return existingCost;
  }
  return calculateRideFare(km || 2.5, vehicleType);
}
