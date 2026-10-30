import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ActivityIndicator, Platform, ScrollView, Linking,
} from 'react-native';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import LiveMapView from './LiveMapView';
import { colors, radius, spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';
import * as api from '../services/api';

const POPULAR_CAMPUS_SPOTS = [
  'Campus Main Gate',
  'Central Library',
  'Boys Hostel Block A',
  'Girls Hostel Block B',
  'Student Activity Center (SAC)',
  'Main Canteen / Food Court',
  'Sports Complex & Ground',
  'Admin Block / Reception',
  'Metro / Bus Station Entrance',
];

export default function MapPickerModal({ visible, onClose, onSelect, initialLocation, title = 'Pick Campus Location' }) {
  const { isDark } = useTheme();
  const [addressLabel,  setAddressLabel]  = useState('');
  const [coords,        setCoords]        = useState(null);
  const [locating,      setLocating]      = useState(false);
  const [searching,     setSearching]     = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [query,         setQuery]         = useState('');
  const [copied,        setCopied]        = useState(false);

  const handleCopyLocation = async () => {
    if (!addressLabel) return;
    try {
      await Clipboard.setStringAsync(addressLabel);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleOpenDirections = () => {
    if (!coords?.lat || !coords?.lng) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => {});
  };

  useEffect(() => {
    if (!visible) return;
    if (initialLocation?.label) {
      setAddressLabel(initialLocation.label);
      if (initialLocation.lat && initialLocation.lng) {
        setCoords({
          lat: parseFloat(initialLocation.lat),
          lng: parseFloat(initialLocation.lng),
        });
      }
    } else {
      locateUser();
    }
  }, [visible]);

  const locateUser = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAddressLabel('Campus Main Gate');
        setCoords({ lat: 12.9716, lng: 77.5946 });
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setCoords({ lat, lng });

      try {
        const res = await api.reverseGeocode(lat, lng);
        const name = res?.label || res?.display_name || res?.address || 'Current Campus Location';
        setAddressLabel(name);
      } catch {
        setAddressLabel('Current Campus Location');
      }
    } catch {
      setAddressLabel('Campus Main Gate');
      setCoords({ lat: 12.9716, lng: 77.5946 });
    } finally {
      setLocating(false);
    }
  };

  const handleMapClick = async ({ lat, lng }) => {
    setCoords({ lat, lng });
    try {
      const res = await api.reverseGeocode(lat, lng);
      const name = res?.label || res?.display_name || res?.address || 'Selected Location';
      setAddressLabel(name);
    } catch {
      setAddressLabel('Selected Location');
    }
  };

  const handleSearch = async (text) => {
    setQuery(text);
    if (!text.trim() || text.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await api.searchLocation(text);
      const list = Array.isArray(results) ? results : results?.results || [];
      setSearchResults(list);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectSpot = (spotName) => {
    setAddressLabel(spotName);
    setSearchResults([]);
    setQuery('');
  };

  const selectSearchResult = (item) => {
    const label = item.label || item.formatted || item.display_name || item.name;
    const lat = item.lat || item.latitude;
    const lng = item.lon || item.lng || item.longitude;
    setAddressLabel(label);
    if (lat && lng) setCoords({ lat: parseFloat(lat), lng: parseFloat(lng) });
    setSearchResults([]);
    setQuery('');
  };

  const handleConfirm = () => {
    if (!addressLabel.trim()) return;
    onSelect({
      label: addressLabel.trim(),
      lat: coords?.lat ? coords.lat.toString() : '12.9716',
      lng: coords?.lng ? coords.lng.toString() : '77.5946',
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
          <TouchableOpacity onPress={locateUser} disabled={locating} style={styles.gpsBtn} activeOpacity={0.7}>
            {locating ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={{ fontSize: 13, color: colors.accent, fontWeight: '700' }}>📍 GPS</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Search Box */}
          <View style={[styles.searchBox, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#cbd5e1' }]}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
            <TextInput
              style={[styles.input, { color: isDark ? colors.text : '#0f172a' }]}
              value={query}
              onChangeText={handleSearch}
              placeholder="Search location, landmark, hostel, gate..."
              placeholderTextColor={colors.text3}
            />
            {searching && <ActivityIndicator color={colors.accent} size="small" />}
          </View>

          {/* Search Dropdown Results */}
          {searchResults.length > 0 && (
            <View style={[styles.resultsBox, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#e2e8f0' }]}>
              {searchResults.slice(0, 5).map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.resultItem}
                  onPress={() => selectSearchResult(item)}
                >
                  <Text style={{ fontSize: 14 }}>📍</Text>
                  <Text style={[styles.resultText, { color: isDark ? colors.text : '#0f172a' }]} numberOfLines={1}>
                    {item.label || item.formatted || item.display_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Interactive Visual Map with Droppable Pin */}
          <View style={{ marginVertical: 10 }}>
            <LiveMapView
              pinLocation={coords}
              onMapClick={handleMapClick}
              height={230}
              interactive={true}
            />
            <Text style={styles.mapHintText}>👆 Tap anywhere on the map or drag pin to adjust location</Text>
          </View>

          {/* Selected Location Banner */}
          <View style={[styles.selectedCard, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#e2e8f0' }]}>
            <Text style={styles.cardHeader}>SELECTED LOCATION</Text>
            <View style={styles.selectedRow}>
              <View style={styles.pinCircle}>
                <Text style={{ fontSize: 18 }}>📍</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.selectedAddress, { color: isDark ? colors.text : '#0f172a' }]}>{addressLabel || 'Locating...'}</Text>
                {coords && (
                  <Text style={[styles.coordSub, { color: isDark ? colors.text3 : '#64748b' }]}>GPS: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</Text>
                )}
              </View>
            </View>

            {/* Action Bar: Detect GPS, Copy Location, and Directions ↗ */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: isDark ? colors.border : '#e2e8f0' }}>
              <TouchableOpacity
                onPress={locateUser}
                disabled={locating}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? colors.surface2 : '#f1f5f9',
                  paddingVertical: 8,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: isDark ? colors.border : '#cbd5e1',
                  gap: 4,
                }}
                activeOpacity={0.7}
              >
                {locating ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <>
                    <Text style={{ fontSize: 13 }}>📍</Text>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: isDark ? colors.text : '#0f172a' }}>Detect GPS</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCopyLocation}
                disabled={!addressLabel}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? colors.surface2 : '#f1f5f9',
                  paddingVertical: 8,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: isDark ? colors.border : '#cbd5e1',
                  gap: 4,
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13 }}>{copied ? '✅' : '📋'}</Text>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: copied ? colors.green : (isDark ? colors.text : '#0f172a') }}>
                  {copied ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleOpenDirections}
                disabled={!coords}
                style={{
                  flex: 1.1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.accent,
                  paddingVertical: 8,
                  borderRadius: radius.md,
                  gap: 4,
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 12 }}>🧭</Text>
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#000000' }}>
                  Directions ↗
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Campus Landmarks */}
          <Text style={[styles.sectionTitle, { color: isDark ? colors.text2 : '#475569' }]}>🏫 QUICK CAMPUS LANDMARKS</Text>
          <View style={styles.spotsGrid}>
            {POPULAR_CAMPUS_SPOTS.map((spot, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.spotChip, { backgroundColor: isDark ? colors.surface2 : '#f1f5f9', borderColor: isDark ? colors.border : '#cbd5e1' }, addressLabel === spot && styles.spotChipActive]}
                onPress={() => selectSpot(spot)}
                activeOpacity={0.7}
              >
                <Text style={[styles.spotText, { color: isDark ? colors.text2 : '#475569' }, addressLabel === spot && styles.spotTextActive]}>
                  {spot}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Bottom Confirm */}
        <View style={[styles.bottomBar, { backgroundColor: isDark ? colors.surface : '#ffffff', borderTopColor: isDark ? colors.border : '#e2e8f0' }]}>
          <TouchableOpacity
            style={[styles.confirmBtn, !addressLabel && { opacity: 0.5 }]}
            onPress={handleConfirm}
            disabled={!addressLabel}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmBtnText}>✓ Confirm "{addressLabel.slice(0, 24)}{addressLabel.length > 24 ? '...' : ''}"</Text>
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
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    backgroundColor: colors.surface2,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  closeBtnText: { color: colors.text2, fontSize: 12, fontWeight: '700' },
  topBarTitle: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },
  gpsBtn: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent,
  },

  scroll: { padding: spacing.md, paddingBottom: 100 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },

  resultsBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultText: {
    color: colors.text,
    fontSize: 13,
    flex: 1,
  },

  mapHintText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },

  selectedCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginVertical: 8,
  },
  cardHeader: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pinCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAddress: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  coordSub: {
    color: colors.text3,
    fontSize: 11,
    marginTop: 2,
  },

  sectionTitle: {
    color: colors.text2,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 8,
  },
  spotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  spotChip: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  spotChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  spotText: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '600',
  },
  spotTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  confirmBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },
});
