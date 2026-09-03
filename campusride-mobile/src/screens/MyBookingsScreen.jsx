import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert as RNAlert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Alert, EmptyState, Btn } from '../components/UI';
import FloatingChatBot from '../components/FloatingChatBot';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';

const STATUS_COLOR = {
  pending:   colors.accent,
  accepted:  colors.green,
  rejected:  colors.red,
  cancelled: colors.text3,
};
const STATUS_ICON = { pending: '⏳', accepted: '✅', rejected: '❌', cancelled: '🚫' };
const VEHICLE_ICON = { motorcycle: '🏍️', car: '🚗', suv: '🚙', xuv: '🛻' };

function getAddr(field) {
  if (!field) return '—';
  if (typeof field === 'string') return field;
  if (field.address?.trim()) return field.address.trim();
  if (field.coordinates?.length === 2) {
    const [lng, lat] = field.coordinates;
    return `${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E`;
  }
  return '—';
}

function fmtDate(d) {
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

export default function MyBookingsScreen({ navigation }) {
  const { user } = useAuth();
  const isSeeker = user?.role === 'seeker' || user?.role === 'both';

  const [bookings,    setBookings]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState('');

  const loadData = async () => {
    try {
      setError('');
      const data = await api.getMyBookings();
      setBookings(Array.isArray(data) ? data : data?.bookings || []);
    } catch (e) {
      setError(e.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isSeeker) loadData();
  }, [isSeeker]);

  if (!isSeeker) return (
    <SafeAreaView style={styles.safe}>
      <EmptyState icon="🚫" title="Access Denied" subtitle="Only seekers can view their bookings." action={() => navigation.goBack()} actionLabel="Go Back" />
    </SafeAreaView>
  );

  const cancelBooking = (id) => {
    RNAlert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          try {
            await api.cancelBooking(id);
            setBookings(prev => prev.map(b => b._id === id ? { ...b, status: 'cancelled' } : b));
          } catch (e) {
            RNAlert.alert('Error', e.message || 'Failed to cancel');
          }
        },
      },
    ]);
  };

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.accent} />}
      >
        <Text style={styles.title}>My Bookings</Text>
        <Text style={styles.subtitle}>Track your rides, route, and travel time in real time</Text>

        <Alert message={error} />

        {bookings.length === 0 ? (
          <EmptyState icon="📭" title="No bookings yet" subtitle="Search for a ride and book a seat to get started." action={() => navigation.navigate('SearchRides')} actionLabel="Find a Ride →" />
        ) : (
          bookings.map(b => {
            const ride = b.rideId && typeof b.rideId === 'object' ? b.rideId : null;
            const rideIdStr = ride?._id || (typeof b.rideId === 'string' ? b.rideId : '');
            const isCancelled = b.status === 'cancelled' || ride?.status === 'cancelled';
            const canCancel = ['pending', 'accepted'].includes(b.status) && !isCancelled;
            const canTrack  = b.status === 'accepted' && (!ride || ride.status !== 'cancelled');
            const provider  = ride?.providerId;

            return (
              <View key={b._id} style={[styles.card, isCancelled && styles.cardCancelled]}>
                {/* Header */}
                <View style={styles.cardHeader}>
                  <Text style={styles.bookingId}>Booking #{b._id.slice(-6).toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 14 }}>{STATUS_ICON[b.status] || '•'}</Text>
                    <Text style={[styles.statusText, { color: STATUS_COLOR[b.status] || colors.text2 }]}>{b.status}</Text>
                  </View>
                </View>

                {/* Route — Full complete address */}
                {ride && (
                  <View style={styles.route}>
                    <View style={styles.routeRow}>
                      <View style={[styles.dot, { backgroundColor: colors.green }]} />
                      <Text style={styles.routeText} numberOfLines={2}>{getAddr(ride.pickup)}</Text>
                    </View>
                    <View style={styles.routeLineDot} />
                    <View style={styles.routeRow}>
                      <View style={[styles.dot, { backgroundColor: colors.red }]} />
                      <Text style={styles.routeText} numberOfLines={2}>{getAddr(ride.drop)}</Text>
                    </View>
                  </View>
                )}

                {/* Meta grid */}
                {ride && (
                  <View style={styles.metaGrid}>
                    <MetaItem label="DATE"    value={fmtDate(ride.date)} />
                    <MetaItem label="TIME"    value={ride.time || '—'} />
                    <MetaItem label="COST"    value={`₹${ride.costPerSeat}/seat`} accent />
                    <MetaItem label="VEHICLE" value={`${VEHICLE_ICON[ride.vehicleType] || '🚗'} ${ride.vehicleType || '—'}`} />
                  </View>
                )}

                {/* Provider details — only after accepted */}
                {b.status === 'accepted' && provider && (
                  <View style={styles.providerCard}>
                    <Text style={styles.providerLabel}>CONFIRMED PROVIDER & VEHICLE</Text>
                    <View style={styles.providerHeaderRow}>
                      <View style={styles.avatarMini}>
                        <Text style={styles.avatarMiniText}>{provider.name?.charAt(0) || 'P'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.providerNameText}>{provider.name || 'Provider'}</Text>
                        <Text style={styles.vehicleNameBadge}>
                          🚘 {ride?.vehicleName || provider.kycDocuments?.vehicleName || 'Vehicle'} • {(ride?.vehicleType || 'CAR').toUpperCase()}
                        </Text>
                      </View>
                      {(provider.kycDocuments?.vehicleNumber || ride?.vehicleNumber) && (
                        <View style={styles.plateBadge}>
                          <Text style={styles.plateBadgeText}>
                            {provider.kycDocuments?.vehicleNumber || ride?.vehicleNumber}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.providerMetaGrid}>
                      {provider.usn ? (
                        <Text style={styles.providerMetaText}>🪪 USN: <Text style={{ color: colors.text, fontWeight: '700' }}>{provider.usn}</Text></Text>
                      ) : null}
                      {provider.phone ? (
                        <Text style={styles.providerMetaText}>📞 Phone: <Text style={{ color: colors.text, fontWeight: '700' }}>{provider.phone}</Text></Text>
                      ) : null}
                    </View>
                  </View>
                )}

                {/* Actions */}
                <View style={{ gap: 8, marginTop: 12 }}>
                  {b.status === 'pending' && (
                    <Alert message="⏳ Booking request submitted. Ride starts once provider accepts." />
                  )}
                  {canTrack && rideIdStr && (
                    <Btn
                      label="🛡️ Safety Checklist & Track Ride →"
                      onPress={() => navigation.navigate('PreRideChecklist', { rideId: rideIdStr })}
                    />
                  )}
                  {rideIdStr && !isCancelled && (
                    <Btn label="View Ride Details" onPress={() => navigation.navigate('RideDetail', { rideId: rideIdStr })} variant="outline" />
                  )}
                  {canCancel && (
                    <Btn label="✕ Cancel Booking" onPress={() => cancelBooking(b._id)} variant="danger" />
                  )}
                  {isCancelled && (
                    <Alert message={`Ride cancelled${ride?.cancelReason ? `. Reason: ${ride.cancelReason}` : ''}`} />
                  )}
                  {b.status === 'rejected' && (
                    <Alert message="Booking rejected. Try searching for another ride." />
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Floating HOGO AI Assistant Button */}
      <FloatingChatBot />
    </SafeAreaView>
  );
}

function MetaItem({ label, value, accent }) {
  return (
    <View style={{ width: '48%', marginBottom: 10 }}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, accent && { color: colors.accent }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 48 },
  title:  { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: colors.text2, fontSize: 13, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: 14,
  },
  cardCancelled: { opacity: 0.65 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  bookingId: { color: colors.text, fontSize: 14, fontWeight: '700' },
  statusText: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  route: { marginBottom: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 3 },
  routeLineDot: { width: 2, height: 12, backgroundColor: colors.border, marginLeft: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeText: { flex: 1, color: colors.text, fontSize: 13 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  metaLabel: { color: colors.text3, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  metaValue: { color: colors.text2, fontSize: 13, fontWeight: '600' },
  providerCard: {
    backgroundColor: 'rgba(245,166,35,0.07)', borderRadius: radius.lg,
    borderWidth: 1, borderColor: 'rgba(245,166,35,0.2)', padding: 12, marginTop: 4,
  },
  providerLabel: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  providerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  avatarMini: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  avatarMiniText: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  providerNameText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  vehicleNameBadge: { color: colors.accent, fontSize: 12, fontWeight: '700', marginTop: 1 },
  plateBadge: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  plateBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  providerMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 6,
  },
  providerMetaText: {
    color: colors.text2,
    fontSize: 12,
  },
});
