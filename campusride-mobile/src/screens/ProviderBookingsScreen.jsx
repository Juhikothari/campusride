import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert as RNAlert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Alert, EmptyState, Btn } from '../components/UI';
import { useSocket } from '../hooks/useSocket';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';

const RIDE_STATUS_CONFIG = {
  active:        { color: colors.green,  icon: '🟢', label: 'Active'      },
  'in-progress': { color: colors.blue,   icon: '🔵', label: 'In Progress' },
  completed:     { color: colors.text3,  icon: '⚪', label: 'Completed'   },
  cancelled:     { color: colors.red,    icon: '🔴', label: 'Cancelled'   },
};

function getAddr(field) {
  if (!field) return '—';
  if (typeof field === 'string') return field;
  return field.address?.split(',')[0]?.trim() || '—';
}

function fmtDate(d) {
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
  catch { return '—'; }
}

export default function ProviderBookingsScreen({ navigation }) {
  const { user } = useAuth();
  const isProvider = user?.role === 'provider' || user?.role === 'both';

  const [myRides,       setMyRides]       = useState([]);
  const [selectedRide,  setSelectedRide]  = useState(null);
  const [bookings,      setBookings]      = useState([]);
  const [ridesLoading,  setRidesLoading]  = useState(true);
  const [bkLoading,     setBkLoading]     = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [error,         setError]         = useState('');
  const [actionMap,     setActionMap]     = useState({});

  const { socket, notifications } = useSocket(user?._id || user?.userId, 'provider');

  if (!isProvider) return (
    <SafeAreaView style={styles.safe}>
      <EmptyState icon="🚫" title="Access Denied" subtitle="Only providers can view ride requests." action={() => navigation.goBack()} actionLabel="Go Back" />
    </SafeAreaView>
  );

  const fetchRides = async () => {
    try {
      setError('');
      const r = await api.getMyRides();
      const list = Array.isArray(r) ? r : r?.rides || [];
      const sorted = [...list].sort((a, b) => {
        const order = { active: 0, 'in-progress': 1, completed: 2, cancelled: 3 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      });
      setMyRides(sorted);
      if (sorted.length && !selectedRide) {
        setSelectedRide(sorted[0]);
        loadBookings(sorted[0]._id);
      }
    } catch (e) { setError(e.message || 'Failed to load rides'); }
    finally { setRidesLoading(false); setRefreshing(false); }
  };

  const loadBookings = async (rideId) => {
    if (!rideId) return;
    setBkLoading(true);
    try {
      const data = await api.getRideBookings(rideId);
      setBookings(Array.isArray(data) ? data : data?.bookings || []);
    } catch (e) { setError(e.message || 'Failed to load requests'); }
    finally { setBkLoading(false); }
  };

  useEffect(() => {
    fetchRides();
  }, []);

  // Real-time: refresh bookings on socket notification
  useEffect(() => {
    if (notifications.length > 0 && selectedRide) {
      loadBookings(selectedRide._id);
    }
  }, [notifications]);

  const respond = async (bookingId, action) => {
    setActionMap(m => ({ ...m, [bookingId]: { loading: true } }));
    try {
      if (action === 'accepted') await api.acceptBooking(bookingId);
      else                       await api.rejectBooking(bookingId);
      setActionMap(m => ({ ...m, [bookingId]: { done: true } }));
      setBookings(prev => prev.map(b => b._id === bookingId ? { ...b, status: action } : b));
    } catch (e) {
      setActionMap(m => ({ ...m, [bookingId]: { error: e.message } }));
    }
  };

  const updateRideStatus = async (rideId, status) => {
    try {
      await api.updateRideStatus(rideId, status);
      setMyRides(prev => prev.map(r => r._id === rideId ? { ...r, status } : r));
      if (selectedRide?._id === rideId) setSelectedRide(r => ({ ...r, status }));
      if (status === 'in-progress') {
        navigation.navigate('LiveTracking', { rideId });
      }
    } catch (e) {
      RNAlert.alert('Error', e.message || 'Failed to update status');
    }
  };

  const pending  = bookings.filter(b => b.status === 'pending');
  const resolved = bookings.filter(b => b.status !== 'pending');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRides(); }} tintColor={colors.accent} />}
      >
        <Text style={styles.title}>Ride Requests</Text>
        <Alert message={error} />

        {/* My rides list */}
        {ridesLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : myRides.length === 0 ? (
          <EmptyState icon="🚗" title="No rides posted yet" action={() => navigation.navigate('OfferRide')} actionLabel="Post a Ride" />
        ) : (
          <>
            <Text style={styles.sectionLabel}>YOUR POSTED RIDES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {myRides.map(r => {
                  const cfg = RIDE_STATUS_CONFIG[r.status] || RIDE_STATUS_CONFIG.active;
                  const isSelected = selectedRide?._id === r._id;
                  return (
                    <TouchableOpacity
                      key={r._id}
                      style={[styles.rideChip, isSelected && styles.rideChipActive]}
                      onPress={() => { setSelectedRide(r); loadBookings(r._id); }}
                    >
                      <Text style={{ fontSize: 14 }}>{cfg.icon}</Text>
                      <View>
                        <Text style={[styles.rideChipDate, isSelected && { color: colors.accent }]}>{fmtDate(r.date)} · {r.time}</Text>
                        <Text style={styles.rideChipRoute} numberOfLines={1}>
                          {getAddr(r.pickup)} → {getAddr(r.drop)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </>
        )}

        {/* Selected ride details + bookings */}
        {selectedRide && (
          <>
            {/* Selected Ride Details Card */}
            <View style={styles.selectedRideCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={styles.selectedRideTitle}>SELECTED RIDE DETAILS</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('RideDetail', { rideId: selectedRide._id })}
                  style={styles.viewDetailBadge}
                >
                  <Text style={styles.viewDetailText}>Full View ↗</Text>
                </TouchableOpacity>
              </View>

              {/* Vehicle & Plate */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Text style={{ fontSize: 24 }}>
                  {selectedRide.vehicleType === 'motorcycle' || selectedRide.vehicleType === 'bike' ? '🏍️' : '🚗'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
                    {selectedRide.vehicleName || 'Vehicle'}
                  </Text>
                  <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                    {selectedRide.vehicleNumber ? `Reg: ${selectedRide.vehicleNumber}` : 'Verified Campus Vehicle'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.accent, fontSize: 18, fontWeight: '800' }}>
                    ₹{selectedRide.costPerSeat}
                  </Text>
                  <Text style={{ color: colors.text3, fontSize: 11 }}>per seat</Text>
                </View>
              </View>

              {/* Route */}
              <View style={styles.routeBox}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, marginTop: 2 }}>🟢</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text3, fontSize: 10, fontWeight: '700' }}>PICKUP</Text>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{getAddr(selectedRide.pickup)}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <Text style={{ fontSize: 13, marginTop: 2 }}>🔴</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text3, fontSize: 10, fontWeight: '700' }}>DROP</Text>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{getAddr(selectedRide.drop)}</Text>
                  </View>
                </View>
              </View>

              {/* Metadata pills */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>🗓 {fmtDate(selectedRide.date)}</Text>
                </View>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>⏰ {selectedRide.time}</Text>
                </View>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>💺 {selectedRide.seatsAvailable} seats available</Text>
                </View>
                {Boolean(selectedRide.womenOnly) && (
                  <View style={[styles.metaChip, { backgroundColor: 'rgba(233,30,99,0.15)', borderColor: 'rgba(233,30,99,0.4)' }]}>
                    <Text style={[styles.metaChipText, { color: '#ff4081' }]}>♀ Women Only</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Ride status controls */}
            {selectedRide.status === 'active' && (() => {
              const hasAccepted = bookings.some(b => b.status === 'accepted');
              const hasChecklist = selectedRide.seekerChecklistCompleted || bookings.some(b => b.status === 'accepted' && b.checklistCompleted);
              
              if (!hasAccepted) {
                return (
                  <View style={{ marginBottom: spacing.md }}>
                    <View style={{ backgroundColor: 'rgba(255,160,0,0.12)', borderWidth: 1, borderColor: colors.accent, borderRadius: radius.md, padding: 10, marginBottom: 8 }}>
                      <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>
                        ⏳ Waiting for Passenger: Accept a booking request below before starting.
                      </Text>
                    </View>
                    <Btn label="✕ Cancel Ride" onPress={() => updateRideStatus(selectedRide._id, 'cancelled')} variant="danger" />
                  </View>
                );
              }

              if (!hasChecklist) {
                return (
                  <View style={{ marginBottom: spacing.md }}>
                    <View style={{ backgroundColor: 'rgba(255,160,0,0.12)', borderWidth: 1, borderColor: colors.accent, borderRadius: radius.md, padding: 10, marginBottom: 8 }}>
                      <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>
                        ⏳ Passenger Checklist Pending: Passenger must complete pre-ride safety checklist before departure.
                      </Text>
                    </View>
                    <Btn label="✕ Cancel Ride" onPress={() => updateRideStatus(selectedRide._id, 'cancelled')} variant="danger" />
                  </View>
                );
              }

              return (
                <View style={styles.statusRow}>
                  <Btn label="▶ Start Ride & Track" onPress={() => updateRideStatus(selectedRide._id, 'in-progress')} style={{ flex: 1 }} />
                  <Btn label="✕ Cancel Ride" onPress={() => updateRideStatus(selectedRide._id, 'cancelled')} variant="danger" style={{ flex: 1 }} />
                </View>
              );
            })()}
            {selectedRide.status === 'in-progress' && (
              <View style={{ gap: 8, marginBottom: spacing.md }}>
                <Btn label="📍 Open Live Route & Tracking" onPress={() => navigation.navigate('LiveTracking', { rideId: selectedRide._id })} />
                <Btn label="🏁 Complete Ride" onPress={() => updateRideStatus(selectedRide._id, 'completed')} variant="outline" />
              </View>
            )}
            {selectedRide.status === 'cancelled' && (
              <View style={{ marginBottom: spacing.md }}>
                <Alert message={`🔴 Ride Cancelled${selectedRide.cancelReason ? `: ${selectedRide.cancelReason}` : ''}`} />
              </View>
            )}

            {/* Stats */}
            <View style={styles.statsRow}>
              <StatPill label="Pending" value={pending.length} color={colors.accent} />
              <StatPill label="Resolved" value={resolved.length} color={colors.green} />
              <StatPill label="Total" value={bookings.length} color={colors.blue} />
              <TouchableOpacity style={styles.refreshBtn} onPress={() => loadBookings(selectedRide._id)}>
                <Text style={{ color: colors.text2, fontSize: 13 }}>↻</Text>
              </TouchableOpacity>
            </View>

            {/* Pending */}
            <Text style={styles.sectionLabel}>PENDING REQUESTS ({pending.length})</Text>
            {bkLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : pending.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>📭</Text>
                <Text style={{ color: colors.text2, fontSize: 13 }}>No pending requests</Text>
              </View>
            ) : (
              pending.map(b => {
                const am = actionMap[b._id] || {};
                const seeker = b.seekerId;
                return (
                  <View key={b._id} style={styles.bookingCard}>
                    <View style={styles.seekerRow}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{seeker?.name?.charAt(0) || 'S'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.seekerName}>{seeker?.name || 'Seeker'}</Text>
                        <Text style={styles.seekerMeta}>💺 {b.seats || 1} seat{(b.seats || 1) > 1 ? 's' : ''} requested</Text>
                        {seeker?.college && <Text style={[styles.seekerMeta, { color: colors.text3 }]}>🏫 {seeker.college}</Text>}
                        <Text style={[styles.seekerMeta, { color: colors.text3, fontSize: 11, fontStyle: 'italic', marginTop: 2 }]}>
                          🔒 Phone & USN revealed after accepting
                        </Text>
                        <Text style={[styles.seekerMeta, { color: colors.text3, fontSize: 10, marginTop: 2 }]}>
                          {new Date(b.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                        </Text>
                      </View>
                    </View>

                    <Alert message={am.error} />
                    {am.done ? (
                      <Text style={{ color: colors.green, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 8 }}>✓ Action taken</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                        <Btn label={am.loading ? '…' : '✓ Accept'} onPress={() => respond(b._id, 'accepted')} loading={am.loading} style={{ flex: 1 }} />
                        <Btn label="✕ Reject" onPress={() => respond(b._id, 'rejected')} variant="danger" disabled={am.loading} style={{ flex: 1 }} />
                      </View>
                    )}
                  </View>
                );
              })
            )}

            {/* Resolved */}
            {resolved.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>CONFIRMED / RESOLVED ({resolved.length})</Text>
                {resolved.map(b => {
                  const seeker = b.seekerId;
                  const isAccepted = b.status === 'accepted';
                  return (
                    <View key={b._id} style={[styles.bookingCard, !isAccepted && { opacity: 0.7 }]}>
                      <View style={styles.seekerRow}>
                        <View style={[styles.avatar, isAccepted && { borderColor: colors.green, backgroundColor: colors.green + '22' }]}>
                          <Text style={[styles.avatarText, isAccepted && { color: colors.green }]}>{seeker?.name?.charAt(0) || 'S'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.seekerName}>{seeker?.name || 'Seeker'}</Text>
                          {isAccepted && seeker?.usn ? (
                            <Text style={styles.seekerMeta}>🪪 USN: <Text style={{ color: colors.text, fontWeight: '700' }}>{seeker.usn}</Text></Text>
                          ) : null}
                          {isAccepted && seeker?.phone ? (
                            <Text style={styles.seekerMeta}>📞 Phone: <Text style={{ color: colors.accent, fontWeight: '700' }}>{seeker.phone}</Text></Text>
                          ) : null}
                          {seeker?.college && <Text style={[styles.seekerMeta, { color: colors.text3 }]}>🏫 {seeker.college}</Text>}
                        </View>
                        <Text style={[styles.statusBadge, {
                          color: isAccepted ? colors.green : colors.red,
                          borderColor: isAccepted ? colors.green : colors.red,
                        }]}>{b.status}</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatPill({ label, value, color }) {
  return (
    <View style={{ alignItems: 'center', backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 8 }}>
      <Text style={{ color, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.text3, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 48 },
  title:  { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: spacing.md },
  sectionLabel: { color: colors.text3, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  rideChip: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180,
  },
  rideChipActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  rideChipDate:   { color: colors.text, fontSize: 13, fontWeight: '700' },
  rideChipRoute:  { color: colors.text2, fontSize: 11, marginTop: 2, maxWidth: 160 },
  statusRow:  { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  statsRow:   { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: spacing.md },
  refreshBtn: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: 10 },
  emptyBox:   { backgroundColor: colors.surface2, borderRadius: radius.lg, padding: 24, alignItems: 'center', marginBottom: spacing.md },
  bookingCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: 10,
  },
  seekerRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.accent + '44' },
  avatarText: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  seekerName: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  seekerMeta: { color: colors.text2, fontSize: 12, marginBottom: 2 },
  statusBadge: { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, textTransform: 'capitalize' },
  selectedRideCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  selectedRideTitle: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  viewDetailBadge: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent + '66',
  },
  viewDetailText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  routeBox: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 10,
    gap: 6,
  },
  metaChip: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaChipText: {
    color: colors.text2,
    fontSize: 11,
    fontWeight: '600',
  },
});
