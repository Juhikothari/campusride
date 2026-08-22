import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { colors, radius, spacing } from '../theme';
import * as api from '../services/api';
import MapPickerModal from './MapPickerModal';

export default function LocationSearch({ value, onChange, placeholder, label }) {
  const [query,       setQuery]       = useState(value || '');
  const [results,     setResults]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [detecting,   setDetecting]   = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showMap,     setShowMap]     = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const search = useCallback((text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim() || text.length < 2) { setResults([]); setShowResults(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.searchLocation(text);
        setResults(Array.isArray(data) ? data.slice(0, 6) : []);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  const select = (item) => {
    const lbl = item.label || item.display_name?.split(',').slice(0, 2).join(', ').trim() || item.name || '';
    const lat = item.lat || item.latitude || '';
    const lng = item.lon || item.longitude || item.lng || '';
    setQuery(lbl);
    setResults([]);
    setShowResults(false);
    onChange(lbl, lat.toString(), lng.toString());
  };

  const handleDetectLocation = async () => {
    setDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Location permission is required to detect your location.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      const res = await api.reverseGeocode(lat, lng).catch(() => null);
      const lbl = res?.label || res?.display_name?.split(',').slice(0, 2).join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setQuery(lbl);
      setResults([]);
      setShowResults(false);
      onChange(lbl, lat.toString(), lng.toString());
    } catch {
      alert('Could not detect location. Please check GPS permissions or search manually.');
    } finally {
      setDetecting(false);
    }
  };

  const handleMapSelect = (picked) => {
    setQuery(picked.label);
    setResults([]);
    setShowResults(false);
    onChange(picked.label, picked.lat, picked.lng);
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    onChange('', '', '');
  };

  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={search}
          placeholder={placeholder || 'Search area, landmark, campus…'}
          placeholderTextColor={colors.text3}
          autoCorrect={false}
          autoCapitalize="none"
          onFocus={() => query.length >= 2 && setShowResults(true)}
        />

        {/* Clear Button */}
        {query.length > 0 && !loading && (
          <TouchableOpacity onPress={clear} style={styles.iconBtn} activeOpacity={0.7}>
            <Text style={{ color: colors.text3, fontSize: 15 }}>✕</Text>
          </TouchableOpacity>
        )}

        {/* Search spinner */}
        {loading && <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 6 }} />}

        {/* 📍 Detect Location Button */}
        <TouchableOpacity
          onPress={handleDetectLocation}
          disabled={detecting}
          style={[styles.actionBtn, detecting && { opacity: 0.6 }]}
          title="Detect location automatically"
          activeOpacity={0.7}
        >
          {detecting ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={styles.actionBtnIcon}>📍</Text>
          )}
        </TouchableOpacity>

        {/* 🗺️ Pin on Map Button */}
        <TouchableOpacity
          onPress={() => setShowMap(true)}
          style={styles.actionBtn}
          title="Drop pin on map"
          activeOpacity={0.7}
        >
          <Text style={styles.actionBtnIcon}>🗺️</Text>
        </TouchableOpacity>
      </View>

      {/* Autocomplete Results Dropdown */}
      {showResults && results.length > 0 && (
        <View style={styles.dropdown}>
          {results.map((item, idx) => {
            const displayName = item.label || item.display_name?.split(',').slice(0, 3).join(', ') || item.name || '';
            return (
              <TouchableOpacity key={idx} style={[styles.resultItem, idx < results.length - 1 && styles.resultBorder]} onPress={() => select(item)}>
                <Text style={styles.resultIcon}>📍</Text>
                <Text style={styles.resultText} numberOfLines={2}>{displayName}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Map Picker Modal */}
      <MapPickerModal
        visible={showMap}
        onClose={() => setShowMap(false)}
        onSelect={handleMapSelect}
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
  resultText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 18 },
});
