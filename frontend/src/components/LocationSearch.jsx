import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as api from '../services/api.js';
import './LocationSearch.css';

// ── Uber-style Map Picker ─────────────────────────────────────────
// Crosshair stays fixed in center, user drags the map underneath it
function MapPicker({ onSelect, onClose }) {
  const mapRef    = useRef(null);
  const mapObjRef = useRef(null);
  const [address,  setAddress]  = useState('');
  const [coords,   setCoords]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const debounce   = useRef(null);

  const fetchAddress = useCallback(async (lat, lng) => {
    setLoading(true);
    try {
      const place = await api.reverseGeocode(lat, lng);
      setAddress(place?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadLeaflet = () => {
      if (!window.L) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = initMap;
        document.head.appendChild(script);
      } else {
        initMap();
      }
    };

    const initMap = () => {
      if (!mapRef.current || mapObjRef.current) return;
      const L = window.L;
      const defaultCenter = [12.9716, 77.5946];
      const map = L.map(mapRef.current, { zoomControl: true }).setView(defaultCenter, 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19,
      }).addTo(map);

      // Try to center on user's location
      navigator.geolocation?.getCurrentPosition(
        pos => {
          const { latitude: lat, longitude: lng } = pos.coords;
          map.setView([lat, lng], 16);
          setCoords({ lat, lng });
          fetchAddress(lat, lng);
        },
        () => {
          setCoords({ lat: defaultCenter[0], lng: defaultCenter[1] });
          fetchAddress(defaultCenter[0], defaultCenter[1]);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );

      // On every map move, update address from center
      map.on('moveend', () => {
        const { lat, lng } = map.getCenter();
        setCoords({ lat, lng });
        clearTimeout(debounce.current);
        debounce.current = setTimeout(() => fetchAddress(lat, lng), 400);
      });

      mapObjRef.current = map;
    };

    loadLeaflet();
    return () => {
      clearTimeout(debounce.current);
      if (mapObjRef.current) { mapObjRef.current.remove(); mapObjRef.current = null; }
    };
  }, [fetchAddress]);

  const handleConfirm = () => {
    if (coords && address) onSelect({ lat: coords.lat, lng: coords.lng, label: address });
  };

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999,
      background:'rgba(0,0,0,0.7)',
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <div style={{
        background:'#141720', borderRadius:16,
        width:'min(95vw,520px)', overflow:'hidden',
        boxShadow:'0 20px 60px rgba(0,0,0,0.6)',
        display:'flex', flexDirection:'column',
      }}>
        {/* Header */}
        <div style={{
          padding:'14px 18px',
          borderBottom:'1px solid rgba(255,255,255,0.08)',
          display:'flex', alignItems:'center', justifyContent:'space-between',
        }}>
          <div>
            <div style={{fontWeight:700, color:'#fff', fontSize:15}}>📍 Drop pin to select location</div>
            <div style={{fontSize:12, color:'#888', marginTop:2}}>Drag the map to move the pin</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#aaa',fontSize:22,cursor:'pointer',lineHeight:1}}>✕</button>
        </div>

        {/* Map with fixed crosshair */}
        <div style={{position:'relative', height:340}}>
          <div ref={mapRef} style={{height:'100%', width:'100%'}} />

          {/* Crosshair pin — fixed in center, map moves under it */}
          <div style={{
            position:'absolute', top:'50%', left:'50%',
            transform:'translate(-50%, -100%)',
            zIndex:1000, pointerEvents:'none',
            display:'flex', flexDirection:'column', alignItems:'center',
          }}>
            {/* Pin head */}
            <div style={{
              width:32, height:32, borderRadius:'50% 50% 50% 0',
              background:'#f5a623', transform:'rotate(-45deg)',
              border:'3px solid #fff',
              boxShadow:'0 2px 8px rgba(0,0,0,0.4)',
            }} />
            {/* Pin stem shadow */}
            <div style={{
              width:8, height:8, borderRadius:'50%',
              background:'rgba(0,0,0,0.3)',
              marginTop:2,
            }} />
          </div>

          {/* Loading overlay */}
          {loading && (
            <div style={{
              position:'absolute', bottom:12, left:'50%', transform:'translateX(-50%)',
              background:'rgba(0,0,0,0.7)', color:'#fff',
              borderRadius:20, padding:'4px 14px', fontSize:12, zIndex:1001,
            }}>Fetching address…</div>
          )}
        </div>

        {/* Address bar + confirm */}
        <div style={{
          padding:'12px 16px',
          borderTop:'1px solid rgba(255,255,255,0.08)',
          background:'#1a1d24',
          display:'flex', alignItems:'center', gap:10,
        }}>
          <div style={{flex:1}}>
            <div style={{fontSize:11, color:'#888', marginBottom:3}}>SELECTED LOCATION</div>
            <div style={{
              fontSize:13, color: address ? '#fff' : '#555',
              lineHeight:1.4, maxHeight:40, overflow:'hidden',
            }}>
              {loading ? '📍 Fetching address…' : address || 'Move the map to select a location'}
            </div>
          </div>
          <button
            onClick={handleConfirm}
            disabled={!coords || !address || loading}
            style={{
              background:'#f5a623', color:'#000', border:'none',
              borderRadius:10, padding:'10px 20px',
              fontWeight:700, fontSize:14, cursor:'pointer',
              opacity:(!coords||!address||loading)?0.4:1,
              flexShrink:0,
            }}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main LocationSearch component ─────────────────────────────────
export default function LocationSearch({
  placeholder = 'Search for a location...',
  value = '',
  onChange,
  onLocationSelect,
  className = ''
}) {
  const [query,          setQuery]          = useState('');
  const [suggestions,    setSuggestions]    = useState([]);
  const [showSuggestions,setShowSuggestions]= useState(false);
  const [loading,        setLoading]        = useState(false);
  const [geoLoading,     setGeoLoading]     = useState(false);
  const [showMapPicker,  setShowMapPicker]  = useState(false);

  const suggestionsRef = useRef(null);
  const debounceTimer  = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);

  const debouncedSearch = useCallback(async (q) => {
    if (q.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    setLoading(true);
    try {
      const results = await api.searchLocation(q);
      setSuggestions(results);
      setShowSuggestions(true);
    } catch { setSuggestions([]); }
    finally { setLoading(false); }
  }, []);

  const handleSearch = (val) => {
    setQuery(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => debouncedSearch(val), 300);
  };

  const handleSelect = (location) => {
    const fullAddress = location.display_name || location.label || 'Selected Location';
    setQuery(fullAddress);
    setShowSuggestions(false);
    setSuggestions([]);
    onChange?.(fullAddress, location.lat, location.lng);
    onLocationSelect?.({ ...location, label: fullAddress });
  };

  // 📍 Auto-detect location
  const handleGeolocation = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    setGeoLoading(true);
    setQuery('Detecting your location…');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude: lat, longitude: lng } = position.coords;
          const location = await api.reverseGeocode(lat, lng);
          const address = location?.display_name?.trim();
          const finalAddress = address && address !== 'Unknown Location'
            ? address : `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
          setQuery(finalAddress);
          onChange?.(finalAddress, lat, lng);
          onLocationSelect?.({ display_name: finalAddress, lat, lng });
        } catch {
          setQuery('Unable to detect location');
        } finally {
          setGeoLoading(false);
        }
      },
      (err) => {
        const messages = { 1:'Permission denied.', 2:'Location unavailable.', 3:'Timed out.' };
        setQuery(messages[err.code] || 'Could not detect location');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // 🗺️ Map pin confirmed
  const handleMapPin = (picked) => {
    setQuery(picked.label);
    setShowMapPicker(false);
    onChange?.(picked.label, picked.lat, picked.lng);
    onLocationSelect?.({ display_name: picked.label, lat: picked.lat, lng: picked.lng });
  };

  useEffect(() => {
    const handler = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      clearTimeout(debounceTimer.current);
    };
  }, []);

  return (
    <>
      <div className={`location-search ${className}`}>
        <div className="location-input-wrapper">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={placeholder}
            className="location-input"
            onFocus={() => query.length >= 2 && setShowSuggestions(true)}
          />

          {/* 📍 Auto-detect button */}
          <button
            type="button"
            onClick={handleGeolocation}
            className={`geo-button ${geoLoading ? 'geo-loading' : ''}`}
            title="Detect my location automatically"
            disabled={geoLoading}
            style={{minWidth:40, justifyContent:'center'}}>
            {geoLoading ? '⟳' : '📍'}
          </button>

          {/* 🗺️ Pin on map button */}
          <button
            type="button"
            onClick={() => { setShowSuggestions(false); setShowMapPicker(true); }}
            className="geo-button"
            title="Drop pin on map to select location"
            style={{minWidth:40, justifyContent:'center'}}>
            🗺️
          </button>

          {loading && <div className="search-spinner">⟳</div>}
        </div>

        {showSuggestions && (
          <div className="location-suggestions" ref={suggestionsRef}>
            {loading ? (
              <div className="suggestion-loading">
                <div className="loading-spinner" /><span>Searching locations...</span>
              </div>
            ) : suggestions.length > 0 ? (
              suggestions.map((s, i) => (
                <div key={i} className="suggestion-item" onClick={() => handleSelect(s)}>
                  <div className="suggestion-icon">📍</div>
                  <div className="suggestion-body">
                    <div className="suggestion-main">{s.display_name || s.label}</div>
                  </div>
                </div>
              ))
            ) : query.length >= 2 ? (
              <div className="suggestion-empty">
                <div className="suggestion-empty-icon">🔍</div>
                <span>No results for "{query}"</span>
                <small>Try dropping a pin on map 🗺️</small>
              </div>
            ) : (
              <div className="suggestion-empty"><span>Type an area, college, or landmark</span></div>
            )}
          </div>
        )}
      </div>

      {showMapPicker && (
        <MapPicker onSelect={handleMapPin} onClose={() => setShowMapPicker(false)} />
      )}
    </>
  );
}
