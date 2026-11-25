// campusride-mobile/src/config/mapConfig.js
// Centralized MapLibre + OpenStreetMap configuration & GeoJSON [lng, lat] helpers.

export const MAP_STYLE_URL =
  process.env.EXPO_PUBLIC_MAPLIBRE_STYLE_URL ||
  'https://tiles.openfreemap.org/styles/liberty';

export const MAP_ATTRIBUTION = '© OpenStreetMap contributors · OpenFreeMap';

// GeoJSON coordinate order: [longitude, latitude]
export const DEFAULT_CENTER = [77.5946, 12.9716];
export const DEFAULT_ZOOM = 13.5;

/**
 * Safely converts any location shape ({lat, lng}, {latitude, longitude}, [lng, lat], GeoJSON Point)
 * into strictly ordered GeoJSON [longitude, latitude] coordinates.
 * Never reverses India-range lat (~8-37) and lng (~68-97) when passed as arrays.
 */
export function toLngLat(input) {
  if (!input) return null;

  // GeoJSON Feature or Geometry
  if (input.geometry?.coordinates && Array.isArray(input.geometry.coordinates)) {
    return toLngLat(input.geometry.coordinates);
  }
  if (Array.isArray(input.coordinates) && input.coordinates.length >= 2) {
    return toLngLat(input.coordinates);
  }

  if (Array.isArray(input) && input.length >= 2) {
    const a = Number(input[0]);
    const b = Number(input[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    // In India region (lng ~68..97, lat ~6..38): ensure [lng, lat]
    if (a >= -180 && a <= 180 && b >= -90 && b <= 90) {
      if (b > 50 && a < 45) return [b, a];
      return [a, b];
    }
    return null;
  }

  const rawLat = input.latitude ?? input.lat;
  const rawLng = input.longitude ?? input.lng ?? input.lon;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lng, lat];
}

/**
 * Computes [west, south, east, north] bounds for an array of [lng, lat] coordinates.
 */
export function computeLngLatBounds(coordsList) {
  if (!Array.isArray(coordsList) || coordsList.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const pt of coordsList) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const [lng, lat] = pt;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }

  if (!Number.isFinite(west) || !Number.isFinite(south)) return null;
  // Add small minimum span if points are very close
  if (Math.abs(east - west) < 0.002) {
    west -= 0.002;
    east += 0.002;
  }
  if (Math.abs(north - south) < 0.002) {
    south -= 0.002;
    north += 0.002;
  }
  return [west, south, east, north];
}
