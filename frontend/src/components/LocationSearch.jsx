import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as api from '../services/api.js';
import './LocationSearch.css';

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

  const suggestionsRef = useRef(null);
  const debounceTimer  = useRef(null);
  useEffect(() => {
  setQuery(value || '');
}, [value]);

  // ── Debounced search ──────────────────────────────────────────
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

  // ── Select from dropdown ──────────────────────────────────────
  const handleSelect = (location) => {

  const fullAddress =
    location.display_name ||
    location.label ||
    'Selected Location';

  setQuery(fullAddress);

  setShowSuggestions(false);

  setSuggestions([]);

  onChange?.(
    fullAddress,
    location.lat,
    location.lng
  );

  onLocationSelect?.({
    ...location,
    label: fullAddress
  });

};

  // ── GPS detect ────────────────────────────────────────────────
  const handleGeolocation = () => {
  if (!navigator.geolocation) {
    alert('Geolocation not supported');
    return;
  }

  let isMounted = true; // unmount guard
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
        const finalAddress =
          address && address !== 'Unknown Location'
            ? address
            : `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;

        setQuery(finalAddress);
        onChange?.(finalAddress, lat, lng);
        onLocationSelect?.({ display_name: finalAddress, lat, lng });
      } catch (err) {
        if (!isMounted) return;
        console.error('Reverse geocode failed:', err);
        setQuery('Unable to detect location');
      } finally {
        if (isMounted) setGeoLoading(false); // ✅ Always stops spinner on success or error
      }
    },
    (err) => {
      if (!isMounted) return;
      const messages = {
        1: 'Location permission denied. Please allow location access.',
        2: 'Location unavailable. Try searching manually.',
        3: 'Location request timed out. Try again.',
      };
      setQuery(messages[err.code] || 'Could not detect location');
      setGeoLoading(false); // ✅ Always stops spinner on geolocation error
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );

  // cleanup for unmount
  return () => { isMounted = false; };
};

  // ── Close on outside click ────────────────────────────────────
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
        <button
          type="button"
          onClick={handleGeolocation}
          className={`geo-button ${geoLoading ? 'geo-loading' : ''}`}
          title="Use my current location"
          disabled={geoLoading}
        >
          {geoLoading ? '⟳' : '📍'}
        </button>
        {loading && <div className="search-spinner">⟳</div>}
      </div>

      {showSuggestions && (
        <div className="location-suggestions" ref={suggestionsRef}>
          {loading ? (
            <div className="suggestion-loading">
              <div className="loading-spinner" />
              <span>Searching locations...</span>
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((s, i) => {
              const main =
              s.display_name ||
              s.label;

              const sub = null;
              return (
                <div key={i} className="suggestion-item" onClick={() => handleSelect(s)}>
                  <div className="suggestion-icon">📍</div>
                  <div className="suggestion-body">
                    <div className="suggestion-main">{main}</div>
                    {/*{sub && sub !== main && <div className="suggestion-sub">{sub}</div>}*/}
                  </div>
                </div>
              );
            })
          ) : query.length >= 2 ? (
            <div className="suggestion-empty">
              <div className="suggestion-empty-icon">🔍</div>
              <span>No results for "{query}"</span>
              <small>Try: area name, college, landmark, or full address</small>
            </div>
          ) : (
            <div className="suggestion-empty">
              <span>Type an area, college, or landmark</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
