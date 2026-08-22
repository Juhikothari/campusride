import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import TopHeader from '../components/TopHeader';
import LocationSearch from '../components/LocationSearch';
import { Input, Btn, Alert, EmptyState, TogglePill } from '../components/UI';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';

const VEHICLES = [
  { value: 'motorcycle', label: '🏍 Bike', capacity: 1 },
  { value: 'car',        label: '🚗 Car',  capacity: 3 },
  { value: 'suv',        label: '🚙 SUV',  capacity: 4 },
  { value: 'xuv',        label: '🛻 XUV',  capacity: 6 },
];

const RATES = {
  motorcycle: { base: 20, perKm: 5  },
  car:        { base: 25, perKm: 7  },
  suv:        { base: 30, perKm: 9  },
  xuv:        { base: 35, perKm: 11 },
};

function calcCost(distKm, vehicleType) {
  if (!distKm || distKm <= 0) return 0;
  const d = Math.min(distKm, 50);
  const { base, perKm } = RATES[vehicleType] || RATES.car;
  return Math.max(20, base + (d > 1 ? Math.round(d * perKm) : 0));
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

export default function CreateRideScreen({ navigation }) {
  const { user } = useAuth();
  const isProvider = user?.role === 'provider' || user?.role === 'both';

  const [pickup,      setPickup]      = useState({ label: '', lat: '', lng: '' });
  const [drop,        setDrop]        = useState({ label: '', lat: '', lng: '' });
  const [vehicleType, setVehicleType] = useState('car');
  const [vehicleName, setVehicleName] = useState('');
  const [seats,       setSeats]       = useState('3');
  const [cost,        setCost]        = useState('0');
  const [date,        setDate]        = useState('');
  const [time,        setTime]        = useState('');
  const [womenOnly,   setWomenOnly]   = useState(false);
  const [schedMode,   setSchedMode]   = useState('now');
  const [loading,     setLoading]     = useState(false);
  const [success,     setSuccess]     = useState(null);
  const [error,       setError]       = useState('');
  const [distKm,      setDistKm]      = useState(0);

  // Route preview
  const [routeInfo,    setRouteInfo]    = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  if (!isProvider) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <EmptyState icon="🚫" title="Access Denied" subtitle="Only providers can create rides." action={() => navigation.goBack()} actionLabel="Go Back" />
    </SafeAreaView>
  );

  // Auto-calculate distance + cost
  useEffect(() => {
    if (!pickup.lat || !pickup.lng || !drop.lat || !drop.lng) { setDistKm(0); return; }
    const d = haversineKm(parseFloat(pickup.lat), parseFloat(pickup.lng), parseFloat(drop.lat), parseFloat(drop.lng));
    setDistKm(d);
    setCost(String(calcCost(d, vehicleType)));
  }, [pickup.lat, pickup.lng, drop.lat, drop.lng, vehicleType]);

  // Set current time when "Ride Now" selected
  useEffect(() => {
    if (schedMode === 'now') {
      const now = new Date();
      setDate(now.toISOString().split('T')[0]);
      setTime(now.toTimeString().slice(0, 5));
    }
  }, [schedMode]);

  const geoLocate = async (field) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      const res = await api.reverseGeocode(lat, lng).catch(() => null);
      const label = res?.label || 'Current Location';
      if (field === 'pickup') setPickup({ label, lat: lat.toString(), lng: lng.toString() });
      else                    setDrop({ label, lat: lat.toString(), lng: lng.toString() });
    } catch {}
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
      setError('Could not calculate route.');
    } finally {
      setRouteLoading(false);
    }
  };

  const isFemale = user?.gender === 'female';

  const submit = async () => {
    setError('');
    if (!pickup.lat) { setError('Enter pickup location'); return; }
    if (!drop.lat)   { setError('Enter drop location');   return; }
    if (!date || !time) { setError('Enter date and time'); return; }

    const selectedCap = VEHICLES.find(v => v.value === vehicleType)?.capacity || 1;
    const computedCost = calcCost(distKm, vehicleType) || 0;

    setLoading(true);
    try {
      const ride = await api.createRide({
        pickup: {
          type: 'Point',
          coordinates: [parseFloat(pickup.lng), parseFloat(pickup.lat)],
          address: pickup.label,
        },
        drop: {
          type: 'Point',
          coordinates: [parseFloat(drop.lng), parseFloat(drop.lat)],
          address: drop.label,
        },
        date, time,
        seatsAvailable: selectedCap,
        costPerSeat:    computedCost,
        vehicleType,
        vehicleName:    vehicleType.toUpperCase(),
        womenOnly:      isFemale ? womenOnly : false,
        college:        user?.college || '',
      });
      setSuccess(ride);
    } catch (e) {
      setError(e.message || 'Failed to create ride');
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
      <Text style={{ fontSize: 60, marginBottom: 16 }}>🎉</Text>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>Ride Created!</Text>
      <Text style={{ color: colors.text2, fontSize: 14, textAlign: 'center', marginBottom: 32, lineHeight: 20 }}>
        Your ride has been posted on HOGO. Students from your college can now book seats.
      </Text>
      <Btn label="View Ride Requests" onPress={() => navigation.navigate('ProviderBookings')} style={{ width: '100%', marginBottom: 12 }} />
      <Btn label="Post Another Ride" onPress={() => setSuccess(null)} variant="outline" style={{ width: '100%' }} />
    </SafeAreaView>
  );

  const selectedVehicle = VEHICLES.find(v => v.value === vehicleType);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopHeader title="HOGO" subtitle="Find Your Match" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Alert message={error} />

          {/* Locations */}
          <LocationSearch
            label="Pickup Location"
            value={pickup.label}
            onChange={(label, lat, lng) => {
              setPickup({ label, lat: lat ? lat.toString() : '', lng: lng ? lng.toString() : '' });
              setRouteInfo(null);
            }}
            placeholder="Where from?"
          />

          <LocationSearch
            label="Drop Location"
            value={drop.label}
            onChange={(label, lat, lng) => {
              setDrop({ label, lat: lat ? lat.toString() : '', lng: lng ? lng.toString() : '' });
              setRouteInfo(null);
            }}
            placeholder="Where to?"
          />

          {/* What's My Route Button */}
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
                <Text style={styles.routeBtnText}>🗺️ What's my route & estimated time?</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Route Details Card */}
          {routeInfo && (
            <View style={styles.routeCard}>
              <View style={styles.routeCardHeader}>
                <Text style={styles.routeCardTitle}>📍 Optimal Route Calculated</Text>
                <Text style={styles.routeTimePill}>⏱ ~{routeInfo.durationMin} mins</Text>
              </View>
              <View style={styles.routeCardStats}>
                <Text style={styles.routeStatText}>📏 Total Distance: <Text style={{ color: colors.text, fontWeight: '700' }}>{routeInfo.distanceKm} km</Text></Text>
                <Text style={styles.routeStatText}>⚡ Estimated Travel: <Text style={{ color: colors.accent, fontWeight: '700' }}>{routeInfo.durationMin} minutes</Text></Text>
              </View>
            </View>
          )}

          {/* Schedule */}
          <Text style={styles.fieldLabel}>When?</Text>
          <TogglePill
            options={[{ value: 'now', label: 'Now', icon: '⚡' }, { value: 'later', label: 'Schedule', icon: '🗓' }]}
            value={schedMode}
            onChange={setSchedMode}
          />
          {schedMode === 'later' && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
              <Input label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" containerStyle={{ flex: 1 }} />
              <Input label="Time" value={time} onChangeText={setTime} placeholder="HH:MM" containerStyle={{ flex: 1 }} />
            </View>
          )}

          {/* Vehicle Selection */}
          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Vehicle Type</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md, flexWrap: 'wrap' }}>
            {VEHICLES.map(v => (
              <TouchableOpacity
                key={v.value}
                onPress={() => setVehicleType(v.value)}
                style={[styles.vehicleChip, vehicleType === v.value && styles.vehicleChipActive]}
              >
                <Text style={[styles.vehicleChipText, vehicleType === v.value && styles.vehicleChipTextActive]}>{v.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Women-only toggle — Only visible to female accounts */}
          {isFemale && (
            <TouchableOpacity
              onPress={() => setWomenOnly(w => !w)}
              style={[styles.womenToggle, womenOnly && styles.womenToggleActive]}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 16 }}>♀</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.womenToggleTitle, womenOnly && { color: colors.pink }]}>Women-only ride</Text>
                <Text style={{ color: colors.text2, fontSize: 12 }}>Only female seekers from your college can book</Text>
              </View>
              <View style={[styles.toggleDot, womenOnly && styles.toggleDotActive]} />
            </TouchableOpacity>
          )}

          <Btn label="🚗 Post Ride on HOGO" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bg },
  scroll:      { padding: spacing.md, paddingBottom: 48 },
  fieldLabel:  { color: colors.text2, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  locRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  geoBtn:      { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, marginBottom: spacing.md },
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
  vehicleChip: { borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 10 },
  vehicleChipActive:     { borderColor: colors.accent, backgroundColor: colors.accentDim },
  vehicleChipText:       { color: colors.text2, fontSize: 14, fontWeight: '600' },
  vehicleChipTextActive: { color: colors.accent },
  fareCard:    { backgroundColor: colors.surface2, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, alignItems: 'center' },
  womenToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: spacing.md },
  womenToggleActive: { borderColor: colors.pink, backgroundColor: 'rgba(233,30,140,0.08)' },
  womenToggleTitle: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  toggleDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.border },
  toggleDotActive: { backgroundColor: colors.pink },
});
