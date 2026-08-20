import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert as RNAlert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import TopHeader from '../components/TopHeader';
import { Btn, Alert, EmptyState } from '../components/UI';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';

const { width: SCREEN_W } = Dimensions.get('window');

function fmt(s) {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export default function LiveTrackingScreen({ navigation, route }) {
  const { rideId: paramRideId } = route?.params || {};
  const { user } = useAuth();

  const [activeRideId, setActiveRideId] = useState(paramRideId || null);
  const [tracking,     setTracking]     = useState(true);
  const [sosSent,      setSosSent]      = useState(false);
  const [sosLoading,   setSosLoading]   = useState(false);
  const [elapsed,      setElapsed]      = useState(0);
  const [userLat,      setUserLat]      = useState(null);
  const [userLng,      setUserLng]      = useState(null);
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropCoords,   setDropCoords]   = useState(null);
  const [routePolyline, setRoutePolyline] = useState([]);
  const [routeDistance, setRouteDistance] = useState('');
  const [routeDuration, setRouteDuration] = useState('');
  const [rideInfo,     setRideInfo]     = useState(null);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(true);
  const [lookingUp,    setLookingUp]    = useState(!paramRideId);

  const timerRef = useRef(null);
  const mapRef   = useRef(null);

  // 1. Auto-discover active ride if no rideId was passed
  useEffect(() => {
    let isMounted = true;
    if (paramRideId) {
      setActiveRideId(paramRideId);
      setLookingUp(false);
      return;
    }

    const findActiveRide = async () => {
      try {
        setLookingUp(true);
        // Check provider active rides
        const myRides = await api.getMyRides().catch(() => []);
        const activeProviderRide = myRides.find(r => r.status === 'in-progress' || r.status === 'active');
        if (activeProviderRide && isMounted) {
          setActiveRideId(activeProviderRide._id);
          setLookingUp(false);
          return;
        }

        // Check seeker active bookings
        const myBookings = await api.getMyBookings().catch(() => []);
        const activeBooking = myBookings.find(b =>
          b.status === 'accepted' && (b.rideId?.status === 'in-progress' || b.rideId?.status === 'active')
        );
        if (activeBooking?.rideId && isMounted) {
          setActiveRideId(activeBooking.rideId._id || activeBooking.rideId);
          setLookingUp(false);
          return;
        }
      } catch (err) {
        console.log('Error looking up active ride:', err);
      } finally {
        if (isMounted) setLookingUp(false);
      }
    };

    findActiveRide();
    return () => { isMounted = false; };
  }, [paramRideId]);

  // 2. Fetch ride info & calculate optimal route / ETA
  useEffect(() => {
    if (!activeRideId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError('');

    api.getRideById(activeRideId)
      .then(async (data) => {
        if (!isMounted) return;
        const r = data?.ride || data;
        setRideInfo(r);

        let pLat = null, pLng = null, dLat = null, dLng = null;

        if (r?.pickup?.coordinates?.length === 2) {
          const [lng, lat] = r.pickup.coordinates;
          pLat = lat; pLng = lng;
          setPickupCoords({ latitude: lat, longitude: lng });
        }
        if (r?.drop?.coordinates?.length === 2) {
          const [lng, lat] = r.drop.coordinates;
          dLat = lat; dLng = lng;
          setDropCoords({ latitude: lat, longitude: lng });
        }

        // Fetch optimal road route polyline & ETA
        if (pLat && pLng && dLat && dLng) {
          try {
            const routeData = await api.getOptimalRoute(pLat, pLng, dLat, dLng);
            if (isMounted && routeData?.coordinates) {
              setRoutePolyline(routeData.coordinates);
              setRouteDistance(routeData.distanceKm || '');
              setRouteDuration(routeData.durationMin ? `${routeData.durationMin} mins` : '');
            }
          } catch (routeErr) {
            // Fallback straight line
            if (isMounted) {
              setRoutePolyline([
                { latitude: pLat, longitude: pLng },
                { latitude: dLat, longitude: dLng },
              ]);
            }
          }
        }
      })
      .catch(e => {
        if (isMounted) setError(e.message || 'Could not load ride tracking');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [activeRideId]);

  // 3. Timer for elapsed duration
  useEffect(() => {
    if (!tracking) return;
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [tracking]);

  // 4. GPS tracking & location reporting
  useEffect(() => {
    if (!tracking) return;
    let sub;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 10 },
          loc => {
            const { latitude, longitude } = loc.coords;
            setUserLat(latitude);
            setUserLng(longitude);
            if (activeRideId) {
              api.updateLocation({ rideId: activeRideId, latitude, longitude }).catch(() => {});
            }
          }
        );
      } catch (e) {
        console.log('Location watch error:', e);
      }
    })();
    return () => { sub?.remove?.(); };
  }, [tracking, activeRideId]);

  const triggerSOS = useCallback(() => {
    RNAlert.alert(
      '🆘 Send SOS Alert',
      'This will instantly alert campus security, emergency contacts, and support with your exact live location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS', style: 'destructive',
          onPress: async () => {
            setSosLoading(true);
            try {
              await api.triggerSOS({
                rideId: activeRideId,
                lat: userLat,
                lng: userLng,
                message: 'Emergency SOS triggered from HOGO live tracking',
              });
              setSosSent(true);
            } catch (e) {
              RNAlert.alert('Error', e.message || 'SOS failed. Please call 112 immediately.');
            } finally {
              setSosLoading(false);
            }
          },
        },
      ]
    );
  }, [activeRideId, userLat, userLng]);

  const mapRegion = userLat && userLng ? {
    latitude: userLat,
    longitude: userLng,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  } : pickupCoords ? {
    latitude: pickupCoords.latitude,
    longitude: pickupCoords.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  } : {
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopHeader title="HOGO Track" subtitle="Live Route & Navigation" />

      {lookingUp || loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Checking active ride & route...</Text>
        </View>
      ) : !activeRideId || !rideInfo ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="📍"
            title="No Active Ride to Track"
            subtitle="When you start or book a ride, your live route, GPS location, and ETA will show here in real time."
            action={() => navigation.navigate('FindRide')}
            actionLabel="Find a Ride →"
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Map View */}
          <MapView
            ref={mapRef}
            style={styles.map}
            region={mapRegion}
            showsUserLocation
            showsMyLocationButton
          >
            {/* Live user position */}
            {userLat && userLng && (
              <Marker coordinate={{ latitude: userLat, longitude: userLng }} title="You are here">
                <View style={styles.liveMarker}>
                  <Text style={{ fontSize: 16 }}>📍</Text>
                </View>
              </Marker>
            )}

            {/* Pickup Marker */}
            {pickupCoords && (
              <Marker coordinate={pickupCoords} title={`Pickup: ${rideInfo?.pickup?.address || 'Pickup'}`}>
                <View style={[styles.markerBadge, { backgroundColor: colors.green }]}>
                  <Text style={styles.markerBadgeText}>A</Text>
                </View>
              </Marker>
            )}

            {/* Drop Marker */}
            {dropCoords && (
              <Marker coordinate={dropCoords} title={`Drop: ${rideInfo?.drop?.address || 'Destination'}`}>
                <View style={[styles.markerBadge, { backgroundColor: colors.red }]}>
                  <Text style={styles.markerBadgeText}>B</Text>
                </View>
              </Marker>
            )}

            {/* Optimal Road Polyline */}
            {routePolyline.length > 0 && (
              <Polyline
                coordinates={routePolyline}
                strokeColor={colors.accent}
                strokeWidth={4}
              />
            )}
          </MapView>

          {/* Floating Route & ETA Information Card */}
          <View style={styles.panel}>
            {/* Status & ETA Header */}
            <View style={styles.statusBar}>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>
                  {rideInfo?.status === 'in-progress' ? 'RIDE IN PROGRESS' : 'ACTIVE RIDE'}
                </Text>
              </View>

              {routeDuration ? (
                <View style={styles.etaPill}>
                  <Text style={styles.etaText}>⏱ Est. {routeDuration}</Text>
                </View>
              ) : null}

              <View style={styles.timer}>
                <Text style={styles.timerText}>⏳ {fmt(elapsed)}</Text>
              </View>
            </View>

            {/* Route Addresses */}
            <View style={styles.routeBox}>
              <View style={styles.routeRow}>
                <View style={[styles.dot, { backgroundColor: colors.green }]} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {rideInfo?.pickup?.address || 'Pickup Point'}
                </Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeRow}>
                <View style={[styles.dot, { backgroundColor: colors.red }]} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {rideInfo?.drop?.address || 'Drop Point'}
                </Text>
              </View>
            </View>

            {/* Route Stats */}
            <View style={styles.statsRow}>
              {routeDistance ? (
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>DISTANCE</Text>
                  <Text style={styles.statVal}>{routeDistance} km</Text>
                </View>
              ) : null}
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>COST</Text>
                <Text style={[styles.statVal, { color: colors.accent }]}>₹{rideInfo?.costPerSeat}/seat</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>VEHICLE</Text>
                <Text style={styles.statVal}>{rideInfo?.vehicleName || rideInfo?.vehicleType || 'Vehicle'}</Text>
              </View>
            </View>

            <Alert message={error} />

            {sosSent && (
              <View style={styles.sosSentBanner}>
                <Text style={styles.sosSentText}>🆘 SOS Alert broadcasted! Help is on the way.</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.sosBtn, sosSent && { opacity: 0.5 }]}
                onPress={triggerSOS}
                disabled={sosSent || sosLoading}
              >
                {sosLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.sosBtnText}>🆘 SOS Emergency</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.detailsBtn}
                onPress={() => navigation.navigate('RideDetail', { rideId: activeRideId })}
              >
                <Text style={styles.detailsBtnText}>Ride Details →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  map:  { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emptyContainer:  { flex: 1, justifyContent: 'center', padding: spacing.lg },
  loadingText: { color: colors.text2, fontSize: 13, marginTop: 12 },

  liveMarker: {
    backgroundColor: colors.accentDim, borderRadius: 20, padding: 6,
    borderWidth: 2, borderColor: colors.accent,
  },
  markerBadge: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  markerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },

  panel: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    paddingBottom: 20,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(45,212,160,0.15)', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  liveText: { color: colors.green, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  etaPill: {
    backgroundColor: colors.accentDim, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  etaText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  timer: {
    backgroundColor: colors.surface2, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4, marginLeft: 'auto',
  },
  timerText: { color: colors.text, fontSize: 11, fontWeight: '700' },

  routeBox: {
    backgroundColor: colors.surface2, borderRadius: radius.lg,
    padding: 12, marginBottom: 10,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeLine: { width: 2, height: 10, backgroundColor: colors.border, marginLeft: 4, marginVertical: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeText: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 10, marginBottom: 4,
  },
  statItem: { alignItems: 'center' },
  statLabel: { color: colors.text3, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  statVal: { color: colors.text, fontSize: 13, fontWeight: '700' },

  sosSentBanner: {
    backgroundColor: 'rgba(224,85,85,0.15)', borderRadius: radius.md,
    padding: 10, marginTop: 8, borderWidth: 1, borderColor: colors.red + '44',
  },
  sosSentText: { color: colors.red, fontSize: 12, fontWeight: '700', textAlign: 'center' },

  sosBtn: {
    flex: 1, backgroundColor: colors.red, borderRadius: radius.lg,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
  },
  sosBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  detailsBtn: {
    flex: 1, backgroundColor: colors.surface2, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
  },
  detailsBtnText: { color: colors.text, fontWeight: '700', fontSize: 13 },
});
