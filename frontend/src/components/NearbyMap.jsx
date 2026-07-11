/**
 * NearbyMap.jsx
 * Shows nearby providers on a Leaflet + OSM map.
 * Draws the optimal route (via OSRM) between pickup and drop when both are set.
 * Female providers are highlighted with a pink marker.
 * Women-only rides have a special badge.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as api from '../services/api.js';
import './NearbyMap.css';

// Lazy-load Leaflet only in browser
let L = null;

const FEMALE_ICON_SVG = (womenOnly) => `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
  <path d="M16 0 C7.16 0 0 7.16 0 16 C0 28 16 42 16 42 C16 42 32 28 32 16 C32 7.16 24.84 0 16 0Z"
        fill="${womenOnly ? '#e91e8c' : '#ff6ab0'}" stroke="#fff" stroke-width="2"/>
  <text x="16" y="21" text-anchor="middle" font-size="14" fill="#fff">♀</text>
</svg>`;

const MALE_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
  <path d="M16 0 C7.16 0 0 7.16 0 16 C0 28 16 42 16 42 C16 42 32 28 32 16 C32 7.16 24.84 0 16 0Z"
        fill="#f5a623" stroke="#fff" stroke-width="2"/>
  <text x="16" y="21" text-anchor="middle" font-size="14" fill="#fff">🚗</text>
</svg>`;

const YOU_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <circle cx="14" cy="14" r="12" fill="#4fc3f7" stroke="#fff" stroke-width="2"/>
  <circle cx="14" cy="14" r="5" fill="#fff"/>
</svg>`;

function makeIcon(svg, size = [32, 42], anchor = [16, 42]) {
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: size,
    iconAnchor: anchor,
    popupAnchor: [0, -40],
  });
}

export default function NearbyMap({ pickupLat, pickupLng, dropLat, dropLng, userGender, className = '' }) {
  const mapRef    = useRef(null);
  const mapObj    = useRef(null);
  const routeLayer= useRef(null);
  const markersLayer = useRef(null);

  const [providers, setProviders] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [leafletReady, setLeafletReady] = useState(false);

  // Load Leaflet CSS + JS lazily
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window._leafletLoaded) { L = window.L; setLeafletReady(true); return; }

    // Inject CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Inject JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      L = window.L;
      window._leafletLoaded = true;
      setLeafletReady(true);
    };
    document.head.appendChild(script);
  }, []);

  // Init map once Leaflet is ready
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapObj.current) return;

    const center = (pickupLat && pickupLng)
      ? [parseFloat(pickupLat), parseFloat(pickupLng)]
      : [12.9716, 77.5946]; // Default: Bangalore

    mapObj.current = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true }).setView(center, 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(mapObj.current);

    markersLayer.current = L.layerGroup().addTo(mapObj.current);
    routeLayer.current   = L.layerGroup().addTo(mapObj.current);
  }, [leafletReady, pickupLat, pickupLng]);

  // Fetch nearby providers whenever pickup changes
  const fetchNearby = useCallback(async () => {
    if (!pickupLat || !pickupLng) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getNearbyUsers({ lat: pickupLat, lng: pickupLng, radius: 8000 });
      setProviders(data.providers || []);
    } catch (e) {
      setError('Could not load nearby providers.');
    } finally {
      setLoading(false);
    }
  }, [pickupLat, pickupLng]);

  // Fetch route when both pickup & drop are set
  const fetchRoute = useCallback(async () => {
    if (!pickupLat || !pickupLng || !dropLat || !dropLng) return;
    try {
      const data = await api.getRoute({ fromLat: pickupLat, fromLng: pickupLng, toLat: dropLat, toLng: dropLng });
      setRouteInfo(data);
      return data;
    } catch {
      return null;
    }
  }, [pickupLat, pickupLng, dropLat, dropLng]);

  useEffect(() => { fetchNearby(); }, [fetchNearby]);
  useEffect(() => { fetchRoute(); }, [fetchRoute]);

  // Update map markers + route whenever data or map changes
  useEffect(() => {
    if (!leafletReady || !mapObj.current || !markersLayer.current) return;

    markersLayer.current.clearLayers();
    routeLayer.current.clearLayers();

    const bounds = [];

    // 📍 Your location (pickup)
    if (pickupLat && pickupLng) {
      const lat = parseFloat(pickupLat), lng = parseFloat(pickupLng);
      bounds.push([lat, lng]);
      L.marker([lat, lng], { icon: makeIcon(YOU_ICON_SVG, [28, 28], [14, 14]) })
        .bindPopup('<b>📍 Your Pickup</b>')
        .addTo(markersLayer.current);
    }

    // 🏁 Drop location
    if (dropLat && dropLng) {
      const lat = parseFloat(dropLat), lng = parseFloat(dropLng);
      bounds.push([lat, lng]);
      L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
            <path d="M16 0 C7.16 0 0 7.16 0 16 C0 28 16 42 16 42 C16 42 32 28 32 16 C32 7.16 24.84 0 16 0Z" fill="#4caf50" stroke="#fff" stroke-width="2"/>
            <text x="16" y="22" text-anchor="middle" font-size="15" fill="#fff">🏁</text>
          </svg>`,
          className: '', iconSize: [32, 42], iconAnchor: [16, 42], popupAnchor: [0, -40],
        })
      }).bindPopup('<b>🏁 Drop Point</b>').addTo(markersLayer.current);
    }

    // Route polyline
    if (routeInfo?.coordinates?.length) {
      const poly = L.polyline(routeInfo.coordinates, {
        color: '#f5a623', weight: 4, opacity: 0.85, dashArray: null,
      }).addTo(routeLayer.current);
      poly.bindPopup(`🛣️ ${routeInfo.distanceKm} km · ~${routeInfo.durationMin} min (optimal route)`);
      bounds.push(...routeInfo.coordinates.slice(0, 50));
    }

    // Provider markers
    providers.forEach(p => {
      bounds.push([p.lat, p.lng]);
      const isFemale  = p.gender === 'female';
      const svg       = isFemale ? FEMALE_ICON_SVG(p.womenOnly) : MALE_ICON_SVG;
      const genderTag = isFemale ? '♀ Female provider' : (p.gender === 'male' ? '♂ Male provider' : 'Provider');
      const womenBadge= p.womenOnly ? '<span style="background:#e91e8c;color:#fff;border-radius:4px;padding:2px 6px;font-size:11px;margin-left:6px;">Women Only</span>' : '';

      L.marker([p.lat, p.lng], { icon: makeIcon(svg) })
        .bindPopup(`
          <div style="min-width:180px;">
            <b style="font-size:14px;">${p.name}</b> ${womenBadge}<br/>
            <span style="color:#888;font-size:12px;">${genderTag}</span><br/>
            <hr style="margin:6px 0;border-color:#333;"/>
            <div>📍 ${p.pickup}</div>
            <div>🏁 ${p.drop}</div>
            <div>💺 ${p.seatsAvailable} seats · ₹${p.costPerSeat}/seat</div>
          </div>
        `)
        .addTo(markersLayer.current);
    });

    // Fit map to all points
    if (bounds.length > 1 && mapObj.current) {
      try { mapObj.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 }); }
      catch {}
    } else if (bounds.length === 1 && mapObj.current) {
      mapObj.current.setView(bounds[0], 14);
    }
  }, [leafletReady, providers, routeInfo, pickupLat, pickupLng, dropLat, dropLng]);

  if (!pickupLat || !pickupLng) return null;

  const femaleCount = providers.filter(p => p.gender === 'female').length;
  const womenOnlyCount = providers.filter(p => p.womenOnly).length;

  return (
    <div className={`nearby-map-wrapper ${className}`}>
      <div className="nearby-map-header">
        <span className="nearby-map-title">🗺️ Nearby Providers</span>
        <div className="nearby-map-stats">
          {loading && <span className="nearby-map-loading">Loading…</span>}
          {!loading && providers.length > 0 && (
            <>
              <span className="nearby-stat">{providers.length} nearby</span>
              {femaleCount > 0 && <span className="nearby-stat female">♀ {femaleCount} female</span>}
              {womenOnlyCount > 0 && <span className="nearby-stat women-only">🔒 {womenOnlyCount} women-only</span>}
            </>
          )}
          {!loading && providers.length === 0 && !error && (
            <span className="nearby-stat muted">No providers found nearby</span>
          )}
          {routeInfo && (
            <span className="nearby-stat route">🛣️ {routeInfo.distanceKm} km · {routeInfo.durationMin} min</span>
          )}
        </div>
      </div>

      {error && <div className="nearby-map-error">{error}</div>}

      <div className="nearby-map-legend">
        <span><span className="legend-dot you" />You</span>
        <span><span className="legend-dot provider" />Provider</span>
        <span><span className="legend-dot female-provider" />Female provider</span>
        <span><span className="legend-dot women-only-provider" />Women-only ride</span>
        <span><span className="legend-dot drop" />Drop point</span>
      </div>

      <div ref={mapRef} className="nearby-map-canvas" />

      <p className="nearby-map-note">
        Route shown is the fastest road path (via OpenStreetMap). Tap a marker for provider details.
      </p>
    </div>
  );
}
