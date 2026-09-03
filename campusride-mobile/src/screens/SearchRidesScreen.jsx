import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert as RNAlert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import TopHeader from '../components/TopHeader';
import LocationSearch from '../components/LocationSearch';
import RideCard from '../components/RideCard';
import FloatingChatBot from '../components/FloatingChatBot';
import { Btn, Alert, TogglePill, EmptyState, Input } from '../components/UI';
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
  const [time,       setTime]       = useState('');
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
      const label = res?.display_name || res?.label || 'Current Location';
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

  // Search history state
  const [searchHistory, setSearchHistory] = useState([]);

  // Load search history from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('cr_search_history');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) setSearchHistory(list.slice(0, 6));
        }
      } catch {}
    })();
  }, []);

  const saveSearchHistoryItem = async (p, d) => {
    if (!p?.label && !d?.label) return;
    try {
      const newItem = {
        pickup: p,
        drop: d,
        timestamp: Date.now(),
      };
      setSearchHistory(prev => {
        const filtered = prev.filter(item =>
          !(item.pickup?.label === p.label && item.drop?.label === d.label)
        );
        const updated = [newItem, ...filtered].slice(0, 6);
        AsyncStorage.setItem('cr_search_history', JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    } catch {}
  };

  const applyHistorySearch = (item) => {
    if (item.pickup) setPickup(item.pickup);
    if (item.drop) setDrop(item.drop);
  };

  const doSearch = useCallback(async () => {
    setError('');
    if (!pickup.lat || !pickup.lng) { setError('Enter or detect your pickup location'); return; }
    setLoading(true);
    setSearched(true);
    saveSearchHistoryItem(pickup, drop);
    try {
      const params = {
        lat: pickup.lat, lng: pickup.lng, maxDistance: 10000,
        ...(drop.lat && { dropLat: drop.lat, dropLng: drop.lng }),
        ...(schedMode === 'later' && date && { date }),
        ...(schedMode === 'later' && time && { time }),
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
      <TopHeader title="Search Your Match" subtitle="Find verified campus commuters" />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Active Ride Banner (Only visible when a ride is confirmed and ongoing) */}
        {activeRide && (
          <TouchableOpacity
            style={styles.activeRideBanner}
            onPress={() => {
              const rId = activeRide._id || activeRide.id;
              navigation.navigate('PreRideChecklist', { rideId: rId });
            }}
            activeOpacity={0.85}
          >
            <View style={styles.activeDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeRideTitle}>🚨 Confirmed Campus Ride</Text>
              <Text style={styles.activeRideSub}>Tap to complete safety checklist & open live GPS</Text>
            </View>
            <View style={styles.trackBtnPill}>
              <Text style={styles.trackBtnText}>Checklist & Track →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Section divider */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xs }]}>SEARCH & MATCH RIDES</Text>

        {/* Pickup */}
        <LocationSearch
          label="Pickup Location"
          value={pickup.label}
          onChange={(label, lat, lng) => {
            setPickup({ label, lat: lat ? lat.toString() : '', lng: lng ? lng.toString() : '' });
          }}
          placeholder="Where are you starting from?"
        />

        {/* Drop */}
        <LocationSearch
          label="Drop Location"
          value={drop.label}
          onChange={(label, lat, lng) => {
            setDrop({ label, lat: lat ? lat.toString() : '', lng: lng ? lng.toString() : '' });
          }}
          placeholder="Where do you want to go?"
        />

        {/* ── Recent Search History Chips ── */}
        {searchHistory.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyLabel}>🕒 RECENT SEARCHES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {searchHistory.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.historyChip}
                    onPress={() => applyHistorySearch(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 12 }}>📍</Text>
                    <Text style={styles.historyText} numberOfLines={1}>
                      {item.pickup?.label?.split(',')[0] || 'Pickup'} → {item.drop?.label?.split(',')[0] || 'Drop'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Schedule */}
        <Text style={styles.filterLabel}>When do you need a ride?</Text>
        <TogglePill
          options={[{ value: 'now', label: '⚡ Ride Now' }, { value: 'later', label: '🗓 Schedule' }]}
          value={schedMode}
          onChange={setSchedMode}
        />

        {schedMode === 'later' && (
          <View style={styles.scheduleBox}>
            <Text style={styles.scheduleTitle}>🗓 SELECT DATE & TIME</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <TouchableOpacity
                style={[styles.dateChip, (!date || date === new Date().toISOString().split('T')[0]) && styles.dateChipActive]}
                onPress={() => setDate(new Date().toISOString().split('T')[0])}
              >
                <Text style={[styles.dateChipText, (!date || date === new Date().toISOString().split('T')[0]) && styles.dateChipTextActive]}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateChip, date === new Date(Date.now() + 86400000).toISOString().split('T')[0] && styles.dateChipActive]}
                onPress={() => setDate(new Date(Date.now() + 86400000).toISOString().split('T')[0])}
              >
                <Text style={[styles.dateChipText, date === new Date(Date.now() + 86400000).toISOString().split('T')[0] && styles.dateChipTextActive]}>Tomorrow</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Input
                label="Date (YYYY-MM-DD)"
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                containerStyle={{ flex: 1 }}
              />
              <Input
                label="Time (HH:MM)"
                value={time}
                onChangeText={setTime}
                placeholder="e.g. 09:30 AM"
                containerStyle={{ flex: 1 }}
              />
            </View>

            <Text style={styles.formatHint}>
              📌 Format: <Text style={{ color: colors.accent, fontWeight: '700' }}>YYYY-MM-DD</Text> (e.g. {new Date().toISOString().split('T')[0]}) • <Text style={{ color: colors.accent, fontWeight: '700' }}>HH:MM</Text> (e.g. 09:30 AM or 17:00)
            </Text>

            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {['08:30 AM', '01:00 PM', '05:30 PM', '08:00 PM'].map(tStr => (
                <TouchableOpacity
                  key={tStr}
                  onPress={() => setTime(tStr)}
                  style={[styles.quickTimePill, time === tStr && styles.quickTimePillActive]}
                >
                  <Text style={[styles.quickTimePillText, time === tStr && styles.quickTimePillTextActive]}>{tStr}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

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

      {/* Floating HOGO AI Assistant Button */}
      <FloatingChatBot />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.bg },
  scroll:    { padding: spacing.md, paddingBottom: 48 },
  scheduleBox: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  scheduleTitle: {
    color: colors.accent,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  formatHint: {
    color: colors.text3,
    fontSize: 11,
    marginTop: 4,
    marginBottom: 8,
  },
  quickTimePill: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  quickTimePillActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  quickTimePillText: {
    color: colors.text2,
    fontSize: 11,
    fontWeight: '600',
  },
  quickTimePillTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  filterLabel: { color: colors.text2, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  locRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  historySection: {
    marginBottom: spacing.xs,
  },
  historyLabel: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  historyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 220,
  },
  historyText: {
    color: colors.text2,
    fontSize: 11.5,
    fontWeight: '600',
  },
  dateChip: {
    backgroundColor: colors.surface2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateChipActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  dateChipText: { color: colors.text2, fontSize: 12, fontWeight: '600' },
  dateChipTextActive: { color: colors.accent, fontWeight: '700' },
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

  quickFeaturesSection: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text3,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
  },
  quickIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickCardTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  quickCardSub: {
    color: colors.text3,
    fontSize: 11,
    marginTop: 2,
  },
});
