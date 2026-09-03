import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import TopHeader from '../components/TopHeader';
import LocationSearch from '../components/LocationSearch';
import FloatingChatBot from '../components/FloatingChatBot';
import { Input, Btn, Alert, EmptyState, TogglePill } from '../components/UI';
import { colors, spacing, radius } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

  const [pickupFrom,    setPickupFrom]    = useState('college'); // 'college' | 'home'
  const [pickup,        setPickup]        = useState({ label: '', lat: '', lng: '' });
  const [drop,          setDrop]          = useState({ label: '', lat: '', lng: '' });
  const [vehicleType,   setVehicleType]   = useState('car');
  const [vehicleName,   setVehicleName]   = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [userVehicles,  setUserVehicles]  = useState([]);
  const [selectedVIdx,  setSelectedVIdx]  = useState(0);

  // Missing vehicle modal
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [modalVName,       setModalVName]       = useState('');
  const [modalVNum,        setModalVNum]        = useState('');
  const [modalSaving,      setModalSaving]      = useState(false);

  const [cost,        setCost]        = useState('0');
  const [date,        setDate]        = useState('');
  const [time,        setTime]        = useState('');
  const [womenOnly,   setWomenOnly]   = useState(false);
  const [schedMode,   setSchedMode]   = useState('now');
  const [loading,     setLoading]     = useState(false);
  const [success,     setSuccess]     = useState(null);
  const [error,       setError]       = useState('');
  const [distKm,      setDistKm]      = useState(0);

  // Load user vehicles
  useEffect(() => {
    if (!isProvider) return;
    let mounted = true;
    Promise.allSettled([
      AsyncStorage.getItem('@user_registered_vehicles_list').catch(() => null),
      api.getUserVehicles(),
      api.getProfile(),
    ]).then(([localRes, vRes, pRes]) => {
      if (!mounted) return;
      const localListStr = localRes.status === 'fulfilled' && localRes.value ? localRes.value : null;
      const localList = localListStr ? JSON.parse(localListStr) : [];
      const vList = vRes.status === 'fulfilled' && Array.isArray(vRes.value) ? vRes.value : [];
      const pData = pRes.status === 'fulfilled' ? pRes.value : null;

      const combined = [...localList];
      vList.forEach(v => {
        if (v?.vehicleNumber && !combined.some(c => c.vehicleNumber === v.vehicleNumber)) {
          combined.push(v);
        }
      });
      if (pData?.vehicles && Array.isArray(pData.vehicles)) {
        pData.vehicles.forEach(v => {
          if (v?.vehicleNumber && !combined.some(c => c.vehicleNumber === v.vehicleNumber)) {
            combined.push(v);
          }
        });
      }
      if (pData?.kycDocuments?.vehicleNumber && !combined.some(c => c.vehicleNumber === pData.kycDocuments.vehicleNumber)) {
        combined.push({
          vehicleNumber: pData.kycDocuments.vehicleNumber,
          vehicleName: pData.kycDocuments.vehicleName || 'Registered Vehicle',
          vehicleType: pData.kycDocuments.vehicleType || 'car',
        });
      }
      if (user?.kycDocuments?.vehicleNumber && !combined.some(c => c.vehicleNumber === user.kycDocuments.vehicleNumber)) {
        combined.push({
          vehicleNumber: user.kycDocuments.vehicleNumber,
          vehicleName: user.kycDocuments.vehicleName || 'Registered Vehicle',
          vehicleType: user.kycDocuments.vehicleType || 'car',
        });
      }

      setUserVehicles(combined);
      if (combined.length > 0) {
        setSelectedVIdx(0);
        setVehicleName(combined[0].vehicleName || 'Vehicle');
        setVehicleNumber(combined[0].vehicleNumber || '');
        if (combined[0].vehicleType) setVehicleType(combined[0].vehicleType);
      }
    }).catch(() => {});

    return () => { mounted = false; };
  }, [isProvider, user]);

  const hasRegisteredVehicle = Boolean(
    (userVehicles.length > 0 && userVehicles[0].vehicleNumber) ||
    vehicleNumber ||
    user?.kycDocuments?.vehicleNumber ||
    user?.vehicleNumber
  );

  // Set default college pickup when "college" is chosen
  useEffect(() => {
    if (pickupFrom === 'college' && user?.college) {
      setPickup({
        label: `${user.college} (Campus Main Gate)`,
        lat: '12.9716',
        lng: '77.5946',
      });
    } else if (pickupFrom === 'home') {
      setPickup({ label: '', lat: '', lng: '' });
    }
  }, [pickupFrom, user?.college]);

  // Auto-calculate distance + cost
  useEffect(() => {
    if (!pickup.lat || !pickup.lng || !drop.lat || !drop.lng) { setDistKm(0); return; }
    const d = haversineKm(parseFloat(pickup.lat), parseFloat(pickup.lng), parseFloat(drop.lat), parseFloat(drop.lng));
    setDistKm(d);
    setCost(String(calcCost(d, vehicleType)));
  }, [pickup.lat, pickup.lng, drop.lat, drop.lng, vehicleType]);

  // Set current date & time for "now"
  useEffect(() => {
    const now = new Date();
    setDate(now.toISOString().split('T')[0]);
    if (schedMode === 'now') {
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setTime(`${hh}:${mm}`);
    }
  }, [schedMode]);

  if (!isProvider) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <EmptyState icon="🚫" title="Access Denied" subtitle="Only providers can create rides." action={() => navigation.goBack()} actionLabel="Go Back" />
    </SafeAreaView>
  );

  const isFemale = user?.gender === 'female';

  const handleSelectVehicle = (v, idx) => {
    setSelectedVIdx(idx);
    setVehicleName(v.vehicleName || '');
    setVehicleNumber(v.vehicleNumber || '');
    if (v.vehicleType) setVehicleType(v.vehicleType);
  };

  const handleSaveModalVehicle = async () => {
    if (!modalVNum.trim() || !modalVName.trim()) {
      setError('Enter both vehicle registration number and name/model.');
      return;
    }
    setModalSaving(true);
    try {
      await api.saveVehicle({
        vehicleNumber: modalVNum.trim().toUpperCase(),
        vehicleName:   modalVName.trim(),
        vehicleType,
      });
      setVehicleNumber(modalVNum.trim().toUpperCase());
      setVehicleName(modalVName.trim());
      setUserVehicles(prev => [
        ...prev,
        { vehicleNumber: modalVNum.trim().toUpperCase(), vehicleName: modalVName.trim(), vehicleType }
      ]);
      setShowVehicleModal(false);
      setModalVNum('');
      setModalVName('');
    } catch (e) {
      setError(e.message || 'Failed to save vehicle details');
    } finally {
      setModalSaving(false);
    }
  };

  const setPresetTime = (offsetMins) => {
    const d = new Date(Date.now() + offsetMins * 60 * 1000);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    setTime(`${hh}:${mm}`);
  };

  const submit = async () => {
    setError('');

    // Check if vehicle details are missing
    if (!vehicleNumber.trim() && userVehicles.length === 0) {
      setShowVehicleModal(true);
      return;
    }

    if (!pickup.lat) { setError('Enter or select pickup location'); return; }
    if (!drop.lat)   { setError('Enter drop location');   return; }
    if (!date || !time) { setError('Select a valid date and time'); return; }

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
        vehicleName:    vehicleName.trim() || 'Car',
        vehicleNumber:  vehicleNumber.toUpperCase().trim(),
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
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>Ride Posted Successfully!</Text>
      <Text style={{ color: colors.text2, fontSize: 14, textAlign: 'center', marginBottom: 32, lineHeight: 20 }}>
        Your ride is now visible to students from {user?.college || 'your campus'}.
      </Text>
      <Btn label="View Ride Requests" onPress={() => navigation.navigate('ProviderBookings')} style={{ width: '100%', marginBottom: 12 }} />
      <Btn label="Post Another Ride" onPress={() => setSuccess(null)} variant="outline" style={{ width: '100%' }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopHeader title="HOGO" subtitle="Find Your Match" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Alert message={error} />

          {/* ── WHERE ARE YOU PICKING UP FROM? ── */}
          <Text style={styles.sectionHeading}>WHERE ARE YOU PICKING UP FROM? *</Text>
          <View style={styles.pickupSourceRow}>
            <TouchableOpacity
              style={[styles.pickupSourceBtn, pickupFrom === 'college' && styles.pickupSourceBtnActive]}
              onPress={() => setPickupFrom('college')}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 24, marginBottom: 4 }}>🏫</Text>
              <Text style={[styles.pickupSourceText, pickupFrom === 'college' && styles.pickupSourceTextActive]}>COLLEGE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pickupSourceBtn, pickupFrom === 'home' && styles.pickupSourceBtnActive]}
              onPress={() => setPickupFrom('home')}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 24, marginBottom: 4 }}>🏠</Text>
              <Text style={[styles.pickupSourceText, pickupFrom === 'home' && styles.pickupSourceTextActive]}>HOME</Text>
            </TouchableOpacity>
          </View>

          {/* Pickup & Drop Locations */}
          <LocationSearch
            label="Pickup Location"
            value={pickup.label}
            onChange={(label, lat, lng) => {
              setPickup({ label, lat: lat ? lat.toString() : '', lng: lng ? lng.toString() : '' });
            }}
            placeholder={pickupFrom === 'college' ? `${user?.college || 'College'} Campus` : 'Enter Home / Pickup Location'}
          />

          <LocationSearch
            label="Drop Location"
            value={drop.label}
            onChange={(label, lat, lng) => {
              setDrop({ label, lat: lat ? lat.toString() : '', lng: lng ? lng.toString() : '' });
            }}
            placeholder="Where are you going?"
          />

          {/* ── WHEN / SCHEDULE ── */}
          <Text style={styles.fieldLabel}>WHEN?</Text>
          <TogglePill
            options={[{ value: 'now', label: '⚡ Ride Now' }, { value: 'later', label: '🗓 Schedule' }]}
            value={schedMode}
            onChange={setSchedMode}
          />

          {schedMode === 'later' && (
            <View style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>SELECT DATE & TIME</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TouchableOpacity
                  style={[styles.timeChip, date === new Date().toISOString().split('T')[0] && styles.timeChipActive]}
                  onPress={() => setDate(new Date().toISOString().split('T')[0])}
                >
                  <Text style={[styles.timeChipText, date === new Date().toISOString().split('T')[0] && styles.timeChipTextActive]}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.timeChip, date === new Date(Date.now() + 86400000).toISOString().split('T')[0] && styles.timeChipActive]}
                  onPress={() => setDate(new Date(Date.now() + 86400000).toISOString().split('T')[0])}
                >
                  <Text style={[styles.timeChipText, date === new Date(Date.now() + 86400000).toISOString().split('T')[0] && styles.timeChipTextActive]}>Tomorrow</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Input
                  label="Date"
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  containerStyle={{ flex: 1 }}
                />
                <Input
                  label="Time"
                  value={time}
                  onChangeText={setTime}
                  placeholder="e.g. 15:30"
                  containerStyle={{ flex: 1 }}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                {['+15 min', '+30 min', '+1 hr', '+2 hr'].map((offset, idx) => {
                  const mins = [15, 30, 60, 120][idx];
                  return (
                    <TouchableOpacity key={offset} onPress={() => setPresetTime(mins)} style={styles.quickTimeBtn}>
                      <Text style={styles.quickTimeText}>{offset}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── REGISTERED VEHICLE DETAILS & SELECTION ── */}
          {hasRegisteredVehicle ? (
            <View style={styles.vehicleSection}>
              {userVehicles.length > 1 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.sectionHeading}>SELECT VEHICLE FOR THIS RIDE</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {userVehicles.map((v, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => {
                          setSelectedVIdx(i);
                          setVehicleNumber(v.vehicleNumber);
                          setVehicleName(v.vehicleName);
                          if (v.vehicleType) setVehicleType(v.vehicleType);
                        }}
                        style={[styles.vChoiceChip, selectedVIdx === i && styles.vChoiceChipActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.vChoiceText, selectedVIdx === i && styles.vChoiceTextActive]}>
                          {v.vehicleType === 'motorcycle' ? '🏍️' : '🚗'} {v.vehicleName} ({v.vehicleNumber})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <Text style={styles.sectionHeading}>REGISTERED VEHICLE DETAILS</Text>
              <View style={styles.lockedVehicleCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.lockedVehicleIcon}>
                    <Text style={{ fontSize: 22 }}>{vehicleType === 'motorcycle' ? '🏍️' : '🚗'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lockedVehicleName}>
                      {vehicleName || 'Registered Vehicle'} • {(vehicleType || 'Car').toUpperCase()}
                    </Text>
                    <Text style={styles.lockedPlate}>
                      {vehicleNumber || user?.kycDocuments?.vehicleNumber}
                    </Text>
                  </View>
                  <View style={styles.lockedBadge}>
                    <Text style={styles.lockedBadgeText}>✓ DEFAULT</Text>
                  </View>
                </View>
                <Text style={styles.lockedPolicyNote}>
                  🔒 This ride will be posted using your registered vehicle. To add a 2nd vehicle or edit details, please manage your vehicles in your Profile.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.unregisteredNoticeCard}>
              <Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 6 }}>🚗</Text>
              <Text style={styles.unregisteredTitle}>Vehicle Registration Required</Text>
              <Text style={styles.unregisteredSub}>
                You haven't registered a vehicle yet. Please go to your Profile page to add your vehicle details. Once verified by campus admin within 24 hours, you can offer rides!
              </Text>
              <TouchableOpacity
                style={styles.goToProfileBtn}
                onPress={() => navigation.navigate('Profile')}
                activeOpacity={0.85}
              >
                <Text style={styles.goToProfileBtnText}>👤 Go to Profile to Register Vehicle →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Women-only toggle */}
          {isFemale && (
            <TouchableOpacity
              onPress={() => setWomenOnly(w => !w)}
              style={[styles.womenToggle, womenOnly && styles.womenToggleActive]}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18 }}>♀</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.womenToggleTitle, womenOnly && { color: colors.pink }]}>Women-only ride</Text>
                <Text style={{ color: colors.text2, fontSize: 12 }}>Only female students from your campus can request seats</Text>
              </View>
              <View style={[styles.toggleDot, womenOnly && styles.toggleDotActive]} />
            </TouchableOpacity>
          )}

          {hasRegisteredVehicle ? (
            <Btn label="🚗 Post Ride on HOGO" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
          ) : (
            <Btn
              label="⚠️ Register Vehicle in Profile to Post Ride"
              onPress={() => navigation.navigate('Profile')}
              style={{ marginTop: spacing.md, backgroundColor: '#2a2214', borderColor: colors.accent, borderWidth: 1 }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating HOGO AI Assistant Button */}
      <FloatingChatBot />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bg },
  scroll:      { padding: spacing.md, paddingBottom: 48 },
  sectionHeading: {
    color: colors.text2,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  fieldLabel:  { color: colors.text2, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  pickupSourceRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.md,
  },
  pickupSourceBtn: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupSourceBtnActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  pickupSourceText: {
    color: colors.text2,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pickupSourceTextActive: {
    color: colors.accent,
  },

  timeChip: {
    backgroundColor: colors.surface2,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeChipActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  timeChipText: { color: colors.text2, fontSize: 12, fontWeight: '600' },
  timeChipTextActive: { color: colors.accent, fontWeight: '700' },

  quickTimeBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickTimeText: { color: colors.text3, fontSize: 11, fontWeight: '600' },

  vehicleChip: { borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 10 },
  vehicleChipActive:     { borderColor: colors.accent, backgroundColor: colors.accentDim },
  vehicleChipText:       { color: colors.text2, fontSize: 14, fontWeight: '600' },
  vehicleChipTextActive: { color: colors.accent },

  vehicleSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  manageVehicleBtn: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  manageVehicleText: { color: colors.accent, fontSize: 11, fontWeight: '700' },

  vSelectChip: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  vSelectChipActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  vSelectText: { color: colors.text2, fontSize: 12 },
  vSelectTextActive: { color: colors.accent, fontWeight: '700' },

  womenToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: spacing.md },
  womenToggleActive: { borderColor: colors.pink, backgroundColor: 'rgba(233,30,140,0.08)' },
  womenToggleTitle: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  toggleDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.border },
  toggleDotActive: { backgroundColor: colors.pink },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  modalSub: { color: colors.text2, fontSize: 13, marginBottom: spacing.md },
  formatHintText: {
    color: colors.text3,
    fontSize: 11,
    marginTop: 4,
    marginBottom: 8,
  },
  lockedVehicleCard: {
    backgroundColor: '#0c1017',
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 6,
  },
  lockedVehicleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedVehicleName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  lockedPlate: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 2,
  },
  lockedBadge: {
    backgroundColor: colors.green + '22',
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lockedBadgeText: {
    color: colors.green,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  lockedPolicyNote: {
    color: colors.text3,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
  },
  vChoiceChip: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  vChoiceChipActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  vChoiceText: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '600',
  },
  vChoiceTextActive: {
    color: colors.accent,
    fontWeight: '800',
  },
  unregisteredNoticeCard: {
    backgroundColor: '#16130b',
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  unregisteredTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  unregisteredSub: {
    color: colors.text2,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 12,
  },
  goToProfileBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
  },
  goToProfileBtnText: {
    color: '#000',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
