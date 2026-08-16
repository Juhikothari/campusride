import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert as RNAlert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { Btn, Alert } from '../components/UI';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';

const { width: SCREEN_W } = Dimensions.get('window');

function fmt(s) {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export default function LiveTrackingScreen({ navigation, route }) {
  const { rideId, bookingId } = route.params || {};
  const { user } = useAuth();

  const [tracking,  setTracking]  = useState(true);
  const [sosSent,   setSosSent]   = useState(false);
  const [sosLoading,setSosLoading]= useState(false);
  const [elapsed,   setElapsed]   = useState(0);
  const [userLat,   setUserLat]   = useState(null);
  const [userLng,   setUserLng]   = useState(null);
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropCoords,   setDropCoords]   = useState(null);
  const [routeCoords,  setRouteCoords]  = useState([]);
  const [rideInfo,     setRideInfo]     = useState(null);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(true);

  const timerRef   = useRef(null);
  const locationRef= useRef(null);
  const mapRef     = useRef(null);

  // Fetch ride info
  useEffect(() => {
    if (!rideId) { setLoading(false); return; }
    api.getRideById(rideId)
      .then(data => {
        const r = data?.ride || data;
        setRideInfo(r);
        if (r?.pickup?.coordinates?.length === 2) {
          const [lng, lat] = r.pickup.coordinates;
          setPickupCoords({ latitude: lat, longitude: lng });
        }
        if (r?.drop?.coordinates?.length === 2) {
          const [lng, lat] = r.drop.coordinates;
          setDropCoords({ latitude: lat, longitude: lng });
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [rideId]);

  // Timer
  useEffect(() => {
    if (!tracking) return;
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [tracking]);

  // GPS tracking
  useEffect(() => {
    if (!tracking) return;
    let sub;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setError('Location permission denied'); return; }

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        loc => {
          const { latitude, longitude } = loc.coords;
          setUserLat(latitude);
          setUserLng(longitude);
          // Report to backend
          if (rideId) {
            api.updateLocation({ rideId, latitude, longitude }).catch(() => {});
          }
        }
      );
    })();
    return () => { sub?.remove?.(); };
  }, [tracking, rideId]);

  const triggerSOS = useCallback(() => {
    RNAlert.alert(
      '🆘 Send SOS Alert',
      'This will alert your emergency contact and platform admins with your live location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS', style: 'destructive',
          onPress: async () => {
            setSosLoading(true);
            try {
              await api.triggerSOS({
                rideId,
                lat: userLat,
                lng: userLng,
                message: 'SOS triggered from live tracking',
              });
              setSosSent(true);
            } catch (e) {
              RNAlert.alert('Error', e.message || 'SOS failed. Call 112 immediately.');
            } finally {
              setSosLoading(false);
            }
          },
        },
      ]
    );
  }, [rideId, userLat, userLng]);

  const stopTracking = () => {
    clearInterval(timerRef.current);
    setTracking(false);
  };

  const mapRegion = userLat && userLng ? {
    latitude: userLat,
    longitude: userLng,
    latitudeDelta:  0.02,
    longitudeDelta: 0.02,
  } : pickupCoords ? {
    latitude: pickupCoords.latitude,
    longitude: pickupCoords.longitude,
    latitudeDelta:  0.05,
    longitudeDelta: 0.05,
  } : {
    latitude:  12.9716,
    longitude: 77.5946,
    latitudeDelta:  0.1,
    longitudeDelta: 0.1,
  };

  if (loading) return (
    <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} /></SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        region={mapRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {/* Live position */}
        {userLat && userLng && (
          <Marker coordinate={{ latitude: userLat, longitude: userLng }} title="You are here">
            <View style={styles.liveMarker}>
              <Text style={{ fontSize: 14 }}>📍</Text>
            </View>
          </Marker>
        )}
        {/* Pickup */}
        {pickupCoords && (
          <Marker coordinate={pickupCoords} title={`Pickup: ${rideInfo?.pickup?.address || ''}`}>
            <View style={[styles.markerDot, { backgroundColor: colors.green }]}>
              <Text style={styles.markerDotText}>A</Text>
            </View>
          </Marker>
        )}
        {/* Drop */}
        {dropCoords && (
          <Marker coordinate={dropCoords} title={`Drop: ${rideInfo?.drop?.address || ''}`}>
            <View style={[styles.markerDot, { backgroundColor: colors.red }]}>
              <Text style={styles.markerDotText}>B</Text>
            </View>
          </Marker>
        )}
        {/* Route line */}
        {pickupCoords && dropCoords && (
          <Polyline
            coordinates={[pickupCoords, ...(userLat && userLng ? [{ latitude: userLat, longitude: userLng }] : []), dropCoords]}
            strokeColor={colors.accent}
            strokeWidth={3}
            lineDashPattern={[8, 4]}
          />
        )}
      </MapView>

      {/* Overlay panel */}
      <View style={styles.panel}>
        {/* Status bar */}
        <View style={styles.statusBar}>
          {tracking && (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
          <View style={styles.timer}>
            <Text style={styles.timerText}>⏱ {fmt(elapsed)}</Text>
          </View>
          {userLat && userLng && (
            <View style={styles.coordPill}>
              <Text style={styles.coordText}>
                {userLat.toFixed(4)}°N, {userLng.toFixed(4)}°E
              </Text>
            </View>
          )}
        </View>

        {/* Ride info */}
        {rideInfo && (
          <View style={styles.rideInfoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rideRouteText} numberOfLines={1}>
                📍 {rideInfo.pickup?.address?.split(',')[0] || 'Pickup'}
              </Text>
              <Text style={styles.rideRouteText} numberOfLines={1}>
                🏁 {rideInfo.drop?.address?.split(',')[0] || 'Drop'}
              </Text>
            </View>
            <Text style={{ color: colors.accent, fontSize: 18, fontWeight: '800' }}>
              ₹{rideInfo.costPerSeat}
            </Text>
          </View>
        )}

        <Alert message={error} />

        {sosSent && (
          <View style={styles.sosSentBanner}>
            <Text style={styles.sosSentText}>🆘 SOS Alert sent! Help is on the way.</Text>
          </View>
        )}

        {/* Buttons */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={[styles.sosBtn, sosSent && { opacity: 0.5 }]}
            onPress={triggerSOS}
            disabled={sosSent || sosLoading}
          >
            {sosLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.sosBtnText}>🆘 SOS</Text>}
          </TouchableOpacity>

          {tracking ? (
            <TouchableOpacity style={styles.stopBtn} onPress={stopTracking}>
              <Text style={styles.stopBtnText}>⏹ Stop Tracking</Text>
            </TouchableOpacity>
          ) : (
            <Btn label="← Back" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
          )}
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('IncidentReport')} style={{ marginTop: 8, alignItems: 'center' }}>
          <Text style={{ color: colors.text3, fontSize: 12 }}>⚠️ Report an incident</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.bg },
  map:   { flex: 1 },

  liveMarker: {
    backgroundColor: colors.accentDim, borderRadius: 20, padding: 6,
    borderWidth: 2, borderColor: colors.accent,
  },
  markerDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  markerDotText: { color: '#000', fontSize: 12, fontWeight: '800' },

  panel: {
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
    padding: spacing.md, paddingBottom: 24,
  },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  livePill:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(45,212,160,0.15)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  liveText:  { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  timer:     { backgroundColor: colors.surface2, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  timerText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  coordPill: { flex: 1, alignItems: 'flex-end' },
  coordText: { color: colors.text3, fontSize: 10 },

  rideInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  rideRouteText: { color: colors.text2, fontSize: 12, marginBottom: 2 },

  sosSentBanner: { backgroundColor: 'rgba(224,85,85,0.15)', borderRadius: radius.md, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.red + '44' },
  sosSentText: { color: colors.red, fontSize: 13, fontWeight: '700', textAlign: 'center' },

  sosBtn:  { flex: 0.4, backgroundColor: colors.red, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  sosBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  stopBtn: { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 13, alignItems: 'center' },
  stopBtnText: { color: colors.text2, fontWeight: '700', fontSize: 14 },
});
