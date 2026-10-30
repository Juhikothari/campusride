// ═══════════════════════════════════════════════════════════════
//  RIDE DETAIL SCREEN
// ═══════════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert as RNAlert, TextInput,
  KeyboardAvoidingView, Platform, Modal, DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Btn, Alert, Badge } from '../components/UI';
import TopHeader from '../components/TopHeader';
import TimePickerModal from '../components/TimePickerModal';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';

function getAddr(field) {
  if (!field) return '—';
  if (field.address?.trim()) return field.address.trim();
  if (field.coordinates?.length === 2) {
    const [lng, lat] = field.coordinates;
    return `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
  }
  return '—';
}

export function RideDetailScreen({ navigation, route }) {
  const { rideId } = route.params || {};
  const { user }   = useAuth();
  const { isDark } = useTheme();

  const [ride,    setRide]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [booking, setBooking] = useState({ loading: false, status: null, error: '' });

  useEffect(() => {
    if (!rideId) { setError('No ride ID'); setLoading(false); return; }
    api.getRideById(rideId)
      .then(data => setRide(data?.ride || data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));

    // Check existing booking
    api.getMyBookings()
      .then(bookings => {
        const m = bookings.find(b => String(b.rideId?._id || b.rideId) === String(rideId));
        if (m) setBooking(prev => ({ ...prev, status: m.status }));
      })
      .catch(() => {});
  }, [rideId]);

  const doBook = async () => {
    setBooking(b => ({ ...b, loading: true, error: '' }));
    try {
      await api.bookRide(rideId);
      setBooking({ loading: false, status: 'pending', error: '' });
    } catch (e) {
      setBooking(b => ({ ...b, loading: false, error: e.message }));
    }
  };

  if (loading) return <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]}><ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} /></SafeAreaView>;

  const isOwner  = ride && (ride.providerId?._id === user?._id || ride.providerId === user?._id);
  const isSeeker = user?.role === 'seeker' || user?.role === 'both';
  const canBook  = isSeeker && !isOwner && !booking.status && ride?.status === 'active';
  const VEHICLE_ICON = { motorcycle: '🏍️', car: '🚗', suv: '🚙', xuv: '🛻' };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]} edges={['top']}>
      <TopHeader title="Ride Details" subtitle="Verified campus ride" showBack={navigation.canGoBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>

        <Alert message={error} />

        {ride && (ride.status === 'completed' || ride.status === 'cancelled') ? (
          <View style={[styles.card, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#e2e8f0', alignItems: 'center', padding: 24 }]}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>
              {ride.status === 'completed' ? '🏁' : '🔴'}
            </Text>
            <Text style={{ color: isDark ? colors.text : '#0f172a', fontSize: 20, fontWeight: '800', marginBottom: 6 }}>
              {ride.status === 'completed' ? 'Ride Completed' : 'Ride Cancelled'}
            </Text>
            <Text style={{ color: isDark ? colors.text2 : '#475569', fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 20 }}>
              {ride.status === 'completed'
                ? 'This ride was completed successfully. Thank you for commuting with your campus buddy!'
                : (ride.cancelReason ? `This ride was cancelled: ${ride.cancelReason}` : 'This ride has been cancelled.')}
            </Text>
            <View style={{ width: '100%', backgroundColor: isDark ? colors.surface2 : '#f1f5f9', borderRadius: radius.md, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: isDark ? colors.border : '#cbd5e1' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Text>🟢</Text>
                <Text style={{ color: isDark ? colors.text : '#0f172a', fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>{getAddr(ride.pickup)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text>🔴</Text>
                <Text style={{ color: isDark ? colors.text : '#0f172a', fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>{getAddr(ride.drop)}</Text>
              </View>
            </View>
            <Btn label="← Back to Dashboard" onPress={() => navigation.navigate('Home')} style={{ width: '100%' }} />
          </View>
        ) : ride && (
          <>
            {/* Header */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#e2e8f0' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 28 }}>{VEHICLE_ICON[ride.vehicleType] || '🚗'}</Text>
                  <View>
                    <Text style={{ color: isDark ? colors.text : '#0f172a', fontSize: 18, fontWeight: '800' }}>
                      {ride.vehicleName || ride.vehicleType}
                    </Text>
                    <Text style={{ color: isDark ? colors.text2 : '#475569', fontSize: 13, marginTop: 2 }}>
                      🪪 USN: {ride.providerId?.usn || ride.provider?.usn || 'Verified Commuter'}
                    </Text>
                  </View>
                </View>
                <Badge label={ride.status} color={ride.status === 'active' ? colors.green : colors.text3} />
              </View>
              {ride.womenOnly && <Badge label="♀ Women Only" color={colors.pink} style={{ marginTop: 8 }} />}
            </View>

            {/* Route */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#e2e8f0' }]}>
              <Text style={{ color: colors.text3, fontSize: 11, fontWeight: '700', marginBottom: 12 }}>ROUTE</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green }} />
                <Text style={{ color: isDark ? colors.text : '#0f172a', fontSize: 14, flex: 1 }}>{getAddr(ride.pickup)}</Text>
              </View>
              <View style={{ width: 2, height: 20, backgroundColor: colors.border, marginLeft: 4, marginBottom: 8 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.red }} />
                <Text style={{ color: isDark ? colors.text : '#0f172a', fontSize: 14, flex: 1 }}>{getAddr(ride.drop)}</Text>
              </View>
            </View>

            {/* Details */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#e2e8f0' }]}>
              <Text style={{ color: colors.text3, fontSize: 11, fontWeight: '700', marginBottom: 12 }}>DETAILS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                {[
                  { label: '📅 Date',   value: new Date(ride.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
                  { label: '🕐 Time',   value: ride.time },
                  { label: '💺 Seats',  value: `${ride.seatsAvailable} available` },
                  { label: '₹ Cost',    value: `₹${ride.costPerSeat} / seat` },
                  { label: '🚗 Vehicle',value: ride.vehicleType },
                  { label: '🏫 College',value: ride.college },
                ].map(d => (
                  <View key={d.label} style={{ width: '45%' }}>
                    <Text style={{ color: colors.text3, fontSize: 11, marginBottom: 3 }}>{d.label}</Text>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>{d.value || '—'}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Confirmed Provider Card — ONLY AFTER ACCEPTANCE */}
            {booking.status === 'accepted' && (
              <View style={[styles.card, { borderColor: colors.green, borderWidth: 1.5 }]}>
                <Text style={{ color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 10 }}>CONFIRMED PROVIDER & VEHICLE</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.green }}>
                    <Text style={{ color: colors.green, fontSize: 18, fontWeight: '800' }}>
                      {ride.providerId?.name?.charAt(0) || 'P'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>
                      {ride.providerId?.name || 'Provider'}
                    </Text>
                    <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>
                      {ride.vehicleName || 'Vehicle'} • {(ride.vehicleType || 'Car').toUpperCase()}
                    </Text>
                  </View>
                  {(ride.vehicleNumber || ride.providerId?.kycDocuments?.vehicleNumber) && (
                    <View style={{ backgroundColor: colors.surface2, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }}>
                        {ride.vehicleNumber || ride.providerId?.kycDocuments?.vehicleNumber}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', gap: 16 }}>
                  {ride.providerId?.usn ? (
                    <Text style={{ color: colors.text2, fontSize: 12 }}>
                      🪪 USN: <Text style={{ color: colors.text, fontWeight: '700' }}>{ride.providerId.usn}</Text>
                    </Text>
                  ) : null}
                  {ride.providerId?.phone ? (
                    <Text style={{ color: colors.text2, fontSize: 12 }}>
                      📞 Phone: <Text style={{ color: colors.accent, fontWeight: '700' }}>{ride.providerId.phone}</Text>
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            {!isOwner && booking.status !== 'accepted' && (
              <View style={{ padding: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.md, marginTop: 4, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.text3, fontSize: 11.5, textAlign: 'center' }}>
                  🔒 Provider's phone number, USN, and vehicle plate number are revealed once the booking is accepted.
                </Text>
              </View>
            )}

            {/* Booking */}
            <Alert message={booking.error} />
            {booking.status === 'pending'  && <Alert message="⏳ Booking request sent! Waiting for provider to accept." type="warning" />}
            {booking.status === 'accepted' && <Alert message="✅ Your booking is confirmed! Complete safety checklist to start." type="success" />}
            {booking.status === 'rejected' && <Alert message="❌ Booking was rejected." />}

            {canBook && (
              <Btn label="Book This Ride" onPress={doBook} loading={booking.loading} style={{ marginTop: 8 }} />
            )}

            {booking.status === 'accepted' && (
              <Btn
                label="🛡️ Safety Checklist & Live Track →"
                onPress={() => navigation.navigate('PreRideChecklist', { rideId: ride._id })}
                style={{ marginTop: 8 }}
              />
            )}

            {isOwner && (
              <Btn label="View Booking Requests →" onPress={() => navigation.navigate('ProviderBookings')} variant="outline" style={{ marginTop: 8 }} />
            )}
          </>
        )}

        {!ride && !loading && (
          <View style={[styles.card, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#e2e8f0', alignItems: 'center', padding: 24 }]}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🏁</Text>
            <Text style={{ color: isDark ? colors.text : '#0f172a', fontSize: 18, fontWeight: '800', marginBottom: 6 }}>
              Ride Information Unavailable
            </Text>
            <Text style={{ color: isDark ? colors.text2 : '#475569', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
              This ride has completed, expired, or was removed. You can review your past rides in My Bookings.
            </Text>
            <Btn label="📑 View My Bookings" onPress={() => navigation.navigate('MyBookings')} style={{ width: '100%', marginBottom: 10 }} />
            <Btn label="← Back to Dashboard" onPress={() => navigation.navigate('Home')} variant="outline" style={{ width: '100%' }} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATIONS SCREEN
// ═══════════════════════════════════════════════════════════════
export function NotificationsScreen({ navigation }) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [bookings,  setBookings]  = useState([]);
  const [myRides,   setMyRides]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [readIds,   setReadIds]   = useState(new Set());

  const isSeeker   = user?.role === 'seeker'   || user?.role === 'both';
  const isProvider = user?.role === 'provider' || user?.role === 'both';

  const [serverNotifs, setServerNotifs] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem('@read_notif_ids').then(raw => {
      if (raw) {
        try { setReadIds(new Set(JSON.parse(raw))); } catch {}
      }
    });

    const promises = [];
    if (isSeeker)   promises.push(api.getMyBookings().then(setBookings).catch(() => {}));
    if (isProvider) promises.push(api.getMyRides().then(setMyRides).catch(() => {}));
    promises.push(
      api.getNotifications()
        .then(res => {
          const list = Array.isArray(res) ? res : res?.notifications || [];
          setServerNotifs(list);
        })
        .catch(() => {})
    );
    Promise.all(promises).finally(() => setLoading(false));
  }, []);

  const markAllAsRead = () => {
    const allIds = new Set([...readIds, ...allNotifs.map(n => n.id)]);
    setReadIds(allIds);
    AsyncStorage.setItem('@read_notif_ids', JSON.stringify([...allIds])).catch(() => {});
    api.markNotificationsRead().catch(() => {});
    DeviceEventEmitter.emit('NOTIFICATIONS_READ');
  };

  const handleNotifPress = (item) => {
    try {
      setReadIds(prev => {
        const next = new Set(prev).add(item.id);
        AsyncStorage.setItem('@read_notif_ids', JSON.stringify([...next])).catch(() => {});
        const remaining = allNotifs.filter(n => !next.has(n.id) && !n.isRead).length;
        DeviceEventEmitter.emit('NOTIFICATION_COUNT_CHANGED', Math.max(0, remaining));
        return next;
      });
      if (item.id) {
        api.request(`/notifications/${item.id}/read`, { method: 'PUT' }).catch(() => {});
      }
      if (item.onPress) item.onPress();
    } catch (err) {
      console.log('[NotificationPress] Handled gracefully:', err);
      try { navigation.navigate('Home'); } catch {}
    }
  };

  const NOTIF_TYPE = {
    pending:     { icon: '📬', color: colors.blue,  label: 'Booking Request' },
    accepted:    { icon: '✅', color: colors.green, label: 'Booking Accepted' },
    rejected:    { icon: '❌', color: colors.red,   label: 'Booking Rejected' },
    cancelled:   { icon: '🚫', color: colors.text3, label: 'Cancelled' },
    'in-progress':{ icon:'🛣️', color: colors.blue,  label: 'Ride In Progress' },
    completed:   { icon: '🏁', color: colors.green, label: 'Completed' },
  };

  const directNotifs = serverNotifs.map(n => ({
    id: n._id || n.id,
    isRead: Boolean(n.read),
    icon: n.type?.includes('PICKUP') ? '🚗' : n.type?.includes('DROP') ? '📍' : '🔔',
    color: colors.accent,
    label: n.type?.replace(/_/g, ' ') || 'Notification',
    title: n.title || 'Notification',
    body:  n.body || n.message || '',
    time:  n.createdAt,
    onPress: () => {
      try {
        const rideId = n.data?.rideId;
        const type = (n.type || '').toUpperCase();
        if (type.includes('COMPLETED') || type.includes('CANCELLED')) {
          navigation.navigate('MyBookings');
        } else if (rideId) {
          navigation.navigate('LiveTracking', { rideId });
        } else {
          navigation.navigate('Home');
        }
      } catch (err) {
        navigation.navigate('Home');
      }
    }
  }));

  const seekerNotifs = bookings.map(b => ({
    id: b._id,
    isRead: false,
    icon:  (NOTIF_TYPE[b.status] || NOTIF_TYPE.pending).icon,
    color: (NOTIF_TYPE[b.status] || NOTIF_TYPE.pending).color,
    label: (NOTIF_TYPE[b.status] || NOTIF_TYPE.pending).label,
    title: `Booking ${b.status}`,
    body:  `${b.rideId?.pickup?.address?.split(',')[0] || 'Pickup'} → ${b.rideId?.drop?.address?.split(',')[0] || 'Drop'}`,
    time:  b.updatedAt || b.createdAt,
    onPress: () => {
      try {
        const rideId = b.rideId?._id || b.rideId;
        if (b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected') {
          navigation.navigate('MyBookings');
        } else if (rideId) {
          navigation.navigate('RideDetail', { rideId });
        } else {
          navigation.navigate('MyBookings');
        }
      } catch (err) {
        navigation.navigate('MyBookings');
      }
    },
  }));

  const providerNotifs = myRides.flatMap(r =>
    (r.bookings || []).filter(b => b.status === 'pending').map(b => ({
      id: b._id,
      isRead: false,
      icon: '📬', color: colors.accent,
      label: 'New Request',
      title: 'New booking request',
      body:  `${r.pickup?.address?.split(',')[0] || '?'} → ${r.drop?.address?.split(',')[0] || '?'}`,
      time:  b.createdAt,
      onPress: () => {
        try {
          navigation.navigate('ProviderBookings');
        } catch (err) {
          navigation.navigate('Home');
        }
      },
    }))
  );

  const allNotifs = [...directNotifs, ...seekerNotifs, ...providerNotifs]
    .sort((a, b) => new Date(b.time) - new Date(a.time));

  function timeAgo(d) {
    const m = Math.floor((Date.now() - new Date(d)) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m / 60)}h ago`;
    return `${Math.floor(m / 1440)}d ago`;
  }

  const unreadCount = allNotifs.filter(n => !readIds.has(n.id) && !n.isRead).length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]} edges={['top']}>
      <TopHeader title="Notifications" subtitle="Alerts & ride updates" showBack={navigation.canGoBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {allNotifs.length > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
            <Text style={{ color: isDark ? colors.text2 : '#475569', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }}>
              {unreadCount > 0 ? `${unreadCount} UNREAD ALERTS` : 'ALL ALERTS READ'}
            </Text>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={markAllAsRead} activeOpacity={0.7} style={{ paddingVertical: 2, paddingHorizontal: 6 }}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>Mark all as read ✓</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {loading ? <ActivityIndicator color={colors.accent} /> : allNotifs.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
            <Text style={{ color: isDark ? colors.text2 : '#475569', fontSize: 16 }}>No notifications yet</Text>
          </View>
        ) : (
          allNotifs.map(n => {
            const isUnread = !readIds.has(n.id) && !n.isRead;
            return (
              <TouchableOpacity
                key={n.id}
                style={[
                  styles.card,
                  {
                    flexDirection: 'row',
                    gap: 12,
                    backgroundColor: isUnread
                      ? (isDark ? 'rgba(245, 166, 35, 0.14)' : 'rgba(245, 166, 35, 0.10)')
                      : (isDark ? colors.surface : '#ffffff'),
                    borderColor: isUnread
                      ? '#f5a623'
                      : (isDark ? colors.border : '#e2e8f0'),
                    borderWidth: isUnread ? 1.5 : 1,
                  }
                ]}
                onPress={() => handleNotifPress(n)}
                activeOpacity={0.8}
              >
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: n.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18 }}>{n.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: n.color, fontSize: 11, fontWeight: '800' }}>{n.label}</Text>
                      {isUnread && (
                        <View style={{ backgroundColor: '#f5a623', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3 }}>
                          <Text style={{ color: '#000000', fontSize: 9, fontWeight: '900' }}>NEW</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: isDark ? colors.text3 : '#64748b', fontSize: 11 }}>{timeAgo(n.time)}</Text>
                  </View>
                  <Text style={{ color: isDark ? colors.text : '#0f172a', fontSize: 14.5, fontWeight: isUnread ? '800' : '600', marginTop: 3 }}>{n.title}</Text>
                  <Text style={{ color: isDark ? colors.text2 : '#475569', fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{n.body}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════
//  WALK TOGETHER SCREEN
// ═══════════════════════════════════════════════════════════════
export function WalkTogetherScreen({ navigation }) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [from,    setFrom]    = useState('');
  const [to,      setTo]      = useState('');
  const [time,    setTime]    = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [posting, setPosting] = useState(false);
  const [womenOnly,setWomenOnly]= useState(false);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [inspectModalPost, setInspectModalPost] = useState(null);

  const fetchWalks = () => {
    api.getCommunityPosts('walk')
      .then(data => setPosts((Array.isArray(data) ? data : []).filter(p => p.type === 'walk')))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWalks();
  }, []);

  const postWalk = async () => {
    if (!from.trim() || !to.trim() || !time.trim()) return;
    setPosting(true);
    try {
      const womenTag = womenOnly ? ' 👩 Women only.' : '';
      const displayTime = formatTime12(time);
      const content = `🚶 Walking from ${from.trim()} → ${to.trim()} at ${displayTime}. Anyone joining?${womenTag}`;
      const post = await api.createCommunityPost({ content, type: 'walk', anonymous: false });
      setPosts(prev => [post, ...prev]);
      setFrom(''); setTo(''); setTime('');
    } catch (e) { RNAlert.alert('Error', e.message || 'Failed to post'); }
    finally { setPosting(false); }
  };

  const deleteWalk = (postId) => {
    RNAlert.alert('Delete Walk Request', 'Are you sure you want to delete this walk request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteCommunityPost(postId);
            setPosts(prev => prev.filter(p => p._id !== postId));
          } catch (e) {
            RNAlert.alert('Error', e.message || 'Failed to delete walk request');
          }
        }
      }
    ]);
  };

  const toggleJoin = async (postId) => {
    try {
      const res = await api.joinWalkPost(postId);
      if (res?.post) {
        setPosts(prev => prev.map(p => p._id === postId ? res.post : p));
      } else {
        fetchWalks();
      }
    } catch (e) {
      RNAlert.alert('Error', e.message || 'Failed to update walk join status');
    }
  };

  const currentUserId = (user?._id || user?.userId || '').toString();
  const now = Date.now();
  const isWalkActive = (p) => (now - new Date(p.createdAt).getTime()) < 24 * 60 * 60 * 1000;

  // Past rides disappear after 24 hrs - only show active walks within 24h
  const activeWalks = posts.filter(isWalkActive);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]} edges={['top']}>
      <TopHeader title="Walk Together" subtitle="Find a walking companion on campus" showBack={navigation.canGoBack()} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Post new walk card */}
        <View style={[styles.card, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#e2e8f0' }]}>
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '800', letterSpacing: 0.8, marginBottom: 10 }}>
            📢 POST A WALK COMPANION REQUEST
          </Text>
          {renderWalkInputs(from, setFrom, to, setTo, time, () => setShowTimePicker(true), isDark)}

          <TimePickerModal
            visible={showTimePicker}
            value={time}
            onConfirm={(val) => { setShowTimePicker(false); setTime(val); }}
            onClose={() => setShowTimePicker(false)}
          />

          {user?.gender === 'female' && (
            <TouchableOpacity
              onPress={() => setWomenOnly(w => !w)}
              style={[{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                borderRadius: radius.md, borderWidth: 1.5, padding: 12, marginBottom: 12
              }, womenOnly ? { borderColor: colors.pink, backgroundColor: 'rgba(233,30,140,0.08)' } : { borderColor: isDark ? colors.border : '#cbd5e1' }]}
            >
              <Text style={{ fontSize: 18 }}>{womenOnly ? '🔒' : '♀'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: womenOnly ? colors.pink : (isDark ? colors.text2 : '#475569'), fontSize: 13, fontWeight: '700' }}>
                  {womenOnly ? 'Women Only 🔒' : 'Open to everyone'}
                </Text>
                <Text style={{ color: isDark ? colors.text3 : '#64748b', fontSize: 11 }}>Tap to toggle women-only</Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={postWalk}
            disabled={posting || !from.trim() || !to.trim() || !time.trim()}
            style={[styles.btn, (!from.trim() || !to.trim() || !time.trim() || posting) && { opacity: 0.5 }]}
          >
            <Text style={styles.btnText}>{posting ? 'Posting…' : '🚶 Post Walk Request'}</Text>
          </TouchableOpacity>
        </View>

        {/* Active Campus Walks Count Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          paddingHorizontal: 4,
        }}>
          <Text style={{ color: isDark ? colors.text : '#0f172a', fontSize: 14, fontWeight: '800' }}>
            🚶 Active Campus Walks ({activeWalks.length})
          </Text>
          <Text style={{ color: isDark ? colors.text3 : '#64748b', fontSize: 11 }}>
            Auto-disappears after 24 hrs
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
        ) : activeWalks.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 36 }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>🚶</Text>
            <Text style={{ color: isDark ? colors.text2 : '#475569', fontSize: 14, textAlign: 'center' }}>
              No active walk requests in the last 24h. Post one above!
            </Text>
          </View>
        ) : (
          activeWalks.map(post => {
            const authorId = (post.author?._id || post.author || post.authorId || '').toString();
            const isMyPost = authorId === currentUserId;
            const joinedList = post.joinedUsers || [];
            const isJoined = joinedList.some(j => (j.userId?._id || j.userId || '').toString() === currentUserId);

            return (
              <View key={post._id} style={[styles.card, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#e2e8f0' }]}>
                {/* Header: Posted Date & Time */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ color: isDark ? colors.text3 : '#64748b', fontSize: 11, fontWeight: '600' }}>
                    📅 Posted: {new Date(post.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • {new Date(post.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </Text>
                  <View style={{ backgroundColor: 'rgba(0,230,118,0.12)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.sm }}>
                    <Text style={{ color: colors.green, fontSize: 10, fontWeight: '800' }}>ACTIVE</Text>
                  </View>
                </View>

                {/* Content */}
                <Text style={{ color: isDark ? colors.text : '#0f172a', fontSize: 14.5, lineHeight: 21, marginBottom: 10 }}>
                  {post.content}
                </Text>

                {/* Author name & college badge (constrained to never overflow card) */}
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  <Text style={{ color: isDark ? colors.text2 : '#475569', fontSize: 12, flexShrink: 1 }}>
                    👤 Posted by: <Text style={{ color: colors.accent, fontWeight: '700' }}>
                      {post.author?.name || post.authorName || 'Verified Student'}
                    </Text>
                  </Text>
                  {(post.college || post.author?.college) && (
                    <View style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: radius.sm,
                      maxWidth: '100%',
                      flexShrink: 1,
                    }}>
                      <Text
                        style={{ color: isDark ? colors.text3 : '#475569', fontSize: 11, fontWeight: '600' }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        🏛️ {(post.college || post.author?.college || '').toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Joined Count Pill (Tap to view USN modal) */}
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  gap: 8,
                }}>
                  <TouchableOpacity
                    onPress={() => setInspectModalPost(post)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: 'rgba(45,212,160,0.12)',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: 'rgba(45,212,160,0.3)',
                    }}
                  >
                    <Text style={{ color: '#2dd4a0', fontSize: 12, fontWeight: '800' }}>
                      👥 {joinedList.length} Joined (View Members) ↗
                    </Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    {/* Join / Leave button: The person posting shouldn't have join option */}
                    {!isMyPost && (
                      <TouchableOpacity
                        onPress={() => toggleJoin(post._id)}
                        activeOpacity={0.8}
                        style={[{
                          borderRadius: radius.full,
                          paddingHorizontal: 14,
                          paddingVertical: 6,
                          borderWidth: 1,
                        }, isJoined
                          ? { backgroundColor: colors.green, borderColor: colors.green }
                          : { borderColor: colors.border2, backgroundColor: colors.surface2 }
                        ]}
                      >
                        <Text style={{ color: isJoined ? '#000' : colors.text, fontSize: 12, fontWeight: '700' }}>
                          {isJoined ? '✓ Joined' : '+ Join'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Delete button (Author only) */}
                    {isMyPost && (
                      <TouchableOpacity
                        onPress={() => deleteWalk(post._id)}
                        activeOpacity={0.8}
                        style={{
                          backgroundColor: 'rgba(255,82,82,0.15)',
                          borderColor: colors.red,
                          borderWidth: 1,
                          borderRadius: radius.full,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                        }}
                      >
                        <Text style={{ color: colors.red, fontSize: 12, fontWeight: '700' }}>
                          🗑️ Delete
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal: View USNs of joined students */}
      <Modal
        visible={!!inspectModalPost}
        transparent
        animationType="fade"
        onRequestClose={() => setInspectModalPost(null)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.75)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: '#121824',
            borderRadius: radius.xl,
            borderWidth: 1.5,
            borderColor: colors.accent,
            padding: 18,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>
                👥 Joined Students ({(inspectModalPost?.joinedUsers?.length || 0)})
              </Text>
              <TouchableOpacity onPress={() => setInspectModalPost(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ color: colors.text2, fontSize: 18, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ color: colors.text3, fontSize: 12, marginBottom: 12 }} numberOfLines={2}>
              {inspectModalPost?.content}
            </Text>

            {(inspectModalPost?.joinedUsers?.length || 0) === 0 ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>🚶</Text>
                <Text style={{ color: colors.text3, fontSize: 13, textAlign: 'center' }}>
                  No students have joined this walk yet.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 220 }}>
                {inspectModalPost.joinedUsers.map((item, idx) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      backgroundColor: '#182030',
                      borderRadius: radius.md,
                      padding: 10,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: '#26334a',
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>🎓</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '800' }}>
                        👤 {item.name || item.userId?.name || 'Verified Student'}
                      </Text>
                      <Text style={{ color: colors.text3, fontSize: 10.5, marginTop: 2 }}>
                        Joined: {new Date(item.joinedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </Text>
                    </View>
                    <Text style={{ color: colors.green, fontSize: 11, fontWeight: '700' }}>
                      ✓ Walking
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const formatTime12 = (t) => {
  if (!t) return '';
  if (typeof t !== 'string') return String(t);
  if (t.toUpperCase().includes('AM') || t.toUpperCase().includes('PM')) return t;
  const parts = t.split(':');
  if (parts.length >= 2) {
    let h = parseInt(parts[0], 10);
    const m = parts[1].slice(0, 2);
    if (isNaN(h)) return t;
    const period = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${String(h).padStart(2, '0')}:${m} ${period}`;
  }
  return t;
};

function renderWalkInputs(from, setFrom, to, setTo, time, onOpenTimePicker, isDark = true) {
  const { TextInput, StyleSheet: RNStyleSheet } = require('react-native');
  const s = RNStyleSheet.create({
    inp: {
      backgroundColor: isDark ? colors.surface2 : '#f1f5f9',
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#cbd5e1',
      borderRadius: radius.md,
      color: isDark ? colors.text : '#0f172a',
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      marginBottom: 10,
    },
    timeBtn: {
      backgroundColor: isDark ? colors.surface2 : '#f1f5f9',
      borderWidth: 1,
      borderColor: time ? colors.accent : (isDark ? colors.border : '#cbd5e1'),
      borderRadius: radius.md,
      paddingHorizontal: 14,
      paddingVertical: 13,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  });

  return (
    <>
      <TextInput
        style={s.inp}
        value={from}
        onChangeText={setFrom}
        placeholder="From (e.g. Gate 1, Hostel)"
        placeholderTextColor={isDark ? colors.text3 : '#64748b'}
      />
      <TextInput
        style={s.inp}
        value={to}
        onChangeText={setTo}
        placeholder="To (e.g. Library, Canteen)"
        placeholderTextColor={isDark ? colors.text3 : '#64748b'}
      />
      <TouchableOpacity style={s.timeBtn} onPress={onOpenTimePicker} activeOpacity={0.8}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
          <Text style={{ fontSize: 16 }}>⏰</Text>
          <Text
            style={{
              color: time ? (isDark ? colors.text : '#0f172a') : (isDark ? colors.text3 : '#64748b'),
              fontSize: 13.5,
              fontWeight: time ? '700' : '500',
              flex: 1,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {time ? `Departure: ${formatTime12(time)}` : 'Select Departure Time'}
          </Text>
        </View>
        <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: '700' }}>
          {time ? 'Change' : 'Pick Time ▾'}
        </Text>
      </TouchableOpacity>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ROUTE ALERTS SCREEN
// ═══════════════════════════════════════════════════════════════
export function RouteAlertsScreen({ navigation }) {
  const { isDark } = useTheme();
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [subPickup, setSubPickup] = useState('');
  const [subDrop,   setSubDrop]   = useState('');
  const [subName,   setSubName]   = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getRouteAlerts()
      .then(data => setAlerts(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const subscribe = async () => {
    if (!subPickup.trim() || !subDrop.trim() || !subName.trim()) { setError('Fill all fields'); return; }
    setBusy(true); setError(''); setSuccess('');
    try {
      await api.subscribeAlert({ pickupLabel: subPickup, dropLabel: subDrop, name: subName });
      setSuccess("Subscribed! You'll be notified when a matching ride is posted.");
      setSubPickup(''); setSubDrop(''); setSubName('');
      const data = await api.getRouteAlerts();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const { TextInput } = require('react-native');
  const inputStyle = { backgroundColor:colors.surface2, borderWidth:1, borderColor:colors.border, borderRadius:radius.md, color:colors.text, paddingHorizontal:14, paddingVertical:12, fontSize:14, marginBottom:10 };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 4 }}>🔔 Route Alerts</Text>
        <Text style={{ color: colors.text2, fontSize: 13, marginBottom: spacing.md }}>Get notified when a ride is posted on your route</Text>

        <Alert message={error} />
        <Alert message={success} type="success" />

        <View style={styles.card}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 12 }}>Subscribe to a Route</Text>
          <TextInput style={inputStyle} value={subName}   onChangeText={setSubName}   placeholder="Alert name (e.g. Home → College)" placeholderTextColor={colors.text3} />
          <TextInput style={inputStyle} value={subPickup} onChangeText={setSubPickup} placeholder="Pickup area (e.g. Marathahalli)"   placeholderTextColor={colors.text3} />
          <TextInput style={inputStyle} value={subDrop}   onChangeText={setSubDrop}   placeholder="Drop area (e.g. RVCE)"             placeholderTextColor={colors.text3} />
          <TouchableOpacity onPress={subscribe} disabled={busy} style={[styles.btn, busy && { opacity: 0.5 }]}>
            <Text style={styles.btnText}>{busy ? '…' : '🔔 Subscribe'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10 }}>My Alerts ({alerts.length})</Text>
        {loading ? <ActivityIndicator color={colors.accent} /> : alerts.length === 0 ? (
          <Text style={{ color: colors.text2, fontSize: 13, textAlign: 'center', paddingTop: 16 }}>No route alerts yet.</Text>
        ) : (
          alerts.map((a, i) => (
            <View key={i} style={styles.card}>
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '700', marginBottom: 4 }}>🔔 {a.name || 'Alert'}</Text>
              <Text style={{ color: colors.text2, fontSize: 12 }}>📍 {a.pickupLabel} → {a.dropLabel}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════
//  INCIDENT REPORT SCREEN (Images 3, 4, 5 UI Redesign)
// ═══════════════════════════════════════════════════════════════
const PASSENGER_INCIDENT_CATEGORIES = [
  'Passenger No Show',
  'Passenger Rude / Abusive Behaviour',
  'Passenger Harassment',
  'Passenger Refused to Pay',
  'Passenger Cancelled at Last Minute',
  'Passenger Brought Extra People',
  'Passenger Damaged Vehicle',
  'Passenger Under Influence',
  'Passenger Threatened Driver',
  'Passenger Privacy Violation',
  'Fake Booking',
  'Wrong Pickup Location Given',
  'Passenger Verbal Abuse',
  'Passenger Physical Aggression',
  'Passenger Brought Prohibited Items',
  'Passenger Inappropriate Behaviour',
  'Passenger Left Without Confirmation',
  'Booking Fraud / Identity Mismatch',
  'Safety Threat by Passenger',
  'Other',
];

const RIDER_ROAD_INCIDENT_CATEGORIES = [
  'Accident / Collision',
  'Near-Miss / Close Call',
  'Vehicle Breakdown Mid-Ride',
  'Tyre Puncture Mid-Ride',
  'Fuel Ran Out Mid-Ride',
  'Rash Driving by Another Vehicle',
  'Road Rage by Another Driver',
  'Pothole / Road Hazard Caused Damage',
  'Traffic Signal / Law Enforcement Stop',
  'Vehicle Stolen During Ride',
  'Vehicle Damage (Not by Passenger)',
  'Medical Emergency — Rider',
  'Medical Emergency — Passenger',
  'Natural Hazard (Flooding, Fallen Tree etc.)',
  'Third-Party Collision (Hit by Another Vehicle)',
  'Phone Snatching / Robbery',
  'Other Road / Safety Incident',
  'Other',
];

export function IncidentReportScreen({ navigation }) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const isProvider = user?.role === 'provider' || user?.role === 'both';

  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history'
  const [incidentSegment, setIncidentSegment] = useState('passenger'); // 'passenger' | 'rider_road'
  const [rides, setRides] = useState([]);
  const [ridesLoading, setRidesLoading] = useState(true);
  const [selectedRide, setSelectedRide] = useState(null);
  const [incidentType, setIncidentType] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);

  // Modals for dropdown selections
  const [showRideModal, setShowRideModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);

  const fetchIncidents = async () => {
    setIncidentsLoading(true);
    try {
      const data = await api.getMyIncidents();
      setIncidents(Array.isArray(data) ? data : []);
    } catch (e) {
    } finally {
      setIncidentsLoading(false);
    }
  };

  useEffect(() => {
    const fetchAllRides = async () => {
      try {
        const [bookingsRes, ridesRes] = await Promise.allSettled([
          api.getMyBookings(),
          api.getMyRides(),
        ]);
        const bList = bookingsRes.status === 'fulfilled' && Array.isArray(bookingsRes.value) ? bookingsRes.value : [];
        const rList = ridesRes.status === 'fulfilled' && Array.isArray(ridesRes.value) ? ridesRes.value : [];
        const combined = [...rList, ...bList];
        setRides(combined);
        if (combined.length > 0) {
          setSelectedRide(combined[0]);
        }
      } catch (e) {
      } finally {
        setRidesLoading(false);
      }
    };
    fetchAllRides();
    fetchIncidents();
  }, []);

  const getRideDateTime = (r) => {
    if (!r) return { date: '—', time: '—' };
    const ride = r.rideId || r;
    let d = ride.date;
    let t = ride.time;
    if (ride.departureTime) {
      try {
        const dt = new Date(ride.departureTime);
        if (!d) d = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        if (!t) t = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      } catch {}
    }
    if (!d && r.createdAt) {
      try {
        const dt = new Date(r.createdAt);
        d = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        if (!t) t = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      } catch {}
    }
    return { date: d || 'Today', time: t || 'Scheduled' };
  };

  const getRidePickup = (r) => {
    if (!r) return 'Pickup';
    const p = r.pickup || r.rideId?.pickup;
    if (typeof p === 'string') return p;
    return p?.address || p?.label || getAddr(p) || 'Pickup Location';
  };

  const getRideDrop = (r) => {
    if (!r) return 'Destination';
    const d = r.drop || r.rideId?.drop;
    if (typeof d === 'string') return d;
    return d?.address || d?.label || getAddr(d) || 'Drop Location';
  };

  const submit = async () => {
    if (!selectedRide) {
      setError('Please select the ride this incident occurred on');
      return;
    }
    if (!incidentType) {
      setError('Please select an incident type category');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a full description of the incident');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const targetRideId = (selectedRide.rideId?._id || selectedRide.rideId || selectedRide._id).toString();
      await api.reportIncident({
        rideId: targetRideId,
        type: incidentType,
        description: description.trim(),
        subject: `${incidentSegment === 'passenger' ? 'Passenger Incident' : 'Rider / Road Incident'}: ${incidentType}`,
        severity: incidentType.toLowerCase().includes('accident') || incidentType.toLowerCase().includes('threat') || incidentType.toLowerCase().includes('physical') ? 'Critical' : 'Medium',
      });
      setSuccess(true);
      fetchIncidents();
    } catch (e) {
      setError(e.message || 'Failed to submit incident report');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={[styles.safe, { alignItems: 'center', justifyContent: 'center', padding: 24 }]} edges={['top']}>
        <View style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: 'rgba(245,166,35,0.15)',
          borderWidth: 2,
          borderColor: '#F5A623',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
        }}>
          <Text style={{ fontSize: 36 }}>🛡️</Text>
        </View>
        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 8 }}>
          Incident Report Submitted
        </Text>
        <Text style={{ color: '#8E9BAE', fontSize: 13.5, textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 12 }}>
          Your report has been received and escalated to our campus safety review team. We will take appropriate action within 24 hours.
        </Text>
        <TouchableOpacity
          onPress={() => {
            setSuccess(false);
            setActiveTab('history');
            setDescription('');
            setIncidentType('');
            fetchIncidents();
          }}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#F5A623',
            borderRadius: 12,
            paddingVertical: 14,
            paddingHorizontal: 24,
            width: '100%',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ color: '#000000', fontSize: 14.5, fontWeight: '900' }}>📑 View My Incident Reports</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#121824',
            borderWidth: 1.2,
            borderColor: '#1C2536',
            borderRadius: 12,
            paddingVertical: 14,
            paddingHorizontal: 24,
            width: '100%',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Back to Dashboard</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const currentCategoryList = incidentSegment === 'passenger'
    ? PASSENGER_INCIDENT_CATEGORIES
    : RIDER_ROAD_INCIDENT_CATEGORIES;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? '#090D16' : '#f8fafc' }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header matching Image 3 */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#F5A623', fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginBottom: 4 }}>
              — SAFETY
            </Text>
            <Text style={{ color: isDark ? '#FFFFFF' : '#0f172a', fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 }}>
              Incident Report
            </Text>
            <Text style={{ color: isDark ? '#8E9BAE' : '#64748b', fontSize: 13 }}>
              Report any safety concern or issue with a ride.
            </Text>
          </View>

          {/* Tab Selector: New Report vs My Reports */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: isDark ? '#121824' : '#e2e8f0',
            borderRadius: 12,
            padding: 4,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: isDark ? '#1C2536' : '#cbd5e1',
          }}>
            <TouchableOpacity
              onPress={() => setActiveTab('new')}
              activeOpacity={0.8}
              style={[{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                borderRadius: 10,
              }, activeTab === 'new' && { backgroundColor: '#F5A623' }]}
            >
              <Text style={{
                color: activeTab === 'new' ? '#000000' : (isDark ? '#8E9BAE' : '#475569'),
                fontSize: 13,
                fontWeight: '800',
              }}>
                📝 New Report
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setActiveTab('history');
                fetchIncidents();
              }}
              activeOpacity={0.8}
              style={[{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                borderRadius: 10,
              }, activeTab === 'history' && { backgroundColor: '#F5A623' }]}
            >
              <Text style={{
                color: activeTab === 'history' ? '#000000' : (isDark ? '#8E9BAE' : '#475569'),
                fontSize: 13,
                fontWeight: '800',
              }}>
                📑 My Reports ({incidents.length})
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'history' ? (
            /* My Reports History List */
            <View style={{ marginTop: 4 }}>
              {incidentsLoading ? (
                <ActivityIndicator color="#F5A623" style={{ marginVertical: 32 }} />
              ) : incidents.length === 0 ? (
                <View style={{
                  alignItems: 'center',
                  paddingVertical: 44,
                  backgroundColor: isDark ? '#111724' : '#ffffff',
                  borderRadius: 16,
                  borderWidth: 1.2,
                  borderColor: isDark ? '#1D2638' : '#e2e8f0',
                  paddingHorizontal: 20,
                }}>
                  <Text style={{ fontSize: 44, marginBottom: 12 }}>🛡️</Text>
                  <Text style={{ color: isDark ? '#FFFFFF' : '#0f172a', fontSize: 16, fontWeight: '800', marginBottom: 6 }}>
                    No Incidents Reported
                  </Text>
                  <Text style={{ color: '#8E9BAE', fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                    You have not submitted any incident reports. All your past reports and admin responses will appear here.
                  </Text>
                </View>
              ) : (
                incidents.map((inc) => {
                  const st = (inc.status || 'open').toLowerCase();
                  const stBadge = st === 'resolved'
                    ? { label: '✓ Resolved', color: colors.green, bg: 'rgba(0,230,118,0.12)' }
                    : st === 'exported_to_authorities'
                    ? { label: '👮 Escalated to Authorities', color: '#ff5252', bg: 'rgba(255,82,82,0.12)' }
                    : st === 'under_review'
                    ? { label: '🔍 Under Investigation', color: '#00d2ff', bg: 'rgba(0,210,255,0.12)' }
                    : { label: '⏳ Reported • Under Review', color: '#F5A623', bg: 'rgba(245,166,35,0.12)' };

                  const rideObj = inc.rideId;
                  const incDate = inc.createdAt ? new Date(inc.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                  const incTime = inc.createdAt ? new Date(inc.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

                  return (
                    <View key={inc._id} style={{
                      backgroundColor: isDark ? '#111724' : '#ffffff',
                      borderRadius: 14,
                      borderWidth: 1.2,
                      borderColor: isDark ? '#1D2638' : '#e2e8f0',
                      padding: 14,
                      marginBottom: 12,
                    }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ color: '#F5A623', fontSize: 13, fontWeight: '800', flex: 1, marginRight: 8 }} numberOfLines={1}>
                          ⚠️ {inc.type || 'Ride Incident'}
                        </Text>
                        <View style={{ backgroundColor: stBadge.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: stBadge.color + '44' }}>
                          <Text style={{ color: stBadge.color, fontSize: 10.5, fontWeight: '800' }}>{stBadge.label}</Text>
                        </View>
                      </View>

                      {rideObj ? (
                        <View style={{ backgroundColor: isDark ? '#0B0E17' : '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 10, gap: 4 }}>
                          <Text style={{ color: '#8E9BAE', fontSize: 11.5 }} numberOfLines={1}>
                            🟢 Pickup: <Text style={{ color: isDark ? '#FFFFFF' : '#0f172a', fontWeight: '700' }}>{getRidePickup(rideObj)}</Text>
                          </Text>
                          <Text style={{ color: '#8E9BAE', fontSize: 11.5 }} numberOfLines={1}>
                            🔴 Drop: <Text style={{ color: isDark ? '#FFFFFF' : '#0f172a', fontWeight: '700' }}>{getRideDrop(rideObj)}</Text>
                          </Text>
                        </View>
                      ) : null}

                      <Text style={{ color: isDark ? '#FFFFFF' : '#0f172a', fontSize: 13, lineHeight: 18, marginBottom: 10 }}>
                        {inc.description}
                      </Text>

                      {inc.resolutionNotes ? (
                        <View style={{ backgroundColor: 'rgba(0,230,118,0.08)', borderWidth: 1, borderColor: 'rgba(0,230,118,0.25)', padding: 10, borderRadius: 8, marginBottom: 8 }}>
                          <Text style={{ color: colors.green, fontSize: 11, fontWeight: '800', marginBottom: 2 }}>ADMIN RESOLUTION NOTES:</Text>
                          <Text style={{ color: isDark ? '#FFFFFF' : '#0f172a', fontSize: 12 }}>{inc.resolutionNotes}</Text>
                        </View>
                      ) : null}

                      {inc.exportRef ? (
                        <Text style={{ color: '#8E9BAE', fontSize: 11, marginBottom: 4 }}>
                          Case Ref ID: <Text style={{ color: '#F5A623', fontWeight: '700' }}>{inc.exportRef}</Text>
                        </Text>
                      ) : null}

                      <Text style={{ color: '#566478', fontSize: 10.5, borderTopWidth: 1, borderTopColor: '#1D2638', paddingTop: 6, marginTop: 4 }}>
                        📅 Reported on {incDate} at {incTime}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          ) : (
            /* New Report Form matching Images 3, 4, 5 */
            <View>
              {error ? (
                <View style={{ backgroundColor: 'rgba(255,82,82,0.12)', borderWidth: 1, borderColor: '#ff5252', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  <Text style={{ color: '#ff5252', fontSize: 13, fontWeight: '700' }}>⚠️ {error}</Text>
                </View>
              ) : null}

              {/* Card 1: Select Ride */}
              <View style={{
                backgroundColor: isDark ? '#111724' : '#ffffff',
                borderRadius: 14,
                borderWidth: 1.2,
                borderColor: isDark ? '#1D2638' : '#e2e8f0',
                padding: 16,
                marginBottom: 16,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <Text style={{ fontSize: 16 }}>🚗</Text>
                  <Text style={{ color: isDark ? '#FFFFFF' : '#0f172a', fontSize: 15, fontWeight: '800' }}>Select Ride</Text>
                </View>
                <Text style={{ color: '#8E9BAE', fontSize: 12, marginBottom: 12 }}>
                  Choose the ride this incident occurred on
                </Text>

                <TouchableOpacity
                  onPress={() => setShowRideModal(true)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: isDark ? '#0B0E17' : '#f8fafc',
                    borderWidth: 1.2,
                    borderColor: isDark ? '#232E42' : '#cbd5e1',
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={{
                    color: selectedRide ? (isDark ? '#FFFFFF' : '#0f172a') : (isDark ? '#7E8B9F' : '#64748b'),
                    fontSize: 13.5,
                    fontWeight: selectedRide ? '600' : '400',
                    flex: 1,
                    marginRight: 8,
                  }} numberOfLines={1}>
                    {selectedRide
                      ? `${getRideDateTime(selectedRide).date} • ${getRidePickup(selectedRide).split(',')[0]} → ${getRideDrop(selectedRide).split(',')[0]}`
                      : '— Select a ride —'}
                  </Text>
                  <Text style={{ color: '#7E8B9F', fontSize: 13 }}>▾</Text>
                </TouchableOpacity>
              </View>

              {/* Passenger Incident vs Rider/Road Incident Toggle matching Image 3 */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                {/* Passenger Incident Button */}
                <TouchableOpacity
                  onPress={() => {
                    setIncidentSegment('passenger');
                    setIncidentType('');
                  }}
                  activeOpacity={0.85}
                  style={[{
                    flex: 1,
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1.2,
                  }, incidentSegment === 'passenger' ? {
                    backgroundColor: '#F5A623',
                    borderColor: '#F5A623',
                  } : {
                    backgroundColor: '#121824',
                    borderColor: '#1C2536',
                  }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <Text style={{ fontSize: 14 }}>🎁</Text>
                    <Text style={{
                      color: incidentSegment === 'passenger' ? '#000000' : (isDark ? '#E2E8F0' : '#0f172a'),
                      fontSize: 12.5,
                      fontWeight: '800',
                    }}>
                      Passenger Incident
                    </Text>
                  </View>
                  <Text style={{
                    color: incidentSegment === 'passenger' ? 'rgba(0,0,0,0.7)' : (isDark ? '#6B7A90' : '#64748b'),
                    fontSize: 10.5,
                    textAlign: 'center',
                  }}>
                    Issues caused by your passenger
                  </Text>
                </TouchableOpacity>

                {/* Rider / Road Incident Button */}
                <TouchableOpacity
                  onPress={() => {
                    setIncidentSegment('rider_road');
                    setIncidentType('');
                  }}
                  activeOpacity={0.85}
                  style={[{
                    flex: 1,
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1.2,
                  }, incidentSegment === 'rider_road' ? {
                    backgroundColor: '#F5A623',
                    borderColor: '#F5A623',
                  } : {
                    backgroundColor: '#121824',
                    borderColor: '#1C2536',
                  }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <Text style={{ fontSize: 14 }}>🏍</Text>
                    <Text style={{
                      color: incidentSegment === 'rider_road' ? '#000000' : (isDark ? '#E2E8F0' : '#0f172a'),
                      fontSize: 12.5,
                      fontWeight: '800',
                    }}>
                      Rider / Road Incident
                    </Text>
                  </View>
                  <Text style={{
                    color: incidentSegment === 'rider_road' ? 'rgba(0,0,0,0.7)' : (isDark ? '#6B7A90' : '#64748b'),
                    fontSize: 10.5,
                    textAlign: 'center',
                  }}>
                    Accidents, breakdowns, hazards
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Card 2: Incident Type */}
              <View style={{
                backgroundColor: isDark ? '#111724' : '#ffffff',
                borderRadius: 14,
                borderWidth: 1.2,
                borderColor: isDark ? '#1D2638' : '#e2e8f0',
                padding: 16,
                marginBottom: 16,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <Text style={{ fontSize: 16 }}>⚠️</Text>
                  <Text style={{ color: isDark ? '#FFFFFF' : '#0f172a', fontSize: 15, fontWeight: '800' }}>Incident Type</Text>
                </View>
                <Text style={{ color: '#8E9BAE', fontSize: 12, marginBottom: 12 }}>
                  {incidentSegment === 'passenger'
                    ? 'Select the passenger incident category'
                    : 'Select the road / rider incident category'}
                </Text>

                <TouchableOpacity
                  onPress={() => setShowTypeModal(true)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: isDark ? '#0B0E17' : '#f8fafc',
                    borderWidth: 1.2,
                    borderColor: isDark ? '#232E42' : '#cbd5e1',
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={{
                    color: incidentType ? (isDark ? '#FFFFFF' : '#0f172a') : (isDark ? '#7E8B9F' : '#64748b'),
                    fontSize: 13.5,
                    fontWeight: incidentType ? '700' : '400',
                    flex: 1,
                    marginRight: 8,
                  }} numberOfLines={1}>
                    {incidentType || '— Select incident type —'}
                  </Text>
                  <Text style={{ color: '#7E8B9F', fontSize: 13 }}>▾</Text>
                </TouchableOpacity>
              </View>

              {/* Card 3: Full Description */}
              <View style={{
                backgroundColor: isDark ? '#111724' : '#ffffff',
                borderRadius: 14,
                borderWidth: 1.2,
                borderColor: isDark ? '#1D2638' : '#e2e8f0',
                padding: 16,
                marginBottom: 16,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <Text style={{ fontSize: 16 }}>📝</Text>
                  <Text style={{ color: isDark ? '#FFFFFF' : '#0f172a', fontSize: 15, fontWeight: '800' }}>Full Description</Text>
                </View>
                <Text style={{ color: '#8E9BAE', fontSize: 12, marginBottom: 12 }}>
                  Explain in detail what happened
                </Text>

                <TextInput
                  style={{
                    backgroundColor: isDark ? '#0B0E17' : '#f8fafc',
                    borderWidth: 1.2,
                    borderColor: isDark ? '#232E42' : '#cbd5e1',
                    borderRadius: 10,
                    color: isDark ? '#FFFFFF' : '#0f172a',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 13.5,
                    height: 120,
                    textAlignVertical: 'top',
                  }}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe everything that happened in detail..."
                  placeholderTextColor={isDark ? '#4A5568' : '#94a3b8'}
                  multiline
                  maxLength={1000}
                />
                <View style={{ alignItems: 'flex-end', marginTop: 6 }}>
                  <Text style={{ color: '#566478', fontSize: 11 }}>
                    {description.length} characters
                  </Text>
                </View>
              </View>

              {/* Submit Incident Report Button */}
              <TouchableOpacity
                onPress={submit}
                disabled={loading}
                activeOpacity={0.85}
                style={{
                  backgroundColor: '#F5A623',
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <Text style={{ color: '#000000', fontSize: 15, fontWeight: '900' }}>
                  {loading ? 'Submitting…' : '🚨 Submit Incident Report'}
                </Text>
              </TouchableOpacity>

              <Text style={{ color: '#566478', fontSize: 11.5, textAlign: 'center', marginTop: 12, marginBottom: 20 }}>
                False reports may result in account suspension.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Modal: Select Ride Dropdown ── */}
      <Modal
        visible={showRideModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRideModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.75)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            width: '100%',
            maxWidth: 380,
            maxHeight: '75%',
            backgroundColor: isDark ? '#101726' : '#ffffff',
            borderRadius: 18,
            borderWidth: 1.5,
            borderColor: isDark ? '#232E42' : '#cbd5e1',
            padding: 18,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: isDark ? '#FFFFFF' : '#0f172a', fontSize: 17, fontWeight: '800' }}>
                🚗 Select Ride
              </Text>
              <TouchableOpacity onPress={() => setShowRideModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ color: '#8E9BAE', fontSize: 18, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {ridesLoading ? (
              <ActivityIndicator color="#F5A623" style={{ padding: 24 }} />
            ) : rides.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🚗</Text>
                <Text style={{ color: '#8E9BAE', fontSize: 13, textAlign: 'center' }}>
                  No previous rides found on your account.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={true}>
                {rides.map((r, idx) => {
                  const id = r._id || r.rideId?._id;
                  const isSel = selectedRide && (selectedRide._id || selectedRide.rideId?._id) === id;
                  const dt = getRideDateTime(r);
                  const p = getRidePickup(r).split(',')[0];
                  const d = getRideDrop(r).split(',')[0];

                  return (
                    <TouchableOpacity
                      key={id || idx}
                      onPress={() => {
                        setSelectedRide(r);
                        setShowRideModal(false);
                      }}
                      activeOpacity={0.7}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        backgroundColor: isSel ? '#1E60D5' : (isDark ? '#141D2D' : '#f8fafc'),
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: isSel ? '#3B82F6' : (isDark ? '#1C273B' : '#e2e8f0'),
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: isSel ? '#FFFFFF' : '#F5A623', fontSize: 12, fontWeight: '800' }}>
                          📅 {dt.date} • {dt.time}
                        </Text>
                      </View>
                      <Text style={{ color: isSel ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#0f172a'), fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                        🟢 {p} → 🔴 {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Modal: Select Incident Type Dropdown (Matching Images 4 & 5) ── */}
      <Modal
        visible={showTypeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTypeModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.8)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            width: '100%',
            maxWidth: 380,
            maxHeight: '80%',
            backgroundColor: isDark ? '#0F1624' : '#ffffff',
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: isDark ? '#243046' : '#cbd5e1',
            overflow: 'hidden',
          }}>
            {/* Dropdown Header Box */}
            <View style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: isDark ? '#1E293B' : '#e2e8f0',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: isDark ? '#141D2E' : '#f1f5f9',
            }}>
              <Text style={{ color: isDark ? '#FFFFFF' : '#0f172a', fontSize: 14.5, fontWeight: '800' }}>
                — Select incident type —
              </Text>
              <TouchableOpacity onPress={() => setShowTypeModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ color: '#8E9BAE', fontSize: 18, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable List matching Images 4 & 5 */}
            <ScrollView
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingVertical: 4 }}
            >
              {currentCategoryList.map((cat, idx) => {
                const isSelected = incidentType === cat;
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      setIncidentType(cat);
                      setShowTypeModal(false);
                    }}
                    activeOpacity={0.7}
                    style={{
                      paddingVertical: 13,
                      paddingHorizontal: 16,
                      backgroundColor: isSelected ? '#1E60D5' : 'transparent',
                      borderBottomWidth: idx < currentCategoryList.length - 1 ? 1 : 0,
                      borderBottomColor: isDark ? '#151D2A' : '#e2e8f0',
                    }}
                  >
                    <Text style={{
                      color: isSelected ? '#FFFFFF' : (isDark ? '#CBD5E1' : '#0f172a'),
                      fontSize: 13,
                      fontWeight: isSelected ? '800' : '500',
                    }}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════
//  FORGOT PASSWORD / OTP RESET SCREEN
// ═══════════════════════════════════════════════════════════════
export function ForgotPasswordScreen({ navigation }) {
  const { isDark } = useTheme();
  const [step,        setStep]        = useState(1); // 1: Email, 2: OTP & New Password, 3: Success
  const [email,       setEmail]       = useState('');
  const [otp,         setOtp]         = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [resetToken,  setResetToken]  = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [successMsg,  setSuccessMsg]  = useState('');
  const [countdown,   setCountdown]   = useState(120);

  useEffect(() => {
    let timer = null;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, countdown]);

  const handleSendOtp = async () => {
    if (!email.trim()) { setError('Enter your registered college email'); return; }
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      const res = await api.sendOtp(email.trim().toLowerCase());
      setSuccessMsg(res.message || `OTP sent to ${email.trim()}`);
      setStep(2);
      setCountdown(120);
    } catch (e) {
      setError(e.message || 'Failed to send OTP. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!otp.trim() || otp.trim().length < 4) {
      setError('Enter the 6-digit OTP sent to your email');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPwd) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true); setError('');
    try {
      await api.resetPassword({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        password: newPassword,
        newPassword: newPassword,
        resetToken: resetToken || undefined,
      });
      setStep(3);
    } catch (e) {
      setError(e.message || 'Failed to reset password. Please verify OTP.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, color: colors.text, paddingHorizontal: 14,
    paddingVertical: 13, fontSize: 14, marginBottom: 12,
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 20 }}>
          <Text style={{ color: colors.text2 }}>← Back to Login</Text>
        </TouchableOpacity>

        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 4 }}>
          {step === 3 ? '🎉 All Set!' : 'Reset Password'}
        </Text>
        <Text style={{ color: colors.text2, fontSize: 13, marginBottom: spacing.lg }}>
          {step === 1 && 'Enter your registered email to receive a 6-digit verification code.'}
          {step === 2 && `Enter the OTP sent to ${email} and your new password.`}
          {step === 3 && 'Your password has been successfully updated.'}
        </Text>

        <Alert message={error} />
        {successMsg && step === 2 ? <Alert message={successMsg} type="success" /> : null}

        {step === 1 && (
          <View>
            <TextInput
              style={inputStyle}
              value={email}
              onChangeText={setEmail}
              placeholder="you@college.edu"
              placeholderTextColor={colors.text3}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={handleSendOtp} disabled={loading} style={[styles.btn, loading && { opacity: 0.5 }]}>
              <Text style={styles.btnText}>{loading ? 'Sending OTP…' : 'Send Verification OTP ✉️'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View>
            <TextInput
              style={[inputStyle, { letterSpacing: 4, fontWeight: '700', textAlign: 'center', fontSize: 18 }]}
              value={otp}
              onChangeText={setOtp}
              placeholder="Enter 6-digit OTP"
              placeholderTextColor={colors.text3}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TextInput
              style={inputStyle}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password (min 6 chars)"
              placeholderTextColor={colors.text3}
              secureTextEntry
            />
            <TextInput
              style={inputStyle}
              value={confirmPwd}
              onChangeText={setConfirmPwd}
              placeholder="Confirm new password"
              placeholderTextColor={colors.text3}
              secureTextEntry
            />

            <TouchableOpacity onPress={handleResetPassword} disabled={loading} style={[styles.btn, loading && { opacity: 0.5 }, { marginTop: 4 }]}>
              <Text style={styles.btnText}>{loading ? 'Resetting…' : 'Reset Password 🔒'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSendOtp}
              disabled={loading || countdown > 0}
              style={{ marginTop: 16, alignItems: 'center' }}
            >
              <Text style={{
                color: countdown > 0 ? colors.text3 : colors.accent,
                fontSize: 13,
                fontWeight: '600'
              }}>
                {countdown > 0
                  ? `Resend code in ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`
                  : "Didn't receive OTP? Resend code"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={{ alignItems: 'center', paddingTop: 20 }}>
            <Text style={{ fontSize: 50, marginBottom: 16 }}>✅</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Password Reset Successful</Text>
            <Text style={{ color: colors.text2, fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
              You can now sign in to HOGO with your new password.
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={[styles.btn, { width: '100%' }]}>
              <Text style={styles.btnText}>Sign In Now →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Shared styles for this file
const inputStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 15 },
  fieldWrap: {},
  inputField: {},
});

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 48 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: 12,
  },
  btn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
  },
  btnText: { color: '#000', fontWeight: '700', fontSize: 15 },
});
