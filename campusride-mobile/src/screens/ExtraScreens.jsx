import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Btn, Alert, Card } from '../components/UI';
import FloatingChatBot from '../components/FloatingChatBot';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';

// ════════════════════════════════════════════════════════════════
//  RATINGS SCREEN
// ════════════════════════════════════════════════════════════════
function StarRow({ value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onChange?.(n)}>
          <Text style={{ fontSize: 28, color: n <= value ? colors.accent : colors.text3 }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function RatingsScreen({ navigation }) {
  const { user } = useAuth();
  const [ratings,     setRatings]     = useState([]);
  const [pastRides,   setPastRides]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState({ rating: 0, comment: '' });
  const [selectedRide,setSelectedRide]= useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');

  useEffect(() => {
    const userId = user?._id || user?.userId;
    Promise.all([
      api.getMyRatings().then(setRatings).catch(() => {}),
      api.getMyBookings().then(b => setPastRides(b.filter(bk => bk.status === 'accepted'))).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const submitRating = async () => {
    if (!selectedRide) { setError('Select a ride to rate'); return; }
    if (form.rating < 1) { setError('Please select a star rating'); return; }
    setError(''); setSubmitting(true);
    try {
      const r = await api.submitRating({
        rideId:   selectedRide.rideId?._id || selectedRide.rideId,
        reviewee: selectedRide.rideId?.providerId?._id || selectedRide.rideId?.providerId,
        rating:   form.rating,
        comment:  form.comment,
      });
      setRatings(prev => [r, ...prev]);
      setSuccess('Rating submitted! Thank you.');
      setShowForm(false);
      setForm({ rating: 0, comment: '' });
      setSelectedRide(null);
    } catch (e) {
      setError(e.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  const avg = ratings.length > 0
    ? (ratings.reduce((s, r) => s + (r.rating || 0), 0) / ratings.length).toFixed(1)
    : '—';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.text2, fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.md }}>⭐ Ratings</Text>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.bigNum}>{avg}</Text>
          <StarRow value={Math.round(parseFloat(avg) || 0)} />
          <Text style={{ color: colors.text2, fontSize: 12, marginTop: 8 }}>{ratings.length} review{ratings.length !== 1 ? 's' : ''}</Text>
        </View>

        <Alert message={error} />
        <Alert message={success} type="success" />

        {/* Rate a ride */}
        {pastRides.length > 0 && (
          <TouchableOpacity style={styles.addRatingBtn} onPress={() => setShowForm(s => !s)}>
            <Text style={styles.addRatingBtnText}>{showForm ? '✕ Cancel' : '+ Rate a Ride'}</Text>
          </TouchableOpacity>
        )}

        {showForm && (
          <View style={styles.formCard}>
            <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>SELECT RIDE</Text>
            {pastRides.map(bk => {
              const r = bk.rideId;
              const isSelected = selectedRide?._id === bk._id;
              return (
                <TouchableOpacity
                  key={bk._id}
                  onPress={() => setSelectedRide(bk)}
                  style={[styles.rideChip, isSelected && styles.rideChipActive]}
                >
                  <Text style={{ color: isSelected ? colors.accent : colors.text2, fontSize: 12 }} numberOfLines={1}>
                    {r?.pickup?.address?.split(',')[0] || '?'} → {r?.drop?.address?.split(',')[0] || '?'} ·{' '}
                    {r?.date ? new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 8 }}>YOUR RATING</Text>
            <StarRow value={form.rating} onChange={n => setForm(f => ({ ...f, rating: n }))} />
            <TextInput
              style={[styles.input, { marginTop: 12, height: 80, textAlignVertical: 'top' }]}
              value={form.comment}
              onChangeText={t => setForm(f => ({ ...f, comment: t }))}
              placeholder="Leave a comment (optional)…"
              placeholderTextColor={colors.text3}
              multiline
              maxLength={300}
            />
            <Btn label="Submit Rating" onPress={submitRating} loading={submitting} style={{ marginTop: 12 }} />
          </View>
        )}

        {/* List */}
        {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} /> : (
          ratings.length === 0 ? (
            <Text style={{ color: colors.text2, textAlign: 'center', marginTop: 24, fontSize: 13 }}>No ratings yet.</Text>
          ) : ratings.map((r, i) => (
            <View key={r._id || i} style={styles.ratingCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>
                  {r.reviewer?.name || 'Anonymous'}
                </Text>
                <StarRow value={r.rating} />
              </View>
              {r.comment && <Text style={{ color: colors.text2, fontSize: 13 }}>{r.comment}</Text>}
              <Text style={{ color: colors.text3, fontSize: 11, marginTop: 4 }}>
                {r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : ''}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════
//  ADMIN DASHBOARD SCREEN
// ════════════════════════════════════════════════════════════════
export function AdminDashboardScreen({ navigation }) {
  const [stats,   setStats]   = useState(null);
  const [users,   setUsers]   = useState([]);
  const [kycList, setKycList] = useState([]);
  const [tab,     setTab]     = useState('overview');
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState({});
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    Promise.all([
      api.getAdminStats().then(setStats).catch(() => {}),
      api.getAllUsers().then(setUsers).catch(() => {}),
      api.getKycRequests().then(setKycList).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const act = async (id, action, reason) => {
    setActing(a => ({ ...a, [id]: true }));
    try {
      if (action === 'block')    { await api.blockUser(id, reason);   setUsers(u => u.map(x => x._id === id ? { ...x, isBlocked: true } : x)); }
      if (action === 'unblock')  { await api.unblockUser(id);         setUsers(u => u.map(x => x._id === id ? { ...x, isBlocked: false } : x)); }
      if (action === 'approveKyc') { await api.approveKyc(id);       setKycList(k => k.filter(x => x._id !== id)); }
      if (action === 'rejectKyc') { await api.rejectKyc(id, reason); setKycList(k => k.filter(x => x._id !== id)); }
    } catch (e) { console.warn(e.message); }
    finally { setActing(a => ({ ...a, [id]: false })); }
  };

  const filteredUsers = users.filter(u =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.college?.toLowerCase().includes(search.toLowerCase())
  );

  const TABS = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'users',    label: `👥 Users (${users.length})` },
    { key: 'kyc',      label: `🪪 KYC (${kycList.length})` },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.accent, fontSize: 22, fontWeight: '800', marginBottom: spacing.md }}>🛡️ Admin Dashboard</Text>

        {/* Tab bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {TABS.map(t => (
              <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}
                style={[styles.tabChip, tab === t.key && styles.tabChipActive]}>
                <Text style={[styles.tabChipText, tab === t.key && styles.tabChipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {loading ? <ActivityIndicator color={colors.accent} /> : (
          <>
            {/* Overview */}
            {tab === 'overview' && stats && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {[
                  { label: 'Users',     value: stats.totalUsers    || 0, color: colors.accent },
                  { label: 'Rides',     value: stats.totalRides    || 0, color: colors.blue   },
                  { label: 'Bookings',  value: stats.totalBookings || 0, color: colors.green  },
                  { label: 'KYC Pending',value:stats.pendingKyc   || 0, color: colors.red    },
                ].map(s => (
                  <View key={s.label} style={[styles.statCard, { borderColor: s.color + '44' }]}>
                    <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Users */}
            {tab === 'users' && (
              <>
                <TextInput style={styles.input} value={search} onChangeText={setSearch}
                  placeholder="Search by name, email, college…" placeholderTextColor={colors.text3} />
                {filteredUsers.map(u => (
                  <View key={u._id} style={styles.userCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{u.name}</Text>
                      <Text style={{ color: colors.text2, fontSize: 11 }}>{u.email}</Text>
                      <Text style={{ color: colors.text3, fontSize: 11 }}>{u.college} · {u.role}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => act(u._id, u.isBlocked ? 'unblock' : 'block', 'Admin action')}
                      disabled={acting[u._id]}
                      style={[styles.userActionBtn, { borderColor: u.isBlocked ? colors.green : colors.red }]}
                    >
                      <Text style={{ color: u.isBlocked ? colors.green : colors.red, fontSize: 11, fontWeight: '700' }}>
                        {acting[u._id] ? '…' : u.isBlocked ? 'Unblock' : 'Block'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {/* KYC */}
            {tab === 'kyc' && (
              kycList.length === 0 ? (
                <Text style={{ color: colors.text2, textAlign: 'center', marginTop: 24 }}>No pending KYC requests.</Text>
              ) : kycList.map(k => (
                <View key={k._id} style={styles.kycCard}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 2 }}>{k.userId?.name || 'User'}</Text>
                  <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 8 }}>{k.userId?.email} · {k.userId?.college}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity disabled={acting[k._id]} onPress={() => act(k._id, 'approveKyc')}
                      style={[styles.kycBtn, { backgroundColor: colors.greenDim, borderColor: colors.green + '55' }]}>
                      <Text style={{ color: colors.green, fontWeight: '700', fontSize: 12 }}>{acting[k._id] ? '…' : '✓ Approve'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity disabled={acting[k._id]} onPress={() => act(k._id, 'rejectKyc', 'Documents unclear')}
                      style={[styles.kycBtn, { backgroundColor: colors.redDim, borderColor: colors.red + '55' }]}>
                      <Text style={{ color: colors.red, fontWeight: '700', fontSize: 12 }}>{acting[k._id] ? '…' : '✕ Reject'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════
//  RESET PASSWORD SCREEN (OTP flow)
// ════════════════════════════════════════════════════════════════
export function ResetPasswordScreen({ navigation }) {
  const STEP = { EMAIL: 'email', OTP: 'otp', PASSWORD: 'password', DONE: 'done' };
  const [step,       setStep]       = useState(STEP.EMAIL);
  const [email,      setEmail]      = useState('');
  const [otp,        setOtp]        = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const inp = { backgroundColor:colors.surface2, borderWidth:1, borderColor:colors.border, borderRadius:radius.md, color:colors.text, paddingHorizontal:14, paddingVertical:12, fontSize:14, marginBottom:12 };

  const sendOtp = async () => {
    if (!email.trim()) { setError('Enter your email'); return; }
    setError(''); setLoading(true);
    try {
      await api.forgotPassword(email.trim().toLowerCase());
      setStep(STEP.OTP);
    } catch (e) { setError(e.message || 'Failed to send OTP'); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (otp.length < 4) { setError('Enter the OTP from your email'); return; }
    setError(''); setLoading(true);
    try {
      // Backend verifies OTP and returns a reset token
      const data = await api.resetPassword(otp, null); // adjust if your API differs
      setResetToken(otp); // fallback: use OTP as token
      setStep(STEP.PASSWORD);
    } catch (e) {
      setError(e.message || 'Invalid OTP');
    } finally { setLoading(false); }
  };

  const setNewPassword = async () => {
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setError(''); setLoading(true);
    try {
      await api.resetPassword(resetToken, password);
      setStep(STEP.DONE);
    } catch (e) { setError(e.message || 'Failed to reset password'); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 20 }}>
          <Text style={{ color: colors.text2, fontSize: 14 }}>← Back to Login</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 6 }}>🔐 Reset Password</Text>
        <Alert message={error} />

        {step === STEP.EMAIL && (
          <>
            <Text style={{ color: colors.text2, fontSize: 13, marginBottom: 16 }}>Enter your college email. We'll send an OTP.</Text>
            <TextInput style={inp} value={email} onChangeText={setEmail} placeholder="you@college.edu" placeholderTextColor={colors.text3} keyboardType="email-address" autoCapitalize="none" />
            <Btn label="Send OTP →" onPress={sendOtp} loading={loading} />
          </>
        )}
        {step === STEP.OTP && (
          <>
            <Text style={{ color: colors.text2, fontSize: 13, marginBottom: 16 }}>Enter the OTP sent to {email}</Text>
            <TextInput style={inp} value={otp} onChangeText={setOtp} placeholder="6-digit OTP" placeholderTextColor={colors.text3} keyboardType="number-pad" maxLength={6} />
            <Btn label="Verify OTP →" onPress={verifyOtp} loading={loading} />
          </>
        )}
        {step === STEP.PASSWORD && (
          <>
            <Text style={{ color: colors.text2, fontSize: 13, marginBottom: 16 }}>Enter your new password</Text>
            <TextInput style={inp} value={password} onChangeText={setPassword} placeholder="New password (min 6 chars)" placeholderTextColor={colors.text3} secureTextEntry />
            <TextInput style={inp} value={confirm}  onChangeText={setConfirm}  placeholder="Confirm new password"       placeholderTextColor={colors.text3} secureTextEntry />
            <Btn label="Reset Password" onPress={setNewPassword} loading={loading} />
          </>
        )}
        {step === STEP.DONE && (
          <View style={{ alignItems: 'center', paddingTop: 24 }}>
            <Text style={{ fontSize: 52, marginBottom: 16 }}>✅</Text>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 8 }}>Password Reset!</Text>
            <Text style={{ color: colors.text2, fontSize: 13, marginBottom: 24 }}>You can now log in with your new password.</Text>
            <Btn label="Go to Login" onPress={() => navigation.navigate('Login')} style={{ width: '100%' }} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════
//  PRE-RIDE CHECKLIST SCREEN
// ════════════════════════════════════════════════════════════════
const CHECKS = [
  { key: 'matchDriver',   label: 'I verified the provider name & college identity' },
  { key: 'vehicleNumber', label: 'I matched the vehicle registration plate & model' },
  { key: 'gearSafety',    label: 'I am wearing helmet (bike) or seatbelt (car)' },
  { key: 'routeKnown',    label: 'I confirmed my exact pickup & drop destination' },
  { key: 'toldSomeone',   label: 'I have shared my ride status with an emergency contact' },
  { key: 'sosKnown',      label: 'I know how to use the in-app SOS emergency button' },
];

export function PreRideChecklistScreen({ route, navigation }) {
  const rideId = route?.params?.rideId;
  const { user } = useAuth();
  const [checks, setChecks] = useState(Object.fromEntries(CHECKS.map(c => [c.key, false])));
  const [rideDetails, setRideDetails] = useState(null);
  const [starting, setStarting] = useState(false);
  const done    = Object.values(checks).filter(Boolean).length;
  const allDone = done === CHECKS.length;

  const isDriver = rideDetails && (
    (rideDetails.providerId?._id && rideDetails.providerId._id === user?._id) ||
    rideDetails.providerId === user?._id ||
    rideDetails.providerName === user?.name
  );

  const [isChecklistSaved, setIsChecklistSaved] = useState(false);

  useEffect(() => {
    if (!rideId) return;
    const storageKey = `@checklist_done_${rideId}_${user?._id || 'user'}`;
    AsyncStorage.getItem(storageKey).then(val => {
      if (val === 'true') {
        setChecks(Object.fromEntries(CHECKS.map(c => [c.key, true])));
        setIsChecklistSaved(true);
      }
    }).catch(() => {});
  }, [rideId, user?._id]);

  useEffect(() => {
    if (rideId) {
      api.getRideById(rideId).then(r => setRideDetails(r)).catch(() => {});
    }
  }, [rideId]);

  const handleProceed = async () => {
    if (!allDone) return;
    if (!rideId) { navigation.goBack(); return; }

    const storageKey = `@checklist_done_${rideId}_${user?._id || 'user'}`;
    await AsyncStorage.setItem(storageKey, 'true').catch(() => {});
    setIsChecklistSaved(true);

    if (isDriver) {
      // Provider starts the ride
      setStarting(true);
      try {
        await api.startRide(rideId);
        navigation.replace('LiveTracking', { rideId });
      } catch (err) {
        // If already in-progress, proceed
        navigation.replace('LiveTracking', { rideId });
      } finally {
        setStarting(false);
      }
    } else {
      // Seeker
      if (rideDetails?.status === 'in-progress') {
        navigation.replace('LiveTracking', { rideId });
      } else {
        RNAlert.alert(
          '✅ Safety Checklist Verified',
          'All pre-ride checks verified! Live GPS tracking will activate as soon as the driver starts the ride.',
          [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
        );
      }
    }
  };

  const getButtonLabel = () => {
    if (!allDone) return `${done}/${CHECKS.length} checked — please verify all`;
    if (isDriver) return '🚀 Everything Checked — Start Ride Now →';
    if (rideDetails?.status === 'in-progress') return '📍 Driver Started Ride — Open Live Map →';
    return isChecklistSaved
      ? '✅ Checklist Already Verified • Waiting for Driver'
      : '✅ Checklist Verified • Waiting for Driver to Start';
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.text2, fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 4 }}>🛡️ Pre-Ride Safety Checklist</Text>
        <Text style={{ color: colors.text2, fontSize: 13, marginBottom: spacing.md }}>
          {isDriver
            ? 'Confirm safety checks before giving the option to start the ride for your passengers.'
            : 'Verify your assigned ride details and safety checks before departure.'}
        </Text>

        {/* Assigned Ride & Driver Info Card */}
        {rideDetails && (
          <View style={{ backgroundColor: '#10141e', borderWidth: 1, borderColor: colors.accent, borderRadius: radius.lg, padding: 14, marginBottom: 16 }}>
            <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 }}>ASSIGNED RIDE DETAILS</Text>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
              👤 {rideDetails.providerId?.name || rideDetails.providerName || 'Campus Commuter'} • 🏫 {rideDetails.college || 'Campus'}
            </Text>
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '800', marginTop: 4 }}>
              🚘 {rideDetails.vehicleName || 'Vehicle'} ({rideDetails.vehicleNumber || 'Plate Number'})
            </Text>
            <Text style={{ color: colors.text3, fontSize: 12, marginTop: 4 }}>
              Status: <Text style={{ color: rideDetails.status === 'in-progress' ? colors.green : colors.accent, fontWeight: '700' }}>
                {rideDetails.status === 'in-progress' ? '🟢 In Progress (Live)' : '⏳ Pre-Departure (Not Started)'}
              </Text>
            </Text>
          </View>
        )}

        {/* Progress bar */}
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${(done / CHECKS.length) * 100}%` }]} />
        </View>
        <Text style={{ color: colors.text2, fontSize: 12, marginBottom: spacing.md }}>{done} / {CHECKS.length} completed</Text>

        {CHECKS.map(c => (
          <TouchableOpacity
            key={c.key}
            onPress={() => setChecks(ch => ({ ...ch, [c.key]: !ch[c.key] }))}
            style={[styles.checkRow, checks[c.key] && styles.checkRowDone]}
          >
            <View style={[styles.checkBox, checks[c.key] && styles.checkBoxDone]}>
              {checks[c.key] && <Text style={{ color: '#000', fontWeight: '800', fontSize: 12 }}>✓</Text>}
            </View>
            <Text style={[styles.checkLabel, checks[c.key] && { color: colors.text }]}>{c.label}</Text>
          </TouchableOpacity>
        ))}

        <Btn
          label={getButtonLabel()}
          onPress={handleProceed}
          disabled={!allDone || starting}
          loading={starting}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
      <FloatingChatBot />
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════
//  CONTACT SUPPORT SCREEN
// ════════════════════════════════════════════════════════════════
const FAQS = [
  { q: 'How do I reset my password?',     a: "Go to login and tap 'Forgot Password'. Enter your college email and we'll send an OTP." },
  { q: 'My booking is not showing up',     a: 'Go to My Bookings and pull to refresh. Check your internet connection.' },
  { q: 'Why is my KYC pending?',           a: 'KYC is reviewed by admins within 24–48 hours. You\'ll get a notification once approved.' },
  { q: 'Can I cancel a booking?',          a: 'Yes — go to My Bookings, find the booking and tap Cancel. Allowed until the ride starts.' },
  { q: 'I didn\'t receive my OTP',         a: 'Check your spam folder. Use your college email. Wait 2 mins and try resend.' },
  { q: 'How do I report a safety issue?',  a: 'Go to Report Incident from the dashboard. For emergencies, use the SOS button in live tracking.' },
  { q: 'Why can\'t I start my ride?',      a: 'Accept at least one booking request first. Go to Ride Requests and accept a booking.' },
];

export function ContactSupportScreen({ navigation }) {
  const { user } = useAuth();
  const [openFaq,  setOpenFaq]  = useState(null);
  const [subject,  setSubject]  = useState('');
  const [message,  setMessage]  = useState('');
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [error,    setError]    = useState('');

  const send = async () => {
    if (!subject.trim() || !message.trim()) { setError('Fill in subject and message'); return; }
    setSending(true); setError('');
    try {
      // hits /api/auth/contact-support on backend
      const token = await api.getToken();
      await fetch(`${api.API_BASE}/api/auth/contact-support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          fromName:  user?.name    || 'App User',
          fromEmail: user?.email   || 'unknown',
          college:   user?.college || '',
          role:      user?.role    || '',
          subject, message,
        }),
      });
      setSent(true);
    } catch (e) { setError(e.message || 'Failed to send. Email us at support@campusride.in'); }
    finally { setSending(false); }
  };

  const inp = { backgroundColor:colors.surface2, borderWidth:1, borderColor:colors.border, borderRadius:radius.md, color:colors.text, paddingHorizontal:14, paddingVertical:12, fontSize:14, marginBottom:12 };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.text2, fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 4 }}>📞 Contact Support</Text>
        <Text style={{ color: colors.text2, fontSize: 13, marginBottom: spacing.lg }}>We typically respond within 24 hours</Text>

        {/* FAQ */}
        <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '700', marginBottom: 10 }}>FREQUENTLY ASKED QUESTIONS</Text>
        {FAQS.map((f, i) => (
          <TouchableOpacity key={i} style={styles.faqRow} onPress={() => setOpenFaq(openFaq === i ? null : i)}>
            <Text style={{ color: colors.text, fontSize: 13, flex: 1, fontWeight: '600' }}>{f.q}</Text>
            <Text style={{ color: colors.text3, fontSize: 16 }}>{openFaq === i ? '▲' : '▼'}</Text>
            {openFaq === i && (
              <Text style={{ color: colors.text2, fontSize: 13, marginTop: 8, lineHeight: 19, width: '100%' }}>{f.a}</Text>
            )}
          </TouchableOpacity>
        ))}

        {/* Contact form */}
        <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '700', marginTop: spacing.lg, marginBottom: 10 }}>SEND A MESSAGE</Text>
        <Alert message={error} />
        {sent ? (
          <Alert message="Message sent! We'll get back to you within 24 hours." type="success" />
        ) : (
          <>
            <TextInput style={inp} value={subject} onChangeText={setSubject} placeholder="Subject" placeholderTextColor={colors.text3} />
            <TextInput style={[inp, { height: 100, textAlignVertical: 'top' }]} value={message} onChangeText={setMessage} placeholder="Describe your issue in detail…" placeholderTextColor={colors.text3} multiline maxLength={1000} />
            <Btn label={sending ? 'Sending…' : '📩 Send Message'} onPress={send} loading={sending} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════
//  Shared styles
// ════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 48 },

  summaryCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth:1, borderColor:colors.border, padding:28, alignItems:'center', marginBottom:spacing.md },
  bigNum: { color: colors.accent, fontSize: 60, fontWeight: '800', lineHeight: 68 },

  addRatingBtn: { backgroundColor: colors.accentDim, borderRadius: radius.md, borderWidth:1, borderColor:colors.accent+'44', padding:12, alignItems:'center', marginBottom:spacing.md },
  addRatingBtnText: { color: colors.accent, fontWeight:'700', fontSize:14 },

  formCard: { backgroundColor:colors.surface2, borderRadius:radius.xl, borderWidth:1, borderColor:colors.border, padding:spacing.md, marginBottom:spacing.md },
  rideChip: { borderRadius:radius.md, borderWidth:1.5, borderColor:colors.border, padding:10, marginBottom:6 },
  rideChipActive: { borderColor:colors.accent, backgroundColor:colors.accentDim },

  ratingCard: { backgroundColor:colors.surface, borderRadius:radius.xl, borderWidth:1, borderColor:colors.border, padding:spacing.md, marginBottom:10 },

  input: { backgroundColor:colors.surface2, borderWidth:1, borderColor:colors.border, borderRadius:radius.md, color:colors.text, paddingHorizontal:14, paddingVertical:12, fontSize:14, marginBottom:12 },

  tabChip: { borderRadius:radius.full, borderWidth:1.5, borderColor:colors.border, paddingHorizontal:14, paddingVertical:8 },
  tabChipActive: { borderColor:colors.accent, backgroundColor:colors.accentDim },
  tabChipText: { color:colors.text2, fontSize:13, fontWeight:'600' },
  tabChipTextActive: { color:colors.accent },

  statCard: { width:'47%', backgroundColor:colors.surface, borderRadius:radius.lg, borderWidth:1, padding:16, alignItems:'center' },
  statNum:  { fontSize:32, fontWeight:'800', marginBottom:4 },
  statLabel:{ color:colors.text2, fontSize:12 },

  userCard: { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:colors.surface, borderRadius:radius.lg, borderWidth:1, borderColor:colors.border, padding:12, marginBottom:8 },
  userActionBtn: { borderRadius:radius.md, borderWidth:1.5, paddingHorizontal:12, paddingVertical:6 },

  kycCard: { backgroundColor:colors.surface, borderRadius:radius.xl, borderWidth:1, borderColor:colors.border, padding:spacing.md, marginBottom:10 },
  kycBtn:  { flex:1, borderRadius:radius.md, borderWidth:1, padding:10, alignItems:'center' },

  progressBg:   { height:6, backgroundColor:colors.surface2, borderRadius:3, marginBottom:8 },
  progressFill: { height:6, backgroundColor:colors.accent, borderRadius:3 },
  checkRow:   { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:colors.surface2, borderRadius:radius.lg, borderWidth:1.5, borderColor:colors.border, padding:14, marginBottom:10 },
  checkRowDone: { borderColor:colors.green+'55', backgroundColor:'rgba(45,212,160,0.06)' },
  checkBox:     { width:22, height:22, borderRadius:6, borderWidth:2, borderColor:colors.border, alignItems:'center', justifyContent:'center' },
  checkBoxDone: { backgroundColor:colors.accent, borderColor:colors.accent },
  checkLabel:   { color:colors.text2, fontSize:13, flex:1 },

  faqRow: { backgroundColor:colors.surface2, borderRadius:radius.lg, borderWidth:1, borderColor:colors.border, padding:14, marginBottom:8, flexDirection:'row', flexWrap:'wrap', alignItems:'flex-start', gap:4 },
});
