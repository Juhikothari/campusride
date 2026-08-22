import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert as RNAlert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import TopHeader from '../components/TopHeader';
import LocationSearch from '../components/LocationSearch';
import RideCard from '../components/RideCard';
import { Btn, Alert, TogglePill, EmptyState } from '../components/UI';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';

const VEHICLE_FILTERS = [
  { value: '',           label: 'All',  icon: '🚦' },
  { value: 'motorcycle', label: 'Bike', icon: '🏍️' },
  { value: 'car',        label: 'Car',  icon: '🚗' },
  { value: 'suv',        label: 'SUV',  icon: '🚙' },
  { value: 'xuv',        label: 'XUV',  icon: '🛻' },
];

export default function SearchRidesScreen({ navigation }) {
  const { user } = useAuth();
  const isSeeker  = user?.role === 'seeker' || user?.role === 'both';
  const isFemale  = user?.gender === 'female';

  const [pickup,     setPickup]     = useState({ label: '', lat: '', lng: '' });
  const [drop,       setDrop]       = useState({ label: '', lat: '', lng: '' });
  const [schedMode,  setSchedMode]  = useState('now');
  const [date,       setDate]       = useState('');
  const [womenOnly,  setWomenOnly]  = useState(false);
  const [vehicle,    setVehicle]    = useState('');
  const [rides,      setRides]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [geoLoading, setGeoLoading] = useState('');
  const [searched,   setSearched]   = useState(false);
  const [error,      setError]      = useState('');
  const [bookingMap, setBookingMap] = useState({});

  // Active in-progress ride state
  const [activeRide,   setActiveRide]   = useState(null);

  // Route preview state
  const [routeInfo,    setRouteInfo]    = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Check for any ongoing live ride
  useEffect(() => {
    let mounted = true;
    const checkActiveRide = async () => {
      try {
        const [bookingsRes, ridesRes] = await Promise.allSettled([
          api.getMyBookings(),
          api.getMyRides(),
        ]);
        if (!mounted) return;
        const bList = bookingsRes.status === 'fulfilled' ? (Array.isArray(bookingsRes.value) ? bookingsRes.value : bookingsRes.value?.bookings || []) : [];
        const rList = ridesRes.status === 'fulfilled' ? (Array.isArray(ridesRes.value) ? ridesRes.value : ridesRes.value?.rides || []) : [];
        
        const activeB = bList.find(b => b.status === 'accepted' && (b.rideId?.status === 'in-progress' || b.rideId?.status === 'active'));
        const activeR = rList.find(r => r.status === 'in-progress' || r.status === 'active');
        setActiveRide(activeR || activeB?.rideId || null);
      } catch {}
    };
    checkActiveRide();
    return () => { mounted = false; };
  }, []);

  if (!isSeeker) return (
    <SafeAreaView style={styles.safe}>
      <EmptyState icon="🚫" title="Access Denied" subtitle="Only seekers can search for rides." action={() => navigation.goBack()} actionLabel="Go Back" />
    </SafeAreaView>
  );

  const geoLocate = async (field) => {
    setGeoLoading(field);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setError('Location permission denied'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      const res = await api.reverseGeocode(lat, lng).catch(() => null);
      const label = res?.label || res?.display_name?.split(',').slice(0, 2).join(', ') || 'Current Location';
      if (field === 'pickup') setPickup({ label, lat: lat.toString(), lng: lng.toString() });
      else                    setDrop  ({ label, lat: lat.toString(), lng: lng.toString() });
    } catch {
      setError('Could not detect location. Enter manually.');
    } finally {
      setGeoLoading('');
    }
  };

  const calculateRoute = async () => {
    if (!pickup.lat || !pickup.lng || !drop.lat || !drop.lng) {
      setError('Enter both pickup and drop locations to preview your route.');
      return;
    }
    setRouteLoading(true);
    setError('');
    try {
      const routeData = await api.getOptimalRoute(pickup.lat, pickup.lng, drop.lat, drop.lng);
      setRouteInfo(routeData);
    } catch (e) {
      setError('Could not calculate route. Please check coordinates.');
    } finally {
      setRouteLoading(false);
    }
  };

  const doSearch = useCallback(async () => {
    setError('');
    if (!pickup.lat || !pickup.lng) { setError('Enter or detect your pickup location'); return; }
    setLoading(true);
    setSearched(true);
    try {
      const params = {
        lat: pickup.lat, lng: pickup.lng, maxDistance: 10000,
        ...(drop.lat && { dropLat: drop.lat, dropLng: drop.lng }),
        ...(schedMode === 'later' && date && { date }),
        ...(womenOnly && { womenOnly: true }),
      };
      let results = await api.searchRides(params);
      if (vehicle) results = results.filter(r => r.vehicleType === vehicle);
      setRides(results || []);
    } catch (e) {
      setError(e.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [pickup, drop, schedMode, date, womenOnly, vehicle]);

  const book = async (rideId) => {
    setBookingMap(m => ({ ...m, [rideId]: { loading: true } }));
    try {
      await api.bookRide(rideId);
      setBookingMap(m => ({ ...m, [rideId]: { status: 'pending' } }));
    } catch (e) {
      setBookingMap(m => ({ ...m, [rideId]: { error: e.message } }));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopHeader title="HOGO" subtitle="Find Your Match" />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Active Ride Banner (Only visible when a ride is ongoing) */}
        {activeRide && (
          <TouchableOpacity
            style={styles.activeRideBanner}
            onPress={() => navigation.navigate('LiveTracking', { rideId: activeRide._id || activeRide.id })}
            activeOpacity={0.85}
          >
            <View style={styles.activeDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeRideTitle}>🚨 Live Ride In Progress</Text>
              <Text style={styles.activeRideSub}>Tap here to track real-time live map & SOS</Text>
            </View>
            <View style={styles.trackBtnPill}>
              <Text style={styles.trackBtnText}>Track Ride →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Pickup */}
        <LocationSearch
          label="Pickup Location"
          value={pickup.label}
          onChange={(label, lat, lng) => {
            setPickup({ label, lat: lat ? lat.toString() : '', lng: lng ? lng.toString() : '' });
            setRouteInfo(null);
          }}
          placeholder="Where are you starting from?"
        />

        {/* Drop */}
        <LocationSearch
          label="Drop Location"
          value={drop.label}
          onChange={(label, lat, lng) => {
            setDrop({ label, lat: lat ? lat.toString() : '', lng: lng ? lng.toString() : '' });
            setRouteInfo(null);
          }}
          placeholder="Where do you want to go?"
        />

        {/* Find My Route Button */}
        {pickup.lat && drop.lat && (
          <TouchableOpacity
            style={styles.routeBtn}
            onPress={calculateRoute}
            disabled={routeLoading}
            activeOpacity={0.8}
          >
            {routeLoading ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={styles.routeBtnText}>🗺️ Find My Route & Travel Time</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Route Details Card */}
        {routeInfo && (
          <View style={styles.routeCard}>
            <View style={styles.routeCardHeader}>
              <Text style={styles.routeCardTitle}>📍 Optimal Route Summary</Text>
              <Text style={styles.routeTimePill}>⏱ ~{routeInfo.durationMin} mins</Text>
            </View>
            <View style={styles.routeCardStats}>
              <Text style={styles.routeStatText}>📏 Total Distance: <Text style={{ color: colors.text, fontWeight: '700' }}>{routeInfo.distanceKm} km</Text></Text>
              <Text style={styles.routeStatText}>⚡ Estimated Commute: <Text style={{ color: colors.accent, fontWeight: '700' }}>{routeInfo.durationMin} minutes</Text></Text>
            </View>
          </View>
        )}

        {/* Schedule */}
        <Text style={styles.filterLabel}>When do you need a ride?</Text>
        <TogglePill
          options={[{ value: 'now', label: 'Ride Now', icon: '⚡' }, { value: 'later', label: 'Schedule', icon: '🗓' }]}
          value={schedMode}
          onChange={setSchedMode}
        />

        {/* Vehicle filter */}
        <Text style={[styles.filterLabel, { marginTop: spacing.md }]}>Vehicle Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {VEHICLE_FILTERS.map(v => (
              <TouchableOpacity
                key={v.value}
                onPress={() => setVehicle(v.value)}
                style={[styles.vehicleChip, vehicle === v.value && styles.vehicleChipActive]}
              >
                <Text style={{ fontSize: 14 }}>{v.icon}</Text>
                <Text style={[styles.vehicleChipText, vehicle === v.value && styles.vehicleChipTextActive]}>{v.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Women-only */}
        {isFemale && (
          <TouchableOpacity
            onPress={() => setWomenOnly(w => !w)}
            style={[styles.womenToggle, womenOnly && styles.womenToggleActive]}
          >
            <Text style={{ fontSize: 16 }}>{womenOnly ? '🔒' : '♀'}</Text>
            <Text style={[styles.womenToggleText, womenOnly && { color: colors.pink }]}>Women-only rides</Text>
            {womenOnly && (
              <View style={{ backgroundColor: colors.pink, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>ON</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        <Alert message={error} />

        <Btn label="🔍 Search Your Match" onPress={doSearch} loading={loading} style={{ marginTop: 8 }} />

        {/* Results */}
        {searched && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={styles.resultsHeader}>
              {rides.length} match{rides.length !== 1 ? 'es' : ''} found
            </Text>

            {rides.length === 0 ? (
              <View style={styles.noRidesCard}>
                <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>🚗</Text>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>No matching rides found</Text>
                <Text style={{ color: colors.text2, fontSize: 13, textAlign: 'center', marginBottom: 16 }}>Try searching for a different destination or check the community tab.</Text>
                <Btn label="Check Community" onPress={() => navigation.navigate('Community')} variant="outline" />
              </View>
            ) : (
              rides.map(ride => {
                const bm = bookingMap[ride._id];
                return (
                  <View key={ride._id}>
                    <RideCard
                      ride={ride}
                      onView={id => navigation.navigate('RideDetail', { rideId: id })}
                      onBook={bm?.status ? null : book}
                      bookingStatus={bm?.status}
                    />
                    {bm?.error  && <Alert message={bm.error} />}
                    {bm?.status === 'pending' && <Alert message="Booking request sent! Waiting for provider to accept." type="success" />}
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.bg },
  scroll:    { padding: spacing.md, paddingBottom: 48 },
  filterLabel: { color: colors.text2, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  locRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  geoBtn: {
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: 12, marginBottom: spacing.md, alignItems: 'center',
  },
  routeBtn: {
    backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent + '55',
    borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 14,
    alignItems: 'center', marginBottom: 14,
  },
  routeBtnText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  routeCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: spacing.md,
  },
  routeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  routeCardTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  routeTimePill: { backgroundColor: colors.accentDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, color: colors.accent, fontSize: 11, fontWeight: '800' },
  routeCardStats: { gap: 4 },
  routeStatText: { color: colors.text2, fontSize: 12 },
  vehicleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  vehicleChipActive:     { backgroundColor: 'rgba(245,166,35,0.2)', borderColor: colors.accent },
  vehicleChipText:       { color: colors.text2, fontSize: 13, fontWeight: '600' },
  vehicleChipTextActive: { color: colors.accent },
  womenToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: radius.md,
    padding: 10, marginBottom: spacing.sm,
  },
  womenToggleActive:  { borderColor: colors.pink, backgroundColor: 'rgba(233,30,140,0.1)' },
  womenToggleText:    { color: colors.text2, fontSize: 13, fontWeight: '600', flex: 1 },
  resultsHeader:      { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing.md },
  noRidesCard: {
    backgroundColor: colors.surface2, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg,
  },
  activeRideBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentDim,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: spacing.md,
    gap: 10,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.green,
  },
  activeRideTitle: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  activeRideSub: { color: colors.text2, fontSize: 11, marginTop: 2 },
  trackBtnPill: {
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  trackBtnText: { color: '#000', fontSize: 11, fontWeight: '800' },
});
