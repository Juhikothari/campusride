import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    api.getUserVehicles()
      .then(list => {
        const vList = Array.isArray(list) ? list : [];
        setUserVehicles(vList);
        if (vList.length > 0) {
          setVehicleName(vList[0].vehicleName || '');
          setVehicleNumber(vList[0].vehicleNumber || '');
          if (vList[0].vehicleType) setVehicleType(vList[0].vehicleType);
        } else if (user?.kycDocuments?.vehicleNumber) {
          setVehicleNumber(user.kycDocuments.vehicleNumber);
          setVehicleName(user.kycDocuments.vehicleName || 'Car');
        }
      })
      .catch(() => {});
  }, [isProvider]);

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

          {/* ── VEHICLE TYPE ── */}
          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>VEHICLE TYPE</Text>
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

          {/* ── VEHICLE DETAILS & MULTI-VEHICLE SELECTOR ── */}
          <View style={styles.vehicleSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.sectionHeading}>VEHICLE DETAILS</Text>
              <TouchableOpacity onPress={() => setShowVehicleModal(true)} style={styles.manageVehicleBtn}>
                <Text style={styles.manageVehicleText}>+ Add / Change</Text>
              </TouchableOpacity>
            </View>

            {userVehicles.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {userVehicles.map((v, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.vSelectChip, selectedVIdx === i && styles.vSelectChipActive]}
                      onPress={() => handleSelectVehicle(v, i)}
                    >
                      <Text style={[styles.vSelectText, selectedVIdx === i && styles.vSelectTextActive]}>
                        🚗 {v.vehicleName || 'Vehicle'} ({v.vehicleNumber})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Input
                label="Vehicle Number"
                value={vehicleNumber}
                onChangeText={t => setVehicleNumber(t.toUpperCase())}
                placeholder="e.g. KA02KA1333"
                containerStyle={{ flex: 1 }}
                autoCapitalize="characters"
              />
              <Input
                label="Model / Name"
                value={vehicleName}
                onChangeText={setVehicleName}
                placeholder="e.g. Jupiter, Swift"
                containerStyle={{ flex: 1 }}
                autoCapitalize="words"
              />
            </View>
          </View>

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

          <Btn label="🚗 Post Ride on HOGO" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal: Add Missing Vehicle Details */}
      <Modal visible={showVehicleModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🚗 Add Vehicle Details</Text>
            <Text style={styles.modalSub}>Enter your vehicle info so campus riders can identify your vehicle.</Text>

            <Input
              label="Vehicle Registration Number"
              icon="🔢"
              value={modalVNum}
              onChangeText={t => setModalVNum(t.toUpperCase())}
              placeholder="KA02KA1333"
              autoCapitalize="characters"
            />
            <Input
              label="Vehicle Model / Name"
              icon="🚗"
              value={modalVName}
              onChangeText={setModalVName}
              placeholder="e.g. Jupiter, Swift Dezire"
              autoCapitalize="words"
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Btn label="Save Vehicle" onPress={handleSaveModalVehicle} loading={modalSaving} style={{ flex: 1 }} />
              <Btn label="Cancel" onPress={() => setShowVehicleModal(false)} variant="outline" style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
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
});
