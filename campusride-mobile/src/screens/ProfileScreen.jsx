import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert as RNAlert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Input, Btn, Alert, Card } from '../components/UI';
import FloatingChatBot from '../components/FloatingChatBot';
import { colors, spacing, radius } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../services/api';

const ROLE_LABEL  = { provider: 'Provider', seeker: 'Seeker', both: 'Provider & Seeker', admin: 'Admin' };
const KYC_COLOR   = { approved: colors.green, pending: colors.accent, rejected: colors.red, not_submitted: colors.text3, not_required: colors.text3 };

function ProfileRow({ label, value, accent }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={[styles.profileValue, accent && { color: colors.accent, fontWeight: '700' }]}>{value || '—'}</Text>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user: authUser, logout } = useAuth();
  const [profile,      setProfile]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone,     setNewPhone]     = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneMsg,     setPhoneMsg]     = useState('');
  const [phoneError,   setPhoneError]   = useState('');

  // Vehicle registration modal state
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [userVehicles,     setUserVehicles]     = useState([]);
  const [vNum,             setVNum]             = useState('');
  const [vName,            setVName]            = useState('');
  const [vType,            setVType]            = useState('car');
  const [vSaving,          setVSaving]          = useState(false);
  const [vErr,             setVErr]             = useState('');

  const VEHICLES_STORAGE_KEY = '@user_registered_vehicles_list';

  const fetchProfileAndVehicles = async () => {
    try {
      const cachedVehiclesStr = await AsyncStorage.getItem(VEHICLES_STORAGE_KEY).catch(() => null);
      const cachedVehicles = cachedVehiclesStr ? JSON.parse(cachedVehiclesStr) : [];

      const [pRes, vRes] = await Promise.allSettled([
        api.getProfile(),
        api.getUserVehicles(),
      ]);

      const p = pRes.status === 'fulfilled' ? pRes.value : null;
      if (p) {
        setProfile(p);
        setNewPhone(p.phone || '');
      }

      const remoteVehicles = vRes.status === 'fulfilled' && Array.isArray(vRes.value) ? vRes.value : [];
      const profileVehicles = (p?.vehicles && Array.isArray(p.vehicles)) ? p.vehicles : [];

      // Merge all sources by unique vehicleNumber without overwriting!
      const map = new Map();

      cachedVehicles.forEach(v => {
        if (v?.vehicleNumber) map.set(v.vehicleNumber.toUpperCase(), v);
      });

      profileVehicles.forEach(v => {
        if (v?.vehicleNumber) map.set(v.vehicleNumber.toUpperCase(), { ...map.get(v.vehicleNumber.toUpperCase()), ...v });
      });

      remoteVehicles.forEach(v => {
        if (v?.vehicleNumber) map.set(v.vehicleNumber.toUpperCase(), { ...map.get(v.vehicleNumber.toUpperCase()), ...v });
      });

      if (p?.kycDocuments?.vehicleNumber) {
        const kycVn = p.kycDocuments.vehicleNumber.toUpperCase();
        if (!map.has(kycVn)) {
          map.set(kycVn, {
            vehicleNumber: kycVn,
            vehicleName: p.kycDocuments.vehicleName || 'Vehicle',
            vehicleType: p.kycDocuments.vehicleType || 'car',
            status: p.kycDocuments.vehicleStatus || 'pending',
          });
        }
      }

      if (user?.kycDocuments?.vehicleNumber) {
        const uKycVn = user.kycDocuments.vehicleNumber.toUpperCase();
        if (!map.has(uKycVn)) {
          map.set(uKycVn, {
            vehicleNumber: uKycVn,
            vehicleName: user.kycDocuments.vehicleName || 'Vehicle',
            vehicleType: user.kycDocuments.vehicleType || 'car',
            status: user.kycDocuments.vehicleStatus || 'pending',
          });
        }
      }

      if (user?.vehicles && Array.isArray(user.vehicles)) {
        user.vehicles.forEach(v => {
          if (v?.vehicleNumber) map.set(v.vehicleNumber.toUpperCase(), { ...map.get(v.vehicleNumber.toUpperCase()), ...v });
        });
      }

      const merged = Array.from(map.values());
      setUserVehicles(merged);
      if (merged.length > 0) {
        AsyncStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(merged)).catch(() => {});
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndVehicles();
  }, []);

  const handleSaveVehicle = async () => {
    setVErr('');
    if (!vNum.trim()) { setVErr('Enter vehicle registration number'); return; }
    if (!vName.trim()) { setVErr('Enter vehicle model / name'); return; }
    setVSaving(true);
    try {
      const cleanNum = vNum.trim().toUpperCase();
      const cleanName = vName.trim();

      const newEntry = {
        vehicleNumber: cleanNum,
        vehicleName: cleanName,
        vehicleType: vType,
        status: 'pending',
      };

      // Merge with existing list so previous vehicles are NEVER replaced!
      const currentList = [...userVehicles];
      const existsIdx = currentList.findIndex(v => v.vehicleNumber === cleanNum);
      let updatedList = [];
      if (existsIdx >= 0) {
        currentList[existsIdx] = { ...currentList[existsIdx], ...newEntry };
        updatedList = currentList;
      } else {
        updatedList = [...currentList, newEntry];
      }

      setUserVehicles(updatedList);
      await AsyncStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(updatedList)).catch(() => {});

      // Sync with server
      await api.saveVehicle(newEntry).catch(() => {});

      setVNum('');
      setVName('');
      setShowVehicleModal(false);

      RNAlert.alert(
        '✅ Vehicle Submitted',
        `Vehicle ${cleanNum} (${cleanName}) submitted for admin verification. Verification will be completed within 24 hours.`,
        [{ text: 'OK' }]
      );
    } catch (e) {
      setVErr(e.message || 'Failed to submit vehicle details');
    } finally {
      setVSaving(false);
    }
  };

  const handlePhoneSave = async () => {
    setPhoneError('');
    if (!/^\d{10}$/.test(newPhone.replace(/\s/g, ''))) { setPhoneError('Enter a valid 10-digit number.'); return; }
    setPhoneLoading(true);
    try {
      const res = await api.updatePhoneNumber(newPhone.replace(/\s/g, ''));
      setProfile(p => ({ ...p, phone: res.phone, canChangePhone: false, phoneChangeCooldownDaysLeft: 90 }));
      setPhoneMsg('Phone updated successfully.');
      setEditingPhone(false);
    } catch (e) {
      setPhoneError(e.message || 'Failed to update phone.');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleLogout = () => {
    RNAlert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
    </SafeAreaView>
  );

  const p = profile;
  const initials = (p?.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const kycColor = KYC_COLOR[p?.kycStatus] || colors.text3;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Alert message={error} />

        {/* Avatar hero */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{p?.name}</Text>
          {p?.college && <Text style={styles.college}>🏫 {p.college}</Text>}
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{ROLE_LABEL[p?.role] || p?.role}</Text>
          </View>
        </View>

        {/* Personal info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <Text style={styles.readonlyNote}>ℹ️ Contact support to change name or email.</Text>

          <ProfileRow label="Full Name"      value={p?.name} />
          <ProfileRow label="Email"          value={p?.email} />
          <ProfileRow label="USN"            value={p?.usn} />
          <ProfileRow label="College"        value={p?.college} />
          <ProfileRow label="Gender"         value={p?.gender?.replace(/_/g, ' ')} />
          <ProfileRow label="Emergency"      value={p?.emergencyContact} />

          {/* Phone — editable once per 90 days */}
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Phone Number</Text>
            <View style={{ flex: 1 }}>
              {editingPhone ? (
                <View style={{ gap: 8 }}>
                  <Input
                    value={newPhone}
                    onChangeText={t => { setNewPhone(t.replace(/\D/g, '')); setPhoneError(''); }}
                    placeholder="10-digit number"
                    keyboardType="phone-pad"
                    maxLength={10}
                    containerStyle={{ marginBottom: 0 }}
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Btn label="Save" onPress={handlePhoneSave} loading={phoneLoading} style={{ flex: 1 }} />
                    <Btn label="Cancel" onPress={() => { setEditingPhone(false); setPhoneError(''); }} variant="outline" style={{ flex: 1 }} />
                  </View>
                  {phoneError && <Text style={{ color: colors.red, fontSize: 12 }}>{phoneError}</Text>}
                  {phoneMsg   && <Text style={{ color: colors.green, fontSize: 12 }}>{phoneMsg}</Text>}
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={styles.profileValue}>{p?.phone || '—'}</Text>
                  {p?.canChangePhone ? (
                    <TouchableOpacity onPress={() => setEditingPhone(true)}>
                      <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>Edit</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={{ color: colors.text3, fontSize: 11 }}>
                      🔒 Editable in {p?.phoneChangeCooldownDaysLeft ?? 90}d
                    </Text>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Verification */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Verification Status</Text>
          <ProfileRow label="KYC Status" value={p?.kycStatus?.replace(/_/g, ' ') || 'Not submitted'} />
          <View style={[styles.kycBadge, { borderColor: kycColor + '55', backgroundColor: kycColor + '15' }]}>
            <Text style={[styles.kycBadgeText, { color: kycColor }]}>
              {p?.kycStatus === 'approved' ? '✓ Verified' : p?.kycStatus === 'pending' ? '⏳ Under Review' : '⚠ Not Verified'}
            </Text>
          </View>
        </View>

        {/* ── VEHICLE DETAILS & 24-HR ADMIN REVIEW ── */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.sectionTitle}>
              Vehicle Details {(() => {
                const count = userVehicles.length > 0 ? userVehicles.length : (p?.kycDocuments?.vehicleNumber ? 1 : 0);
                return count > 0 ? `(${count})` : '';
              })()}
            </Text>
            <TouchableOpacity onPress={() => setShowVehicleModal(true)} style={styles.addVehicleBadgeBtn}>
              <Text style={styles.addVehicleBadgeText}>
                {(userVehicles.length > 0 || p?.kycDocuments?.vehicleNumber) ? '+ Add Another' : '+ Add Vehicle'}
              </Text>
            </TouchableOpacity>
          </View>

          {(() => {
            const list = [...userVehicles];
            if (list.length === 0 && p?.kycDocuments?.vehicleNumber) {
              list.push({
                vehicleNumber: p.kycDocuments.vehicleNumber,
                vehicleName: p.kycDocuments.vehicleName || 'Vehicle',
                vehicleType: p.kycDocuments.vehicleType || 'car',
                status: p.kycDocuments.vehicleStatus || 'pending',
              });
            }

            if (list.length === 0) {
              return (
                <View style={styles.emptyVehicleBlock}>
                  <Text style={{ fontSize: 24, marginBottom: 4 }}>🚗</Text>
                  <Text style={styles.emptyVehicleTitle}>No Vehicle Added</Text>
                  <Text style={styles.emptyVehicleSub}>
                    Add your vehicle details to offer rides to fellow students. It will be verified by admin within 24 hours.
                  </Text>
                  <Btn
                    label="🚗 + Add Vehicle Details"
                    onPress={() => setShowVehicleModal(true)}
                    style={{ marginTop: 10 }}
                  />
                </View>
              );
            }

            return (
              <View>
                {list.map((veh, idx) => {
                  const isPending = veh.status === 'pending' || p?.kycDocuments?.vehicleStatus === 'pending';
                  return (
                    <View key={idx} style={[styles.registeredVehicleCard, idx > 0 && { marginTop: 10 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={styles.vehicleIconCircle}>
                          <Text style={{ fontSize: 22 }}>{veh.vehicleType === 'motorcycle' ? '🏍️' : '🚗'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.vehicleNameHead}>
                            {veh.vehicleName || 'Vehicle'} • {(veh.vehicleType || 'Car').toUpperCase()}
                          </Text>
                          <Text style={styles.vehiclePlateHead}>{veh.vehicleNumber}</Text>
                        </View>
                        <View style={[
                          styles.vehicleStatusBadge,
                          isPending
                            ? { backgroundColor: colors.accent + '22', borderColor: colors.accent }
                            : { backgroundColor: colors.green + '22', borderColor: colors.green }
                        ]}>
                          <Text style={[
                            styles.vehicleStatusBadgeText,
                            isPending ? { color: colors.accent } : { color: colors.green }
                          ]}>
                            {isPending ? '⏳ In Review' : '✓ Verified'}
                          </Text>
                        </View>
                      </View>

                      {isPending ? (
                        <View style={styles.pendingReviewNotice}>
                          <Text style={styles.pendingReviewNoticeText}>
                            ⏳ Vehicle submitted for admin verification. Verification will be done in 24 hrs.
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}

                <TouchableOpacity
                  onPress={() => setShowVehicleModal(true)}
                  style={styles.addAnotherVehicleBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addAnotherVehicleText}>🚗 + Add Another Vehicle (Car / Bike / XUV)</Text>
                </TouchableOpacity>

                <Text style={styles.vehicleLockNote}>
                  🔒 Registered vehicle details are locked for campus safety. If you need to update an existing vehicle, contact support with your new RC.
                </Text>
              </View>
            );
          })()}
        </View>

        {/* Member since */}
        {p?.createdAt && (
          <Text style={styles.memberSince}>
            Member since {new Date(p.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </Text>
        )}

        {/* Actions */}
        <Btn label="📋 Update KYC" onPress={() => navigation.navigate('KYC')} variant="outline" style={{ marginBottom: 10 }} />
        <Btn label="⭐ My Ratings" onPress={() => navigation.navigate('Ratings')} variant="outline" style={{ marginBottom: 10 }} />
        <Btn label="📞 Contact Support" onPress={() => navigation.navigate('ContactSupport')} variant="ghost" style={{ marginBottom: 10 }} />
        <Btn label="Sign Out" onPress={handleLogout} variant="danger" style={{ marginTop: 8, marginBottom: 32 }} />
      </ScrollView>

      {/* Floating HOGO AI Assistant Button */}
      <FloatingChatBot />

      {/* Modal: Add Vehicle with 24-hr Admin Review Notice */}
      <Modal visible={showVehicleModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🚗 Add Vehicle</Text>
            <Text style={styles.modalSub}>
              Enter your vehicle details. Campus admin will verify your vehicle within 24 hours.
            </Text>

            {vErr ? <Alert message={vErr} /> : null}

            <Input
              label="Vehicle Registration Number *"
              icon="🔢"
              value={vNum}
              onChangeText={t => setVNum(t.toUpperCase())}
              placeholder="e.g. KA02AB1234"
              autoCapitalize="characters"
            />

            <Input
              label="Vehicle Model / Name *"
              icon="🚗"
              value={vName}
              onChangeText={setVName}
              placeholder="e.g. Honda Activa, Swift"
              autoCapitalize="words"
            />

            <Text style={styles.typeLabel}>VEHICLE TYPE</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {[
                { val: 'motorcycle', label: '🏍 Bike' },
                { val: 'car', label: '🚗 Car' },
                { val: 'suv', label: '🚙 SUV' },
              ].map(t => (
                <TouchableOpacity
                  key={t.val}
                  onPress={() => setVType(t.val)}
                  style={[styles.typeChip, vType === t.val && styles.typeChipActive]}
                >
                  <Text style={[styles.typeChipText, vType === t.val && styles.typeChipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.noticeBox24h}>
              <Text style={styles.noticeText24h}>
                ⏱️ Verification will be done by admin in 24 hrs. Once approved, you can offer rides on campus.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Btn label="Submit Vehicle" onPress={handleSaveVehicle} loading={vSaving} style={{ flex: 1 }} />
              <Btn label="Cancel" onPress={() => setShowVehicleModal(false)} variant="outline" style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 48 },
  hero: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: 28,
    alignItems: 'center', marginBottom: spacing.md,
  },
  avatar:     { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.accent + '55', marginBottom: 12 },
  avatarText: { color: colors.accent, fontSize: 26, fontWeight: '800' },
  name:    { color: colors.text,  fontSize: 22, fontWeight: '800', marginBottom: 4 },
  college: { color: colors.text2, fontSize: 13, marginBottom: 10 },
  roleBadge: { backgroundColor: colors.accentDim, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: colors.accent + '44' },
  roleBadgeText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md,
  },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  readonlyNote: { color: colors.text3, fontSize: 11, marginBottom: spacing.md },
  profileRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  profileLabel: { color: colors.text3, fontSize: 12, fontWeight: '600', flex: 0.4 },
  profileValue: { color: colors.text2, fontSize: 13, flex: 0.6, textAlign: 'right', textTransform: 'capitalize' },
  kycBadge: { borderRadius: radius.md, borderWidth: 1, padding: 10, alignItems: 'center', marginVertical: 8 },
  kycBadgeText: { fontSize: 14, fontWeight: '700' },
  memberSince: { color: colors.text3, fontSize: 12, textAlign: 'center', marginBottom: spacing.md },

  addVehicleBadgeBtn: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  addVehicleBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  registeredVehicleCard: {
    backgroundColor: '#0c1017',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    marginTop: 6,
  },
  vehicleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleNameHead: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  vehiclePlateHead: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 2,
  },
  vehicleStatusBadge: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  vehicleStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pendingReviewNotice: {
    backgroundColor: 'rgba(255,183,77,0.1)',
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    borderRadius: 4,
    padding: 10,
    marginTop: 10,
  },
  pendingReviewNoticeText: {
    color: colors.accent,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  addAnotherVehicleBtn: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  addAnotherVehicleText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  vehicleLockNote: {
    color: colors.text3,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  emptyVehicleBlock: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  emptyVehicleTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyVehicleSub: {
    color: colors.text3,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
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
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSub: {
    color: colors.text2,
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: spacing.md,
  },
  typeLabel: {
    color: colors.text2,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  typeChip: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 8,
    alignItems: 'center',
  },
  typeChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  typeChipText: {
    color: colors.text2,
    fontSize: 11.5,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: colors.accent,
    fontWeight: '800',
  },
  noticeBox24h: {
    backgroundColor: 'rgba(255, 183, 77, 0.1)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.3)',
    padding: 10,
    marginBottom: 8,
  },
  noticeText24h: {
    color: colors.accent,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '600',
  },
});
