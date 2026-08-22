import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ActivityIndicator, Platform,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { colors, radius, spacing } from '../theme';
import * as api from '../services/api';

const DEFAULT_REGION = {
  latitude: 12.9716,
  longitude: 77.5946,
  latitudeDelta: 0.025,
  longitudeDelta: 0.025,
};

export default function MapPickerModal({ visible, onClose, onSelect, initialLocation, title = 'Drop Pin on Map' }) {
  const mapRef = useRef(null);
  const [selectedCoord, setSelectedCoord] = useState(null);
  const [addressLabel,  setAddressLabel]  = useState('');
  const [geocoding,     setGeocoding]     = useState(false);
  const [locating,      setLocating]      = useState(false);
  const debounceTimer = useRef(null);

  const fetchAddress = useCallback((lat, lng) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setGeocoding(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await api.reverseGeocode(lat, lng);
        const name = res?.label || res?.display_name || res?.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setAddressLabel(name);
      } catch {
        setAddressLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } finally {
        setGeocoding(false);
      }
    }, 400);
  }, []);

  // Initialize position on open
  useEffect(() => {
    if (!visible) return;

    if (initialLocation?.lat && initialLocation?.lng) {
      const lat = parseFloat(initialLocation.lat);
      const lng = parseFloat(initialLocation.lng);
      setSelectedCoord({ latitude: lat, longitude: lng });
      setAddressLabel(initialLocation.label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      mapRef.current?.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 500);
    } else {
      locateUser();
    }
  }, [visible]);

  const locateUser = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const fallback = { latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude };
        setSelectedCoord(fallback);
        fetchAddress(fallback.latitude, fallback.longitude);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setSelectedCoord(coord);
      fetchAddress(coord.latitude, coord.longitude);
      mapRef.current?.animateToRegion({
        ...coord,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      }, 600);
    } catch {
      const fallback = { latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude };
      setSelectedCoord(fallback);
      fetchAddress(fallback.latitude, fallback.longitude);
    } finally {
      setLocating(false);
    }
  };

  const handleMapPress = (e) => {
    const coord = e.nativeEvent.coordinate;
    if (!coord) return;
    setSelectedCoord(coord);
    fetchAddress(coord.latitude, coord.longitude);
  };

  const handleMarkerDragEnd = (e) => {
    const coord = e.nativeEvent.coordinate;
    if (!coord) return;
    setSelectedCoord(coord);
    fetchAddress(coord.latitude, coord.longitude);
  };

  const handleConfirm = () => {
    if (!selectedCoord) return;
    const finalLabel = addressLabel.trim() || `${selectedCoord.latitude.toFixed(5)}, ${selectedCoord.longitude.toFixed(5)}`;
    onSelect({
      label: finalLabel,
      lat: selectedCoord.latitude.toString(),
      lng: selectedCoord.longitude.toString(),
    });
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle} numberOfLines={1}>{title}</Text>
          <TouchableOpacity onPress={locateUser} disabled={locating} style={styles.gpsBtn} activeOpacity={0.7}>
            {locating ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={{ fontSize: 16 }}>📍 GPS</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Interactive Map */}
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={DEFAULT_REGION}
            onPress={handleMapPress}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {selectedCoord && (
              <Marker
                coordinate={selectedCoord}
                draggable
                onDragEnd={handleMarkerDragEnd}
                title="Selected Location"
                description={addressLabel}
              >
                <View style={styles.customPin}>
                  <View style={styles.pinBubble}>
                    <Text style={{ fontSize: 20 }}>📍</Text>
                  </View>
                  <View style={styles.pinDot} />
                </View>
              </Marker>
            )}
          </MapView>

          {/* Hint Overlay */}
          <View style={styles.hintBadge}>
            <Text style={styles.hintText}>👆 Tap anywhere on map or drag pin to adjust</Text>
          </View>
        </View>

        {/* Bottom Details & Confirm Card */}
        <View style={styles.bottomCard}>
          <View style={styles.addressRow}>
            <View style={styles.addrIcon}>
              <Text style={{ fontSize: 18 }}>📍</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addrLabel}>Selected Location</Text>
              {geocoding ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <ActivityIndicator color={colors.accent} size="small" />
                  <Text style={{ color: colors.text3, fontSize: 12 }}>Resolving address…</Text>
                </View>
              ) : (
                <Text style={styles.addrText} numberOfLines={2}>
                  {addressLabel || 'Tap on map to select a point'}
                </Text>
              )}
              {selectedCoord && (
                <Text style={styles.coordSub}>
                  {selectedCoord.latitude.toFixed(5)}, {selectedCoord.longitude.toFixed(5)}
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, (!selectedCoord || geocoding) && { opacity: 0.6 }]}
            onPress={handleConfirm}
            disabled={!selectedCoord || geocoding}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmBtnText}>📍 Confirm This Location</Text>
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeBtnText: { color: colors.text2, fontSize: 12, fontWeight: '700' },
  topBarTitle: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  gpsBtn: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent,
  },

  mapWrap: { flex: 1, position: 'relative' },
  hintBadge: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(7,9,13,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hintText: { color: colors.accent, fontSize: 11, fontWeight: '600' },

  customPin: { alignItems: 'center', justifyContent: 'center' },
  pinBubble: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 4,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  pinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: -2,
  },

  bottomCard: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  addrIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.accentDim,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.accent,
  },
  addrLabel: { color: colors.text3, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  addrText: { color: colors.text, fontSize: 13, fontWeight: '600', marginTop: 2, lineHeight: 18 },
  coordSub: { color: colors.text3, fontSize: 10, marginTop: 2 },

  confirmBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: { color: '#000', fontSize: 14, fontWeight: '800' },
});
