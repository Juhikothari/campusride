// campusride-mobile/src/components/LocationSearch.jsx
// Debounced OpenStreetMap/Photon autocomplete search with stale-request cancellation,
// empty/error handling, current GPS detection, and native MapLibre MapPickerModal.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert as RNAlert,
} from 'react-native';
import * as Location from 'expo-location';
import { colors, radius, spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';
import * as api from '../services/api';
import MapPickerModal from './MapPickerModal';

function getCompleteAddress(item) {
  if (!item) return '';
  if (typeof item === 'string') return item;
  const full = item.display_name || item.properties?.display_name || item.formatted || item.label || item.name || '';
  const parts = full.split(',').map(s => s.trim()).filter(Boolean);
  const filtered = parts.filter(p => !/^\d{5,6}$/.test(p) && p.toLowerCase() !== 'india');
  return filtered.length > 0 ? filtered.join(', ') : full;
}

function extractLngLat(item) {
  if (!item) return { lat: '', lng: '' };
  if (Array.isArray(item.geometry?.coordinates) && item.geometry.coordinates.length >= 2) {
    return {
      lng: String(item.geometry.coordinates[0]),
      lat: String(item.geometry.coordinates[1]),
    };
  }
  const lat = item.lat ?? item.latitude ?? '';
  const lng = item.lng ?? item.lon ?? item.longitude ?? '';
  return { lat: lat !== '' ? String(lat) : '', lng: lng !== '' ? String(lng) : '' };
}

async function fetchDirectOsmFallback(queryText, signal) {
  const photonUrl =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(queryText)}&limit=8&lat=12.9716&lon=77.5946&location_bias_scale=0.1&lang=en`;
  try {
    const resp = await fetch(photonUrl, { signal });
    if (resp.ok) {
      const text = await resp.text();
      if (text && !text.trim().startsWith('<')) {
        const json = JSON.parse(text);
        if (Array.isArray(json?.features) && json.features.length > 0) {
          return json.features
            .filter(f => Array.isArray(f?.geometry?.coordinates) && f.geometry.coordinates.length >= 2)
            .map(place => {
              const p = place.properties || {};
              const [lng, lat] = place.geometry.coordinates;
              const parts = [p.name, p.street, p.district || p.suburb, p.city || p.town || p.village, p.state].filter(Boolean);
              const uniq = [...new Set(parts)];
              return { label: p.name || p.street || uniq[0] || queryText, display_name: uniq.join(', '), lat, lng };
            });
        }
      }
    }
  } catch (e) {
    if (e?.name === 'AbortError' || signal?.aborted) throw e;
  }

  const nomUrl =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${queryText}, Bengaluru`)}&format=jsonv2&limit=6&countrycodes=in`;
  const nomResp = await fetch(nomUrl, { headers: { 'User-Agent': 'HOGO-CampusRide/1.1' }, signal });
  if (!nomResp.ok) throw new Error('Location fallback unavailable');
  const nomData = await nomResp.json();
  return Array.isArray(nomData)
    ? nomData.map(item => ({
        label: item.name || item.display_name?.split(',')[0] || queryText,
        display_name: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      })).filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng))
    : [];
}

export default function LocationSearch({ value, coordinates, onChange, placeholder, label }) {
  const { isDark } = useTheme();
  const [query,       setQuery]       = useState(value || '');
  const [results,     setResults]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [searchError, setSearchError] = useState('');
  const [detecting,   setDetecting]   = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showMap,     setShowMap]     = useState(false);
  const debounceRef = useRef(null);
  const abortCtrlRef = useRef(null);
  const reqSeqRef = useRef(0);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortCtrlRef.current) abortCtrlRef.current.abort();
    };
  }, []);

  const search = useCallback((text) => {
    setQuery(text);
    setSearchError('');
    if (onChange) onChange(text, '', '');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
      abortCtrlRef.current = null;
    }

    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setShowResults(false);
      setLoading(false);
      return;
    }

    const seq = ++reqSeqRef.current;
    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortCtrlRef.current = controller;
      try {
        let data = null;
        try {
          data = await api.searchLocation(trimmed, controller.signal, { lat: 12.9716, lng: 77.5946 });
        } catch (backendErr) {
          if (backendErr?.isAborted || backendErr?.name === 'AbortError' || controller.signal.aborted) {
            throw backendErr;
          }
          // Fall back cleanly to direct OpenStreetMap search if Render backend is waking up or rate-limited
          data = await fetchDirectOsmFallback(trimmed, controller.signal);
        }
        if (seq !== reqSeqRef.current) return; // Discard stale response
        const list = Array.isArray(data) ? data.slice(0, 6) : [];
        setResults(list);
        setShowResults(true);
      } catch (err) {
        if (err?.isAborted || err?.name === 'AbortError' || seq !== reqSeqRef.current) return;
        setResults([]);
        setSearchError('Unable to fetch places right now. Try pinning on the map.');
        setShowResults(true);
      } finally {
        if (seq === reqSeqRef.current) {
          setLoading(false);
        }
      }
    }, 350);
  }, [onChange]);

  const select = (item) => {
    const lbl = getCompleteAddress(item);
    const { lat, lng } = extractLngLat(item);
    setQuery(lbl);
    setResults([]);
    setSearchError('');
    setShowResults(false);
    onChange(lbl, lat, lng);
  };

  const handleDetectLocation = async () => {
    setDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        RNAlert.alert('Permission Required', 'Location permission is required to detect your current position.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      const res = await api.reverseGeocode(lat, lng).catch(() => null);
      const lbl = getCompleteAddress(res) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setQuery(lbl);
      setResults([]);
      setSearchError('');
      setShowResults(false);
      onChange(lbl, lat.toString(), lng.toString());
    } catch {
      RNAlert.alert('Location Error', 'Could not detect location. Please check GPS permissions or search manually.');
    } finally {
      setDetecting(false);
    }
  };

  const handleMapSelect = (picked) => {
    setQuery(picked.label);
    setResults([]);
    setSearchError('');
    setShowResults(false);
    onChange(picked.label, picked.lat, picked.lng);
  };

  const clear = () => {
    reqSeqRef.current++;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortCtrlRef.current) abortCtrlRef.current.abort();
    setQuery('');
    setResults([]);
    setSearchError('');
    setShowResults(false);
    setLoading(false);
    onChange('', '', '');
  };

  const initialMapLoc = (value && coordinates?.lat && coordinates?.lng)
    ? { label: value, lat: coordinates.lat, lng: coordinates.lng }
    : (value ? { label: value } : null);

  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && <Text style={[styles.label, { color: isDark ? colors.text2 : '#475569' }]}>{label}</Text>}

      <View style={[styles.inputWrap, { backgroundColor: isDark ? colors.surface2 : '#ffffff', borderColor: isDark ? colors.border : '#cbd5e1' }]}>
        <TextInput
          style={[styles.input, { color: isDark ? '#edf0f7' : '#0f172a' }]}
          value={query}
          onChangeText={search}
          placeholder={placeholder || 'Search area, landmark, campus…'}
          placeholderTextColor={isDark ? '#8b96b0' : '#64748b'}
          cursorColor="#f5a623"
          selectionColor="rgba(245,166,35,0.3)"
          autoCorrect={false}
          autoCapitalize="none"
          onFocus={() => query.trim().length >= 2 && results.length > 0 && setShowResults(true)}
        />

        {query.length > 0 && !loading && (
          <TouchableOpacity onPress={clear} style={styles.iconBtn} activeOpacity={0.7}>
            <Text style={{ color: isDark ? colors.text3 : '#64748b', fontSize: 15 }}>✕</Text>
          </TouchableOpacity>
        )}

        {loading && <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 6 }} />}

        <TouchableOpacity
          onPress={handleDetectLocation}
          disabled={detecting}
          style={[styles.actionBtn, { backgroundColor: isDark ? colors.surface : '#f1f5f9', borderColor: isDark ? colors.border : '#cbd5e1' }, detecting && { opacity: 0.6 }]}
          activeOpacity={0.7}
        >
          {detecting ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={styles.actionBtnIcon}>📍</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowMap(true)}
          style={[styles.actionBtn, { backgroundColor: isDark ? colors.surface : '#f1f5f9', borderColor: isDark ? colors.border : '#cbd5e1' }]}
          activeOpacity={0.7}
        >
          <Text style={styles.actionBtnIcon}>🗺️</Text>
        </TouchableOpacity>
      </View>

      {/* Autocomplete Results / Empty / Error Dropdown */}
      {showResults && !loading && (
        <View style={[styles.dropdown, { backgroundColor: isDark ? colors.surface2 : '#ffffff', borderColor: isDark ? colors.border : '#cbd5e1' }]}>
          {results.length > 0 ? (
            results.map((item, idx) => {
              const displayName = getCompleteAddress(item);
              const primaryName = item.label || displayName.split(',')[0];
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.resultItem, idx < results.length - 1 && styles.resultBorder]}
                  onPress={() => select(item)}
                >
                  <Text style={styles.resultIcon}>📍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.resultTitle, { color: isDark ? colors.text : '#0f172a' }]} numberOfLines={1}>{primaryName}</Text>
                    {displayName !== primaryName && (
                      <Text style={[styles.resultSub, { color: isDark ? colors.text3 : '#64748b' }]} numberOfLines={2}>{displayName}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <TouchableOpacity style={styles.emptyResultRow} onPress={() => setShowMap(true)}>
              <Text style={[styles.emptyResultText, { color: searchError ? '#ef4444' : (isDark ? colors.text3 : '#64748b') }]}>
                {searchError || `No places found for "${query.trim()}". Tap here to pick on map 🗺️`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <MapPickerModal
        visible={showMap}
        onClose={() => setShowMap(false)}
        onSelect={handleMapSelect}
        initialLocation={initialMapLoc}
        title={`Pin ${label || 'Location'} on Map`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingLeft: 12,
    paddingRight: 4,
    height: 48,
  },
  input: {
    flex: 1,
    color: colors.text,
    paddingVertical: 10,
    fontSize: 13.5,
  },
  iconBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  actionBtnIcon: { fontSize: 16 },
  dropdown: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginTop: 4,
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  resultBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultIcon: { fontSize: 14 },
  resultTitle: { fontSize: 13.5, fontWeight: '700' },
  resultSub: { fontSize: 11.5, marginTop: 2, lineHeight: 15 },
  emptyResultRow: { padding: 12, alignItems: 'center' },
  emptyResultText: { fontSize: 12.5, textAlign: 'center', fontWeight: '600' },
});
