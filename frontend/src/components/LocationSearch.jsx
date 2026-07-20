import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as api from '../services/api.js';
import './LocationSearch.css';

// Mini map picker modal using Leaflet
function MapPicker({ onSelect, onClose }) {
  const mapRef    = useRef(null);
  const mapObjRef = useRef(null);
  const markerRef = useRef(null);
  const [picked,  setPicked] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load Leaflet lazily
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
    return () => { if (mapObjRef.current) { mapObjRef.current.remove(); mapObjRef.current = null; } };
  }, []);

  const initMap = () => {
    if (!mapRef.current || mapObjRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current).setView([12.9716, 77.5946], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18,
    }).addTo(map);

    // Try to get user location
    navigator.geolocation?.getCurrentPosition(pos => {
      map.setView([pos.coords.latitude, pos.coords.longitude], 15);
    });

    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker([lat, lng]).addTo(map);
      setLoading(true);
      try {
        const place = await api.reverseGeocode(lat, lng);
        const label = place?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setPicked({ lat, lng, label });
        markerRef.current.bindPopup(label).openPopup();
      } catch {
        const label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setPicked({ lat, lng, label });
      } finally {
        setLoading(false);
      }
    });
    mapObjRef.current = map;
  };

  return (
    <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'#141720',borderRadius:16,width:'min(90vw,540px)',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}}>
        <div style={{padding:'14px 18px',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontWeight:700,color:'#fff',fontSize:15}}>📍 Pin your location</div>
            <div style={{fontSize:12,color:'#888',marginTop:2}}>Tap anywhere on the map to select</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#888',fontSize:20,cursor:'pointer'}}>✕</button>
        </div>
        <div ref={mapRef} style={{height:340,width:'100%'}} />
        <div style={{padding:'12px 18px',borderTop:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',gap:10}}>
          <div style={{flex:1,fontSize:13,color: picked ? '#fff' : '#555'}}>
            {loading ? '📍 Fetching address…' : picked ? `📍 ${picked.label}` : 'Tap the map to pin a location'}
          </div>
          <button
            disabled={!picked || loading}
            onClick={() => picked && onSelect(picked)}
            style={{background:'#f5a623',color:'#000',border:'none',borderRadius:10,padding:'8px 18px',fontWeight:700,cursor:'pointer',opacity:(!picked||loading)?0.4:1}}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LocationSearch({
  placeholder = 'Search for a location...',
  value = '',
  onChange,
  onLocationSelect,
  className = ''
}) {
  const [query, setQuery]               = useState('');
  const [suggestions, setSuggestions]   = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [geoLoading, setGeoLoading]     = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

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
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
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

  const handleGeolocation = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    let isMounted = true;
    setGeoLoading(true);
    setQuery('Detecting your location…');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (!isMounted) return;
        try {
          const { latitude: lat, longitude: lng } = position.coords;
          const location = await api.reverseGeocode(lat, lng);
          if (!isMounted) return;
          const address = location?.display_name?.trim();
          const finalAddress = address && address !== 'Unknown Location'
            ? address : `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
          setQuery(finalAddress);
          onChange?.(finalAddress, lat, lng);
          onLocationSelect?.({ display_name: finalAddress, lat, lng });
        } catch {
          setQuery('Unable to detect location');
        } finally {
          if (isMounted) setGeoLoading(false);
        }
      },
      (err) => {
        if (!isMounted) return;
        const messages = {
          1: 'Location permission denied.',
          2: 'Location unavailable.',
          3: 'Location timed out.',
        };
        setQuery(messages[err.code] || 'Could not detect location');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => { isMounted = false; };
  };

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
    return () => { document.removeEventListener('mousedown', handler); clearTimeout(debounceTimer.current); };
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
          <button type="button" onClick={handleGeolocation}
            className={`geo-button ${geoLoading ? 'geo-loading' : ''}`}
            title="Use my current location" disabled={geoLoading}>
            {geoLoading ? '⟳' : '📍'}
          </button>
          <button type="button" onClick={() => setShowSuggestions(false) || setShowMapPicker(true)}
            className="geo-button" title="Pin on map" style={{marginLeft:4}}>
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
                <small>Try pinning on map 🗺️</small>
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
