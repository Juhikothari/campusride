import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Input, Btn, Alert, Card } from '../components/UI';
import { colors, spacing, radius } from '../theme';
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

  useEffect(() => {
    api.getProfile()
      .then(p => { setProfile(p); setNewPhone(p.phone || ''); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
          {p?.kycDocuments?.vehicleNumber && <ProfileRow label="Vehicle No." value={p.kycDocuments.vehicleNumber} accent />}
          {p?.kycDocuments?.vehicleName   && <ProfileRow label="Vehicle"     value={p.kycDocuments.vehicleName} />}
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
});
