// campusride-mobile/src/config/mapConfig.js
// Centralized MapLibre + OpenStreetMap configuration & GeoJSON [lng, lat] helpers.

// High-clarity CARTO Voyager @2x OpenStreetMap raster tiles ensure street names,
// neighborhoods, colleges, temples, hospitals, landmarks, and buildings remain crisp
// and legible at every zoom level without vector minzoom label hiding.
export const MAP_STYLE_SPEC = {
  version: 8,
  name: 'HOGO OpenStreetMap Voyager',
  sources: {
    'osm-voyager': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution: '© OpenStreetMap contributors · CARTO',
    },
  },
  layers: [
    {
      id: 'hogo-osm-voyager-layer',
      type: 'raster',
      source: 'osm-voyager',
      minzoom: 0,
      maxzoom: 22,
      paint: {
        'raster-fade-duration': 150,
      },
    },
  ],
};

export const MAP_STYLE_URL =
  process.env.EXPO_PUBLIC_MAPLIBRE_STYLE_URL ||
  MAP_STYLE_SPEC;

export const MAP_ATTRIBUTION = '© OpenStreetMap contributors · CARTO';

// GeoJSON coordinate order: [longitude, latitude]
export const DEFAULT_CENTER = [77.5946, 12.9716];
export const DEFAULT_ZOOM = 14;

/**
 * Safely converts any location shape ({lat, lng}, {latitude, longitude}, [lng, lat], GeoJSON Point)
 * into strictly ordered GeoJSON [longitude, latitude] coordinates.
 * Never reverses India-range lat (~8-37) and lng (~68-97) when passed as arrays.
 */
export function toLngLat(input) {
  if (!input) return null;

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
