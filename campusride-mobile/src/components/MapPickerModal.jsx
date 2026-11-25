// campusride-mobile/src/components/MapPickerModal.jsx
// Smooth native MapLibre + OpenStreetMap location picker modal with search, tap-to-pin,
// reverse geocoding, stale-request cancellation, and recenter-to-GPS controls.
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ActivityIndicator, Platform, ScrollView, Keyboard,
} from 'react-native';
import * as Location from 'expo-location';
import LiveMapView from './LiveMapView';
import { colors, radius, spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';
import * as api from '../services/api';

const POPULAR_CAMPUS_SPOTS = [
  'Christ University Bengaluru',
  'RNSIT Campus Gate',
  'RV College of Engineering',
  'BMS College of Engineering',
  'PES University Ring Road',
  'Majestic Bus & Metro Station',
  'MG Road Metro Station',
  'Koramangala Sony World',
  'Indiranagar 100 Feet Road',
];

export default function MapPickerModal({ visible, onClose, onSelect, initialLocation, title = 'Pick Campus Location' }) {
  const { isDark } = useTheme();
  const [addressLabel,  setAddressLabel]  = useState('');
  const [coords,        setCoords]        = useState(null);
  const [locating,      setLocating]      = useState(false);
  const [searching,     setSearching]     = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError,   setSearchError]   = useState('');
  const [query,         setQuery]         = useState('');

  const debounceSearchRef = useRef(null);
  const searchAbortRef = useRef(null);
  const searchSeqRef = useRef(0);

  const debounceReverseGeoRef = useRef(null);
  const reverseAbortRef = useRef(null);
  const reverseSeqRef = useRef(0);

  useEffect(() => {
    if (!visible) return;
    if (initialLocation?.lat && initialLocation?.lng) {
      setAddressLabel(initialLocation.label || 'Selected Location');
      setCoords({
        lat: parseFloat(initialLocation.lat),
        lng: parseFloat(initialLocation.lng),
      });
    } else if (initialLocation?.label) {
      setAddressLabel(initialLocation.label);
      locateUser();
    } else {
      locateUser();
    }
    return () => {
      if (debounceSearchRef.current) clearTimeout(debounceSearchRef.current);
      if (debounceReverseGeoRef.current) clearTimeout(debounceReverseGeoRef.current);
      if (searchAbortRef.current) searchAbortRef.current.abort();
      if (reverseAbortRef.current) reverseAbortRef.current.abort();
    };
  }, [visible]);

  const locateUser = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const fallback = { lat: 12.9716, lng: 77.5946 };
        setCoords(fallback);
        setAddressLabel(prev => prev || 'Bengaluru Central');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setCoords({ lat, lng });

      try {
        const res = await api.reverseGeocode(lat, lng);
        const name = res?.display_name || res?.label || 'Current Location';
        setAddressLabel(name);
      } catch {
        setAddressLabel('Current Location');
      }
    } catch {
      setCoords(prev => prev || { lat: 12.9716, lng: 77.5946 });
      setAddressLabel(prev => prev || 'Bengaluru Central');
    } finally {
      setLocating(false);
    }
  };

  const handleMapClick = ({ lat, lng }) => {
    Keyboard.dismiss();
    setCoords({ lat, lng });
    if (debounceReverseGeoRef.current) clearTimeout(debounceReverseGeoRef.current);
    if (reverseAbortRef.current) {
      reverseAbortRef.current.abort();
      reverseAbortRef.current = null;
    }

    const seq = ++reverseSeqRef.current;
    debounceReverseGeoRef.current = setTimeout(async () => {
      const controller = new AbortController();
      reverseAbortRef.current = controller;
      try {
        const res = await api.reverseGeocode(lat, lng, controller.signal);
        if (seq !== reverseSeqRef.current) return;
        const name = res?.display_name || res?.label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setAddressLabel(name);
      } catch (err) {
        if (err?.isAborted || err?.name === 'AbortError' || seq !== reverseSeqRef.current) return;
        setAddressLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    }, 300);
  };

  const handleSearch = (text) => {
    setQuery(text);
    setSearchError('');
    if (debounceSearchRef.current) clearTimeout(debounceSearchRef.current);
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
      searchAbortRef.current = null;
    }

    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const seq = ++searchSeqRef.current;
    setSearching(true);
    debounceSearchRef.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbortRef.current = controller;
      try {
        const results = await api.searchLocation(trimmed, controller.signal, coords);
        if (seq !== searchSeqRef.current) return;
        const list = Array.isArray(results) ? results : results?.results || [];
        setSearchResults(list);
      } catch (err) {
        if (err?.isAborted || err?.name === 'AbortError' || seq !== searchSeqRef.current) return;
        setSearchResults([]);
        setSearchError('Search service unreachable. Tap directly on the map to pick a location.');
      } finally {
        if (seq === searchSeqRef.current) setSearching(false);
      }
    }, 350);
  };

  const selectSpot = async (spotName) => {
    setQuery(spotName);
    setSearching(true);
    setSearchError('');
    try {
      const results = await api.searchLocation(spotName, null, coords);
      const list = Array.isArray(results) ? results : [];
      if (list.length > 0) {
        selectSearchResult(list[0]);
      } else {
        setAddressLabel(spotName);
      }
    } catch {
      setAddressLabel(spotName);
    } finally {
      setSearching(false);
    }
  };

  const selectSearchResult = (item) => {
    Keyboard.dismiss();
    const label = item.display_name || item.properties?.display_name || item.label || item.name;
    let lat = item.lat ?? item.latitude;
    let lng = item.lng ?? item.lon ?? item.longitude;
    if ((lat == null || lng == null) && Array.isArray(item.geometry?.coordinates)) {
      lng = item.geometry.coordinates[0];
      lat = item.geometry.coordinates[1];
    }
    setAddressLabel(label);
    if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      setCoords({ lat: Number(lat), lng: Number(lng) });
    }
    setSearchResults([]);
    setSearchError('');
    setQuery('');
  };

  const handleConfirm = () => {
    if (!addressLabel.trim() || !coords) return;
    onSelect({
      label: addressLabel.trim(),
      lat: coords.lat.toString(),
      lng: coords.lng.toString(),
    });
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]}>
        {/* Top Header */}
        <View style={[styles.topBar, { backgroundColor: isDark ? colors.surface : '#ffffff', borderBottomColor: isDark ? colors.border : '#e2e8f0' }]}>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: isDark ? colors.surface2 : '#f1f5f9' }]} activeOpacity={0.7}>
            <Text style={[styles.closeBtnText, { color: isDark ? colors.text2 : '#475569' }]}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: isDark ? colors.text : '#0f172a' }]} numberOfLines={1}>{title}</Text>
          <TouchableOpacity onPress={locateUser} style={styles.gpsBtn} activeOpacity={0.7} disabled={locating}>
            {locating ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={{ color: colors.accent, fontSize: 11.5, fontWeight: '800' }}>🎯 GPS</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Input + Quick Results (outside ScrollView so native Map gestures never conflict) */}
        <View style={styles.searchSection}>
          <View style={[styles.searchBox, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#cbd5e1' }]}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
            <TextInput
              style={[styles.input, { color: isDark ? colors.text : '#0f172a' }]}
              value={query}
              onChangeText={handleSearch}
              placeholder="Search Christ University, landmark, street..."
              placeholderTextColor={colors.text3}
              autoCorrect={false}
            />
            {query.length > 0 && !searching && (
              <TouchableOpacity onPress={() => { setQuery(''); setSearchResults([]); setSearchError(''); }} style={{ padding: 4 }}>
                <Text style={{ color: colors.text3, fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            )}
            {searching && <ActivityIndicator color={colors.accent} size="small" />}
          </View>

          {searchResults.length > 0 ? (
            <ScrollView
              style={[styles.resultsBox, { maxHeight: 190, backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#e2e8f0' }]}
              keyboardShouldPersistTaps="handled"
            >
              {searchResults.slice(0, 6).map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.resultItem, { borderBottomColor: isDark ? colors.border : '#f1f5f9' }]}
                  onPress={() => selectSearchResult(item)}
                >
                  <Text style={{ fontSize: 14 }}>📍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.resultTitle, { color: isDark ? colors.text : '#0f172a' }]} numberOfLines={1}>
                      {item.label || item.display_name?.split(',')[0]}
                    </Text>
                    <Text style={[styles.resultSub, { color: isDark ? colors.text3 : '#64748b' }]} numberOfLines={1}>
                      {item.display_name || item.formatted}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (!searching && (query.trim().length >= 2 || searchError)) ? (
            <View style={[styles.resultsBox, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#e2e8f0', padding: 10 }]}>
              <Text style={{ color: searchError ? '#ef4444' : colors.text3, fontSize: 12.5, textAlign: 'center' }}>
                {searchError || `No locations found for "${query}". Tap anywhere on the map to set your pin.`}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Native MapLibre Map Canvas (isolated from any ScrollView for effortless pan & pinch-zoom) */}
        <View style={styles.mapSection}>
          <LiveMapView
            pinLocation={coords}
            onMapClick={handleMapClick}
            onRecenter={locateUser}
            height={300}
            interactive={true}
            inModal={true}
            style={{ flex: 1, height: '100%' }}
          />
        </View>

        {/* Selected Location Card + Quick Campus Chips + Bottom Confirm */}
        <View style={[styles.footerPanel, { backgroundColor: isDark ? colors.surface : '#ffffff', borderTopColor: isDark ? colors.border : '#e2e8f0' }]}>
          <View style={styles.selectedRow}>
            <TouchableOpacity style={styles.pinCircle} onPress={locateUser} activeOpacity={0.7}>
              <Text style={{ fontSize: 18 }}>📍</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHeader}>TAP MAP OR SEARCH TO PLACE PIN</Text>
              <Text style={[styles.selectedAddress, { color: isDark ? colors.text : '#0f172a' }]} numberOfLines={2}>
                {addressLabel || 'Locating...'}
              </Text>
              {coords && (
                <Text style={[styles.coordSub, { color: isDark ? colors.text3 : '#64748b' }]}>
                  GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </Text>
              )}
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.spotsRow}>
            {POPULAR_CAMPUS_SPOTS.map((spot, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.spotChip, { backgroundColor: isDark ? colors.surface2 : '#f1f5f9', borderColor: isDark ? colors.border : '#cbd5e1' }]}
                onPress={() => selectSpot(spot)}
                activeOpacity={0.7}
              >
                <Text style={[styles.spotText, { color: isDark ? colors.text2 : '#475569' }]}>{spot}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.confirmBtn, (!addressLabel || !coords) && { opacity: 0.5 }]}
            onPress={handleConfirm}
            disabled={!addressLabel || !coords}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmBtnText}>
              ✓ Confirm "{addressLabel.slice(0, 26)}{addressLabel.length > 26 ? '...' : ''}"
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 48 : 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  closeBtnText: { fontSize: 12, fontWeight: '700' },
  topBarTitle: { fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  gpsBtn: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent,
    minWidth: 64,
    alignItems: 'center',
  },
  searchSection: {
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    zIndex: 20,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 6,
  },
  input: { flex: 1, fontSize: 13.5 },
  resultsBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  resultTitle: { fontSize: 13.5, fontWeight: '700' },
  resultSub: { fontSize: 11.5, marginTop: 1 },
  mapSection: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginVertical: 8,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  footerPanel: {
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    borderTopWidth: 1,
    gap: 10,
  },
  cardHeader: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAddress: { fontSize: 13.5, fontWeight: '700' },
  coordSub: { fontSize: 11, marginTop: 2 },
  spotsRow: { gap: 8, paddingVertical: 2 },
  spotChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  spotText: { fontSize: 11.5, fontWeight: '600' },
  confirmBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: { color: '#000', fontSize: 14, fontWeight: '800' },
});
