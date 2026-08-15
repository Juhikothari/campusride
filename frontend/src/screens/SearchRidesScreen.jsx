import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>🔍 Find a Ride</Text>

        {/* Pickup */}
        <View style={styles.locRow}>
          <View style={{ flex: 1 }}>
            <LocationSearch
              label="Pickup Location"
              value={pickup.label}
              onChange={(label, lat, lng) => setPickup({ label, lat: lat.toString(), lng: lng.toString() })}
              placeholder="Where are you?"
            />
          </View>
          <TouchableOpacity
            style={[styles.geoBtn, geoLoading === 'pickup' && { opacity: 0.5 }]}
            onPress={() => geoLocate('pickup')}
            disabled={!!geoLoading}
          >
            <Text style={{ fontSize: 18 }}>🎯</Text>
          </TouchableOpacity>
        </View>

        {/* Drop */}
        <View style={styles.locRow}>
          <View style={{ flex: 1 }}>
            <LocationSearch
              label="Drop Location"
              value={drop.label}
              onChange={(label, lat, lng) => setDrop({ label, lat: lat.toString(), lng: lng.toString() })}
              placeholder="Where do you want to go?"
            />
          </View>
          <TouchableOpacity
            style={[styles.geoBtn, geoLoading === 'drop' && { opacity: 0.5 }]}
            onPress={() => geoLocate('drop')}
            disabled={!!geoLoading}
          >
            <Text style={{ fontSize: 18 }}>🎯</Text>
          </TouchableOpacity>
        </View>

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

        <Btn label="🔍 Search Rides" onPress={doSearch} loading={loading} style={{ marginTop: 8 }} />

        {/* Results */}
        {searched && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={styles.resultsHeader}>
              {rides.length} ride{rides.length !== 1 ? 's' : ''} found
            </Text>

            {rides.length === 0 ? (
              <View style={styles.noRidesCard}>
                <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>🚗</Text>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>No rides found nearby</Text>
                <Text style={{ color: colors.text2, fontSize: 13, textAlign: 'center', marginBottom: 16 }}>Try a different location or check back later</Text>
                <Btn label="🔔 Subscribe to Route Alerts" onPress={() => navigation.navigate('RouteAlerts')} variant="outline" />
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
  pageTitle: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.md },
  filterLabel: { color: colors.text2, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  locRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  geoBtn: {
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: 12, marginBottom: spacing.md, alignItems: 'center',
  },
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
});
