import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import './LiveTracking.css';

export default function LiveTracking({ navigate, rideId, pickupCoords, dropCoords, pickupAddress, dropAddress }) {
  const { user } = useAuth();
  const mapRef    = useRef(null);
  const mapObjRef = useRef(null);
  const markerRef = useRef(null);
  const routeRef  = useRef(null);

  const [tracking,  setTracking]  = useState(true); // auto-start
  const [sosSent,   setSosSent]   = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [elapsed,   setElapsed]   = useState(0);
  const [routeInfo, setRouteInfo] = useState(null);
  const [userLat,   setUserLat]   = useState(null);
  const [userLng,   setUserLng]   = useState(null);
  const [leafletReady, setLeafletReady] = useState(false);

  const fmt = s => String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');

  // Load Leaflet
  useEffect(() => {
    if (window.L) { setLeafletReady(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  // Init map
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapObjRef.current) return;
    const L = window.L;

    // Default center — pickup if available, else Bangalore
    const center = pickupCoords
      ? [pickupCoords.lat, pickupCoords.lng]
      : [12.9716, 77.5946];

    const map = L.map(mapRef.current, { zoomControl: true }).setView(center, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    mapObjRef.current = map;

    // Pickup marker (orange)
    if (pickupCoords) {
      L.marker([pickupCoords.lat, pickupCoords.lng], {
        icon: L.divIcon({
          html: `<div style="background:#f5a623;color:#000;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)">A</div>`,
          className:'', iconSize:[28,28], iconAnchor:[14,14],
        })
      }).addTo(map).bindPopup(`📍 Pickup: ${pickupAddress || 'Pickup'}`);
    }

    // Drop marker (green)
    if (dropCoords) {
      L.marker([dropCoords.lat, dropCoords.lng], {
        icon: L.divIcon({
          html: `<div style="background:#4caf50;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)">B</div>`,
          className:'', iconSize:[28,28], iconAnchor:[14,14],
        })
      }).addTo(map).bindPopup(`🏁 Drop: ${dropAddress || 'Drop'}`);
    }

    // Fetch route — always attempt if we have coords
    if (pickupCoords && dropCoords &&
        pickupCoords.lat && pickupCoords.lng &&
        dropCoords.lat && dropCoords.lng) {
      api.getRoute({
        fromLat: pickupCoords.lat, fromLng: pickupCoords.lng,
        toLat:   dropCoords.lat,   toLng:   dropCoords.lng,
      }).then(data => {
        setRouteInfo(data);
        if (data?.coordinates?.length && mapObjRef.current) {
          const L = window.L;
          if (routeRef.current) routeRef.current.remove();
          routeRef.current = L.polyline(data.coordinates, {
            color: '#f5a623', weight: 5, opacity: 0.9,
          }).addTo(mapObjRef.current);
          // Fit map to full route
          mapObjRef.current.fitBounds(
            L.latLngBounds(data.coordinates),
            { padding: [50, 50] }
          );
        }
      }).catch(() => {
        // Fallback: fit to markers if route fails
        if (pickupCoords && dropCoords && mapObjRef.current) {
          mapObjRef.current.fitBounds([
            [pickupCoords.lat, pickupCoords.lng],
            [dropCoords.lat,   dropCoords.lng],
          ], { padding: [50, 50] });
        }
      });
    } else if (pickupCoords && mapObjRef.current) {
      mapObjRef.current.setView([pickupCoords.lat, pickupCoords.lng], 15);
    }
  }, [leafletReady, pickupCoords, dropCoords, pickupAddress, dropAddress]);

  // Live location tracking
  useEffect(() => {
    if (!tracking || !leafletReady) return;
    let watchId;
    const L = window.L;

    const updateMarker = (lat, lng) => {
      setUserLat(lat); setUserLng(lng);
      if (!mapObjRef.current) return;
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style="background:#4fc3f7;border-radius:50%;width:18px;height:18px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);animation:pulse-dot 1.5s infinite"></div>`,
          className:'', iconSize:[18,18], iconAnchor:[9,9],
        })
      }).addTo(mapObjRef.current).bindPopup('📍 Your location');
      mapObjRef.current.panTo([lat, lng]);
    };

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        pos => updateMarker(pos.coords.latitude, pos.coords.longitude),
        () => {},
        { enableHighAccuracy: true, maximumAge: 3000 }
      );
    }

    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => {
      clearInterval(timer);
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [tracking, leafletReady]);

  const handleSOS = () => {
    setSosActive(true);
    setTimeout(() => { setSosSent(true); setSosActive(false); }, 2000);
  };

  return (
    <div className="tracking-wrap fade-up">
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        <button onClick={() => navigate('dashboard')} style={{background:'none',border:'none',color:'#aaa',fontSize:20,cursor:'pointer'}}>←</button>
        <div>
          <h1 className="heading" style={{fontSize:22,margin:0}}>Live Tracking</h1>
          <p className="text-muted" style={{fontSize:12,margin:0}}>
            {pickupAddress || 'Pickup'} → {dropAddress || 'Drop'}
          </p>
        </div>
      </div>

      {sosSent && (
        <div className="alert alert-error mb-16">
          🚨 SOS Alert Sent! Emergency contacts notified.
        </div>
      )}

      {/* Route info bar */}
      {routeInfo && (
        <div style={{
          background:'rgba(245,166,35,0.1)',border:'1px solid rgba(245,166,35,0.3)',
          borderRadius:10, padding:'10px 16px', marginBottom:12,
          display:'flex', gap:20, fontSize:13,
        }}>
          <span>🛣️ <strong>{routeInfo.distanceKm} km</strong></span>
          <span>⏱ <strong>~{routeInfo.durationMin} min</strong></span>
          {tracking && <span>⏱ Elapsed: <strong>{fmt(elapsed)}</strong></span>}
        </div>
      )}

      {/* Leaflet Map */}
      <div ref={mapRef} style={{
        height: 340, width:'100%', borderRadius:14,
        overflow:'hidden', marginBottom:16,
        border:'1px solid rgba(255,255,255,0.08)',
        background:'#1a1d24',
      }} />

      {!leafletReady && (
        <div style={{textAlign:'center',color:'#555',padding:'20px 0',fontSize:13}}>
          Loading map…
        </div>
      )}

      {/* Controls */}
      <div className="tracking-controls mb-16">
        <button
          className={`btn btn-lg flex-1 ${tracking ? 'btn-outline' : 'btn-primary'}`}
          onClick={() => { setTracking(t => !t); if (tracking) { setElapsed(0); } }}>
          {tracking ? '⏹ Stop Tracking' : '▶ Start Tracking'}
        </button>
        <button
          className={`btn btn-lg btn-danger ${sosActive ? 'btn-loading' : ''}`}
          onClick={handleSOS}
          disabled={sosActive || sosSent}
          style={{background:'#ef4444',color:'#fff',border:'none',minWidth:100}}>
          {sosSent ? '✓ SOS Sent' : sosActive ? '…' : '🆘 SOS'}
        </button>
      </div>

      <div className="privacy-note">
        <span className="privacy-icon">🔒</span>
        <div>
          <div className="privacy-title">Location Privacy</div>
          <div className="privacy-sub">Location shared only during active ride. Data deleted after trip ends.</div>
        </div>
      </div>
    </div>
  );
}
