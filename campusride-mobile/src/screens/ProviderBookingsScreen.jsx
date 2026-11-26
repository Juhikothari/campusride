import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert as RNAlert, RefreshControl,
  Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Alert, EmptyState, Btn } from '../components/UI';
import TopHeader from '../components/TopHeader';
import { RatingModal } from './ExtraScreens';
import { useSocket } from '../hooks/useSocket';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';
import { openGoogleMaps } from '../utils/maps';
import { getDisplayUSN } from '../utils/usn';
import { formatDateDMY } from '../utils/date';

const RIDE_STATUS_CONFIG = {
  active:        { color: colors.accent, icon: '🚗', label: 'Requested'   },
  'in-progress': { color: colors.red,    icon: '⚡', label: 'Live Track'  },
  completed:     { color: colors.green,  icon: '✓',  label: 'Completed'   },
  cancelled:     { color: colors.text3,  icon: '✕',  label: 'Cancelled'   },
};

function getAddr(field) {
  if (!field) return '—';
  if (typeof field === 'string') return field;
  return field.address?.split(',')[0]?.trim() || '—';
}

function fmtDate(d) {
  return formatDateDMY(d);
}

export default function ProviderBookingsScreen({ navigation }) {
  const { isDark } = useTheme();
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingTarget, setRatingTarget] = useState(null);
  const { user } = useAuth();
  const isProvider = user?.role === 'provider' || user?.role === 'both';

  const [myRides,         setMyRides]         = useState([]);
  const [selectedRide,    setSelectedRide]    = useState(null);
  const [expandedRideIds, setExpandedRideIds] = useState({});
  const [bookings,        setBookings]        = useState([]);
  const [ridesLoading,    setRidesLoading]    = useState(true);
  const [bkLoading,       setBkLoading]       = useState(false);
  const [refreshing,      setRefreshing]      = useState(false);
  const [error,           setError]           = useState('');
  const [actionMap,       setActionMap]       = useState({});

  const toggleExpand = (id) => setExpandedRideIds(prev => ({ ...prev, [id]: !prev[id] }));

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
        setExpandedRideIds({ [sorted[0]._id]: true });
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
      if (action === 'accepted') {
        await api.acceptBooking(bookingId);
        const booked = bookings.find(b => b._id === bookingId);
        const seatCount = booked?.seatsBooked || booked?.seats || 1;
        setSelectedRide(r => r ? { ...r, seatsAvailable: Math.max(0, (r.seatsAvailable || 0) - seatCount) } : r);
        setMyRides(prev => prev.map(r => r._id === selectedRide?._id ? { ...r, seatsAvailable: Math.max(0, (r.seatsAvailable || 0) - seatCount) } : r));
      } else {
        await api.rejectBooking(bookingId);
      }
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
  const resolved = bookings
    .filter(b => b.status !== 'pending')
    .sort((a, b) => (a.status === 'accepted' ? 0 : 1) - (b.status === 'accepted' ? 0 : 1));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]} edges={['top']}>
      <TopHeader title="Ride Requests" subtitle="Manage incoming buddy requests" showBack={navigation.canGoBack()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRides(); }} tintColor={colors.accent} />}
      >
        <Alert message={error} />

        {/* My rides list */}
        {ridesLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : myRides.length === 0 ? (
          <EmptyState icon="🚗" title="No rides posted yet" action={() => navigation.navigate('OfferRide')} actionLabel="Post a Ride" />
        ) : (
          <>
            <Text style={styles.sectionLabel}>YOUR POSTED RIDES</Text>
            <View style={{ gap: 10, marginBottom: spacing.md }}>
              {myRides.map(r => {
                const cfg = RIDE_STATUS_CONFIG[r.status] || RIDE_STATUS_CONFIG.active;
                const isSelected = selectedRide?._id === r._id;
                const isExpanded = !!expandedRideIds[r._id];
                return (
                  <View
                    key={r._id}
                    style={[
                      styles.verticalRideCard,
                      {
                        backgroundColor: isDark ? colors.surface : '#ffffff',
                        borderColor: isSelected ? colors.accent : (isDark ? colors.border : '#cbd5e1'),
                      },
                      isSelected && { borderWidth: 1.5 },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.verticalRideHeader}
                      onPress={() => {
                        setSelectedRide(r);
                        loadBookings(r._id);
                        toggleExpand(r._id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 18, marginRight: 10 }}>{cfg.icon}</Text>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.verticalRideDate, { color: isSelected ? colors.accent : (isDark ? colors.text : '#0f172a') }]}>
                          {fmtDate(r.date)} · {r.time}
                        </Text>
                        <Text style={[styles.verticalRideRoute, { color: isDark ? colors.text2 : '#64748b' }]} numberOfLines={1}>
                          {getAddr(r.pickup)} → {getAddr(r.drop)}
                        </Text>
                      </View>
                      <View style={[styles.dropdownToggleBadge, { backgroundColor: isDark ? 'rgba(245,166,35,0.12)' : '#fffbeb' }]}>
                        <Text style={[styles.dropdownToggleText, { color: colors.accent }]}>
                          {isExpanded ? '▲ Hide' : '▼ Details'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Collapsible Details Dropdown */}
                    {isExpanded && (
                      <View style={[styles.verticalRideDetails, { borderTopColor: isDark ? colors.border : '#f1f5f9' }]}>
                        {/* Vehicle & Plate */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <Text style={{ fontSize: 24 }}>
                            {r.vehicleType === 'motorcycle' || r.vehicleType === 'bike' ? '🏍️' : '🚗'}
                          </Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>
                              {r.vehicleName || 'Vehicle'}
                            </Text>
                            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700', marginTop: 1 }}>
                              {r.vehicleNumber ? `Reg: ${r.vehicleNumber}` : 'Verified Campus Vehicle'}
                            </Text>
                          </View>
                          {r.status !== 'completed' && r.status !== 'cancelled' && (
                            <TouchableOpacity
                              onPress={() => navigation.navigate('RideDetail', { rideId: r._id })}
                              style={styles.viewDetailBadge}
                            >
                              <Text style={styles.viewDetailText}>Full View ↗</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Route */}
                        <View style={[styles.routeBox, { backgroundColor: isDark ? colors.surface2 : '#f1f5f9', marginBottom: 10 }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                            <Text style={{ fontSize: 13, marginTop: 2, color: colors.green, fontWeight: '800' }}>📍</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: colors.text3, fontSize: 10, fontWeight: '700' }}>PICKUP</Text>
                              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{getAddr(r.pickup)}</Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                            <Text style={{ fontSize: 13, marginTop: 2, color: colors.red, fontWeight: '800' }}>🏁</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: colors.text3, fontSize: 10, fontWeight: '700' }}>DROP</Text>
                              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{getAddr(r.drop)}</Text>
                            </View>
                          </View>
                        </View>

                        {/* Metadata pills */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          <View style={[styles.metaChip, { backgroundColor: isDark ? colors.surface2 : '#f1f5f9', borderColor: isDark ? colors.border : '#cbd5e1' }]}>
                            <Text style={[styles.metaChipText, { color: isDark ? colors.text : '#0f172a' }]}>🗓 {fmtDate(r.date)}</Text>
                          </View>
                          <View style={[styles.metaChip, { backgroundColor: isDark ? colors.surface2 : '#f1f5f9', borderColor: isDark ? colors.border : '#cbd5e1' }]}>
                            <Text style={[styles.metaChipText, { color: isDark ? colors.text : '#0f172a' }]}>⏰ {r.time}</Text>
                          </View>
                          <View style={[styles.metaChip, { backgroundColor: isDark ? colors.surface2 : '#f1f5f9', borderColor: isDark ? colors.border : '#cbd5e1' }]}>
                            <Text style={[styles.metaChipText, { color: isDark ? colors.text : '#0f172a' }]}>
                              💺 {r.status === 'completed'
                                ? `${r.bookedSeats || 1} seats booked`
                                : `${r.seatsAvailable} seats available`}
                            </Text>
                          </View>
                          {Boolean(r.womenOnly) && (
                            <View style={[styles.metaChip, { backgroundColor: 'rgba(233,30,99,0.15)', borderColor: 'rgba(233,30,99,0.4)' }]}>
                              <Text style={[styles.metaChipText, { color: '#ff4081' }]}>♀ Women Only</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Selected ride controls & bookings */}
        {selectedRide && (
          <>



            {/* Ride status controls */}
            {selectedRide.status === 'cancelled' && (
              <View style={{ marginBottom: spacing.md }}>
                <Alert message={`Ride Cancelled${selectedRide.cancelReason ? `: ${selectedRide.cancelReason}` : ''}`} />
              </View>
            )}

            {/* PENDING REQUESTS SECTION: Moved to top of page */}
            {selectedRide.status !== 'completed' && (
              <View style={{ marginBottom: spacing.md }}>
                <Text style={styles.sectionLabel}>PENDING REQUESTS ({pending.length})</Text>
                {bkLoading ? (
                  <ActivityIndicator color={colors.accent} />
                ) : pending.length === 0 ? (
                  <View style={[styles.emptyBox, { backgroundColor: isDark ? colors.surface2 : '#f1f5f9' }]}>
                    <Text style={{ fontSize: 28, marginBottom: 6 }}>📭</Text>
                    <Text style={{ color: colors.text2, fontSize: 13 }}>No pending requests</Text>
                  </View>
                ) : (
                  pending.map(b => {
                    const am = actionMap[b._id] || {};
                    const seeker = b.seekerId;
                    return (
                      <View key={b._id} style={[styles.bookingCard, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#cbd5e1' }]}>
                        <View style={styles.seekerRow}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>🪪</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.seekerName, { color: isDark ? colors.text : '#0f172a' }]}>
                                🪪 USN: {getDisplayUSN(seeker, 'Buddy')}
                              </Text>
                            <Text style={styles.seekerMeta}>💺 {b.seats || 1} seat{(b.seats || 1) > 1 ? 's' : ''} requested</Text>
                            {seeker?.college && <Text style={[styles.seekerMeta, { color: isDark ? colors.text3 : '#64748b' }]}>🏫 {seeker.college}</Text>}
                            <Text style={[styles.seekerMeta, { color: colors.text3, fontSize: 11, fontStyle: 'italic', marginTop: 4 }]}>
                              🔒 Phone revealed after accepting
                            </Text>
                            <Text style={[styles.seekerMeta, { color: colors.text3, fontSize: 10, marginTop: 2 }]}>
                              {new Date(b.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                            </Text>
                          </View>
                        </View>

                        {/* Calculated Fare for Provider to Review */}
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: isDark ? 'rgba(245,166,35,0.1)' : '#fffbeb',
                          borderWidth: 1,
                          borderColor: isDark ? 'rgba(245,166,35,0.3)' : '#fde047',
                          borderRadius: radius.md,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          marginTop: 8
                        }}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? colors.text : '#0f172a' }}>
                            💰 Fare to Collect from Buddy:
                          </Text>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: colors.accent }}>
                            ₹{b.fare || b.cost || ((b.seats || 1) * (selectedRide?.costPerSeat || 30))}
                          </Text>
                        </View>

                        <Alert message={am.error} />
                        {am.done ? (
                          <Text style={{ color: colors.green, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 8 }}>✓ Action taken</Text>
                        ) : (
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                            <Btn
                              label={am.loading ? '…' : '✓ Accept'}
                              onPress={() => respond(b._id, 'accepted')}
                              loading={am.loading}
                              style={{ flex: 1.3 }}
                            />
                            <Btn label="✕ Reject" onPress={() => respond(b._id, 'rejected')} variant="danger" disabled={am.loading} style={{ flex: 0.9 }} />
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* Completed Rides: Show Confirmed / Resolved buddies on top before stats & privacy notice */}
            {selectedRide.status === 'completed' && resolved.length > 0 && (
              <View style={{ marginBottom: spacing.md }}>
                <Text style={styles.sectionLabel}>CONFIRMED / RESOLVED ({resolved.length})</Text>
                {resolved.map(b => {
                  const seeker = b.seekerId;
                  const isAccepted = b.status === 'accepted';
                  return (
                    <View
                      key={b._id}
                      style={[
                        styles.bookingCard,
                        {
                          backgroundColor: isDark ? colors.surface : '#ffffff',
                          borderColor: isDark ? (isAccepted ? 'rgba(0,230,118,0.3)' : colors.border) : (isAccepted ? '#86efac' : '#cbd5e1'),
                        },
                        !isAccepted && { opacity: 0.7 }
                      ]}
                    >
                      <View style={styles.seekerRow}>
                        <View style={[styles.avatar, isAccepted && { borderColor: colors.green, backgroundColor: colors.green + '22' }]}>
                          <Text style={[styles.avatarText, isAccepted && { color: colors.green }]}>🪪</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.seekerName, { color: isDark ? colors.text : '#0f172a' }]}>
                            🪪 USN: {getDisplayUSN(seeker, 'Buddy')}
                          </Text>
                          {seeker?.college && (
                            <Text style={[styles.seekerMeta, { color: isDark ? colors.text3 : '#64748b' }]}>
                              🏫 {seeker.college}
                            </Text>
                          )}
                        </View>
                        <Text style={[styles.statusBadge, {
                          color: isAccepted ? colors.green : colors.red,
                          borderColor: isAccepted ? colors.green : colors.red,
                        }]}>{isAccepted ? 'confirmed' : b.status}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Stats */}
            <View style={styles.statsRow}>
              <StatPill isDark={isDark} label="Pending" value={pending.length} color={colors.accent} />
              <StatPill isDark={isDark} label="Resolved" value={resolved.length} color={colors.green} />
              <StatPill isDark={isDark} label="Total" value={bookings.length} color={colors.blue} />
              <TouchableOpacity
                style={[
                  styles.refreshBtn,
                  {
                    backgroundColor: isDark ? colors.surface2 : '#f1f5f9',
                    borderWidth: 1,
                    borderColor: isDark ? 'transparent' : '#cbd5e1',
                  }
                ]}
                onPress={() => loadBookings(selectedRide._id)}
              >
                <Text style={{ color: isDark ? colors.text2 : '#475569', fontSize: 13, fontWeight: '700' }}>↻</Text>
              </TouchableOpacity>
            </View>

            {/* Completed status notice */}
            {selectedRide.status === 'completed' && (
              <View style={[
                styles.bookingCard,
                {
                  alignItems: 'center',
                  paddingVertical: 24,
                  marginTop: spacing.sm,
                  backgroundColor: isDark ? colors.surface : '#ffffff',
                  borderColor: isDark ? colors.border : '#cbd5e1',
                }
              ]}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🔒</Text>
                <Text style={{ color: isDark ? '#ffffff' : '#0f172a', fontSize: 16, fontWeight: '800', marginBottom: 6 }}>Ride Completed</Text>
                <Text style={{ color: isDark ? colors.text3 : '#64748b', fontSize: 13, textAlign: 'center', maxWidth: 300, lineHeight: 18 }}>
                  Seeker personal and contact details are hidden once a ride is completed in accordance with student safety and privacy policy.
                </Text>
                <View style={{
                  marginTop: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: isDark ? colors.surface2 : '#f1f5f9',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: isDark ? 'transparent' : '#cbd5e1',
                }}>
                  <Text style={{ fontSize: 12 }}>✓</Text>
                  <Text style={{ color: colors.green, fontSize: 12, fontWeight: '700' }}>
                    {resolved.filter(b => b.status === 'accepted').length} Buddy Completed
                  </Text>
                </View>
              </View>
            )}

                {/* Resolved (non-completed rides render resolved after pending & stats) */}
                {selectedRide.status !== 'completed' && resolved.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>CONFIRMED / RESOLVED ({resolved.length})</Text>
                    {resolved.map(b => {
                      const seeker = b.seekerId;
                      const isAccepted = b.status === 'accepted';
                      const isCompletedOrCancelled = selectedRide?.status === 'completed' || selectedRide?.status === 'cancelled';
                      return (
                        <View
                          key={b._id}
                          style={[
                            styles.bookingCard,
                            {
                              backgroundColor: isDark ? colors.surface : '#ffffff',
                              borderColor: isDark ? (isAccepted ? 'rgba(0,230,118,0.3)' : colors.border) : (isAccepted ? '#86efac' : '#cbd5e1'),
                            },
                            !isAccepted && { opacity: 0.7 }
                          ]}
                        >
                          <View style={styles.seekerRow}>
                            <View style={[styles.avatar, isAccepted && { borderColor: colors.green, backgroundColor: colors.green + '22' }]}>
                              <Text style={[styles.avatarText, isAccepted && { color: colors.green }]}>🪪</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.seekerName, { color: isDark ? colors.text : '#0f172a' }]}>
                                🪪 USN: {getDisplayUSN(seeker, 'Buddy')}
                              </Text>
                              {/* After rides are completed, hide phone details */}
                              {isAccepted && seeker?.phone && !isCompletedOrCancelled ? (
                                <Text style={[styles.seekerMeta, { color: isDark ? colors.text2 : '#475569' }]}>
                                  📞 Phone: <Text style={{ color: colors.accent, fontWeight: '700' }}>{seeker.phone}</Text>
                                </Text>
                              ) : null}
                              {seeker?.college && (
                                <Text style={[styles.seekerMeta, { color: isDark ? colors.text3 : '#64748b' }]}>
                                  🏫 {seeker.college}
                                </Text>
                              )}
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
      <RatingModal
        visible={showRatingModal}
        rideId={selectedRide?._id}
        targetUser={ratingTarget}
        targetRole="buddy"
        onClose={() => setShowRatingModal(false)}
        onSubmitted={() => { setShowRatingModal(false); }}
      />
    </SafeAreaView>
  );
}

function StatPill({ label, value, color, isDark }) {
  return (
    <View style={{ alignItems: 'center', backgroundColor: isDark ? colors.surface2 : '#f1f5f9', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 8 }}>
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
  verticalRideCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  verticalRideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  verticalRideDate: {
    fontSize: 14,
    fontWeight: '800',
  },
  verticalRideRoute: {
    fontSize: 12,
    marginTop: 2,
  },
  dropdownToggleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.md,
  },
  dropdownToggleText: {
    fontSize: 11,
    fontWeight: '800',
  },
  verticalRideDetails: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
    borderTopWidth: 1,
  },
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
