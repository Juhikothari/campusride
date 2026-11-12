import { Linking, Platform } from 'react-native';

/**
 * Cleanly formats a coordinate or address object into a Google Maps query string.
 */
function formatPoint(pt) {
  if (!pt) return '';
  if (typeof pt === 'string') return pt.trim();
  let lat = pt.lat ?? pt.latitude;
  let lng = pt.lng ?? pt.longitude;
  if ((lat == null || lng == null) && Array.isArray(pt.coordinates) && pt.coordinates.length >= 2) {
    const c0 = parseFloat(pt.coordinates[0]);
    const c1 = parseFloat(pt.coordinates[1]);
    if (c0 > 50 && c1 < 40) {
      lng = c0;
      lat = c1;
    } else if (c1 > 50 && c0 < 40) {
      lat = c0;
      lng = c1;
    } else {
      lng = c0;
      lat = c1;
    }
  }
  if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (nLat > 50 && nLng < 40) {
      return `${nLng},${nLat}`;
    }
    return `${nLat},${nLng}`;
  }
  return pt.address || pt.name || pt.label || '';
}

/**
 * Open Google Maps exclusively without triggering Android app-chooser dialogs
 * with third-party ride-hailing apps like Rapido, Ola, Uber, etc.
 *
 * Uses explicit Android intent targeting `package=com.google.android.apps.maps`.
 *
 * @param {Object} options
 * @param {Object|string} [options.origin] - Start location {lat, lng} or address string
 * @param {Object|string} [options.destination] - Destination {lat, lng} or address string
 * @param {Array<Object|string>} [options.waypoints] - Intermediate stops (pickups / drops)
 * @param {string} [options.query] - Single location search query or coordinates
 * @param {string} [options.travelmode='driving'] - Mode of travel ('driving', 'walking', etc.)
 */
export async function openGoogleMaps({
  origin,
  destination,
  waypoints = [],
  query = '',
  travelmode = 'driving',
}) {
  let webUrl = '';
  let intentUrl = '';

  const destStr = formatPoint(destination);
  const origStr = formatPoint(origin);

  if (destStr) {
    const encodedDest = encodeURIComponent(destStr);
    let params = `api=1&destination=${encodedDest}&travelmode=${travelmode}`;

    if (origStr) {
      params += `&origin=${encodeURIComponent(origStr)}`;
    }

    if (Array.isArray(waypoints) && waypoints.length > 0) {
      const validWaypoints = waypoints
        .map(formatPoint)
        .filter(Boolean)
        .map(encodeURIComponent)
        .join('|');
      if (validWaypoints) {
        params += `&waypoints=${validWaypoints}`;
      }
    }

    webUrl = `https://www.google.com/maps/dir/?${params}`;
    intentUrl = `intent://www.google.com/maps/dir/?${params}#Intent;scheme=https;package=com.google.android.apps.maps;end`;
  } else {
    const searchTarget = formatPoint(query || origin);
    if (searchTarget) {
      const encodedQuery = encodeURIComponent(searchTarget);
      webUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
      intentUrl = `intent://www.google.com/maps/search/?api=1&query=${encodedQuery}#Intent;scheme=https;package=com.google.android.apps.maps;end`;
    } else {
      webUrl = 'https://www.google.com/maps';
      intentUrl = 'intent://www.google.com/maps#Intent;scheme=https;package=com.google.android.apps.maps;end';
    }
  }

  // 1. On Android, attempt explicit package intent to target Google Maps directly
  if (Platform.OS === 'android') {
    try {
      const canOpen = await Linking.canOpenURL(intentUrl);
      if (canOpen) {
        await Linking.openURL(intentUrl);
        return;
      }
    } catch {}
  }

  // 2. Fallback to standard web URL (opens Google Maps app or browser on iOS / Android)
  try {
    await Linking.openURL(webUrl);
  } catch (err) {
    console.warn('Could not launch Google Maps:', err);
  }
}
