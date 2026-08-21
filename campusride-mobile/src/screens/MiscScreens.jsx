// ═══════════════════════════════════════════════════════════════
//  RIDE DETAIL SCREEN
// ═══════════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Btn, Alert, Badge } from '../components/UI';
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

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} /></SafeAreaView>;

  const isOwner  = ride && (ride.providerId?._id === user?._id || ride.providerId === user?._id);
  const isSeeker = user?.role === 'seeker' || user?.role === 'both';
  const canBook  = isSeeker && !isOwner && !booking.status && ride?.status === 'active';
  const VEHICLE_ICON = { motorcycle: '🏍️', car: '🚗', suv: '🚙', xuv: '🛻' };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.text2, fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>

        <Alert message={error} />

        {ride && (
          <>
            {/* Header */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 28 }}>{VEHICLE_ICON[ride.vehicleType] || '🚗'}</Text>
                  <View>
                    <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
                      {ride.vehicleName || ride.vehicleType}
                    </Text>
                    <Text style={{ color: colors.text2, fontSize: 13, marginTop: 2 }}>
                      {ride.providerId?.name || 'Provider'}
                    </Text>
                  </View>
                </View>
                <Badge label={ride.status} color={ride.status === 'active' ? colors.green : colors.text3} />
              </View>
              {ride.womenOnly && <Badge label="♀ Women Only" color={colors.pink} style={{ marginTop: 8 }} />}
            </View>

            {/* Route */}
            <View style={styles.card}>
              <Text style={{ color: colors.text3, fontSize: 11, fontWeight: '700', marginBottom: 12 }}>ROUTE</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green }} />
                <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>{getAddr(ride.pickup)}</Text>
              </View>
              <View style={{ width: 2, height: 20, backgroundColor: colors.border, marginLeft: 4, marginBottom: 8 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.red }} />
                <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>{getAddr(ride.drop)}</Text>
              </View>
            </View>

            {/* Details */}
            <View style={styles.card}>
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

            {/* Booking */}
            <Alert message={booking.error} />
            {booking.status === 'pending'  && <Alert message="⏳ Booking request sent! Waiting for provider." type="warning" />}
            {booking.status === 'accepted' && <Alert message="✅ Your booking is confirmed!" type="success" />}
            {booking.status === 'rejected' && <Alert message="❌ Booking was rejected." />}

            {canBook && (
              <Btn label="Book This Ride" onPress={doBook} loading={booking.loading} style={{ marginTop: 8 }} />
            )}

            {isOwner && (
              <Btn label="View Booking Requests →" onPress={() => navigation.navigate('ProviderBookings')} variant="outline" style={{ marginTop: 8 }} />
            )}
          </>
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
  const [bookings,  setBookings]  = useState([]);
  const [myRides,   setMyRides]   = useState([]);
  const [loading,   setLoading]   = useState(true);

  const isSeeker   = user?.role === 'seeker'   || user?.role === 'both';
  const isProvider = user?.role === 'provider' || user?.role === 'both';

  useEffect(() => {
    const promises = [];
    if (isSeeker)   promises.push(api.getMyBookings().then(setBookings));
    if (isProvider) promises.push(api.getMyRides().then(setMyRides));
    Promise.all(promises).finally(() => setLoading(false));
  }, []);

  const NOTIF_TYPE = {
    pending:     { icon: '📬', color: colors.blue,  label: 'Booking Request' },
    accepted:    { icon: '✅', color: colors.green, label: 'Booking Accepted' },
    rejected:    { icon: '❌', color: colors.red,   label: 'Booking Rejected' },
    cancelled:   { icon: '🚫', color: colors.text3, label: 'Cancelled' },
    'in-progress':{ icon:'🛣️', color: colors.blue,  label: 'Ride In Progress' },
    completed:   { icon: '🏁', color: colors.green, label: 'Completed' },
  };

  const seekerNotifs = bookings.map(b => ({
    id: b._id,
    icon:  (NOTIF_TYPE[b.status] || NOTIF_TYPE.pending).icon,
    color: (NOTIF_TYPE[b.status] || NOTIF_TYPE.pending).color,
    label: (NOTIF_TYPE[b.status] || NOTIF_TYPE.pending).label,
    title: `Booking ${b.status}`,
    body:  `${b.rideId?.pickup?.address?.split(',')[0] || 'Pickup'} → ${b.rideId?.drop?.address?.split(',')[0] || 'Drop'}`,
    time:  b.updatedAt || b.createdAt,
    onPress: () => navigation.navigate('RideDetail', { rideId: b.rideId?._id || b.rideId }),
  }));

  const providerNotifs = myRides.flatMap(r =>
    (r.bookings || []).filter(b => b.status === 'pending').map(b => ({
      id: b._id,
      icon: '📬', color: colors.accent,
      label: 'New Request',
      title: 'New booking request',
      body:  `${r.pickup?.address?.split(',')[0] || '?'} → ${r.drop?.address?.split(',')[0] || '?'}`,
      time:  b.createdAt,
      onPress: () => navigation.navigate('ProviderBookings'),
    }))
  );

  const allNotifs = [...seekerNotifs, ...providerNotifs]
    .sort((a, b) => new Date(b.time) - new Date(a.time));

  function timeAgo(d) {
    const m = Math.floor((Date.now() - new Date(d)) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m / 60)}h ago`;
    return `${Math.floor(m / 1440)}d ago`;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.md }}>🔔 Notifications</Text>
        {loading ? <ActivityIndicator color={colors.accent} /> : allNotifs.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
            <Text style={{ color: colors.text2, fontSize: 16 }}>No notifications yet</Text>
          </View>
        ) : (
          allNotifs.map(n => (
            <TouchableOpacity key={n.id} style={[styles.card, { flexDirection: 'row', gap: 12 }]} onPress={n.onPress} activeOpacity={0.8}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: n.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16 }}>{n.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: n.color, fontSize: 11, fontWeight: '700' }}>{n.label}</Text>
                  <Text style={{ color: colors.text3, fontSize: 11 }}>{timeAgo(n.time)}</Text>
                </View>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 3 }}>{n.title}</Text>
                <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>{n.body}</Text>
              </View>
            </TouchableOpacity>
          ))
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
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [from,    setFrom]    = useState('');
  const [to,      setTo]      = useState('');
  const [time,    setTime]    = useState('');
  const [posting, setPosting] = useState(false);
  const [womenOnly,setWomenOnly]= useState(false);
  const [joined,  setJoined]  = useState({});

  useEffect(() => {
    api.getCommunityPosts()
      .then(data => setPosts((Array.isArray(data) ? data : []).filter(p => p.type === 'walk')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const postWalk = async () => {
    if (!from.trim() || !to.trim() || !time.trim()) return;
    setPosting(true);
    try {
      const womenTag = womenOnly ? ' 👩 Women only.' : '';
      const content = `🚶 Walking from ${from} → ${to} at ${time}. Anyone joining?${womenTag}`;
      const post = await api.createCommunityPost({ content, type: 'walk', anonymous: false });
      setPosts(prev => [post, ...prev]);
      setFrom(''); setTo(''); setTime('');
    } catch (e) { RNAlert.alert('Error', e.message || 'Failed to post'); }
    finally { setPosting(false); }
  };

  const { Input: InputComp, Btn: BtnComp } = require('../components/UI');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 4 }}>🚶 Walk Together</Text>
        <Text style={{ color: colors.text2, fontSize: 13, marginBottom: spacing.md }}>Find a walking companion on campus</Text>

        <View style={styles.card}>
          <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '700', marginBottom: 12 }}>📢 I'M WALKING…</Text>
          <View style={inputStyles.wrap}><Text style={inputStyles.icon}>📍</Text>
            <Text onPress={()=>{}} style={{flex:1}} />
          </View>
          {[
            { placeholder: 'From (e.g. Gate 1, Main Block)', value: from, setter: setFrom },
            { placeholder: 'To (e.g. Library, Canteen)',     value: to,   setter: setTo   },
            { placeholder: 'Time (e.g. 8:30 AM)',            value: time, setter: setTime },
          ].map((f, i) => (
            <View key={i} style={inputStyles.fieldWrap}>
              <Text style={inputStyles.inputField} onPress={() => {}}>
                {/* handled by TextInput */}
              </Text>
            </View>
          ))}
          {/* Using raw TextInput for simplicity */}
          {renderWalkInputs(from, setFrom, to, setTo, time, setTime)}

          {user?.gender === 'female' && (
            <TouchableOpacity onPress={() => setWomenOnly(w => !w)} style={[{ flexDirection:'row', alignItems:'center', gap:10, borderRadius:radius.md, borderWidth:1.5, padding:12, marginBottom:12 }, womenOnly ? { borderColor:colors.pink, backgroundColor:'rgba(233,30,140,0.08)' } : { borderColor:colors.border }]}>
              <Text style={{ fontSize: 18 }}>{womenOnly ? '🔒' : '♀'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: womenOnly ? colors.pink : colors.text2, fontSize: 13, fontWeight: '700' }}>{womenOnly ? 'Women Only 🔒' : 'Open to everyone'}</Text>
                <Text style={{ color: colors.text3, fontSize: 11 }}>Tap to toggle women-only</Text>
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

        {loading ? <ActivityIndicator color={colors.accent} /> : posts.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 32 }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>🚶</Text>
            <Text style={{ color: colors.text2, fontSize: 14, textAlign: 'center' }}>No walk requests yet. Post one above!</Text>
          </View>
        ) : (
          posts.map(post => (
            <View key={post._id} style={styles.card}>
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, marginBottom: 10 }}>{post.content}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.text3, fontSize: 12 }}>
                  {post.anonymous ? 'Anonymous' : post.authorName}
                </Text>
                <TouchableOpacity
                  onPress={() => setJoined(j => ({ ...j, [post._id]: !j[post._id] }))}
                  style={[{ borderRadius:radius.full, paddingHorizontal:14, paddingVertical:6, borderWidth:1 }, joined[post._id] ? { backgroundColor:colors.green, borderColor:colors.green } : { borderColor:colors.border }]}
                >
                  <Text style={{ color: joined[post._id] ? '#000' : colors.text2, fontSize: 12, fontWeight: '700' }}>
                    {joined[post._id] ? '✓ Joined' : 'Join'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function renderWalkInputs(from, setFrom, to, setTo, time, setTime) {
  const { TextInput, StyleSheet: RNStyleSheet } = require('react-native');
  const s = RNStyleSheet.create({
    inp: { backgroundColor: colors.surface2, borderWidth:1, borderColor:colors.border, borderRadius:radius.md, color:colors.text, paddingHorizontal:14, paddingVertical:12, fontSize:14, marginBottom:10 },
  });
  return (
    <>
      <TextInput style={s.inp} value={from} onChangeText={setFrom} placeholder="From (e.g. Gate 1, Hostel)" placeholderTextColor={colors.text3} />
      <TextInput style={s.inp} value={to}   onChangeText={setTo}   placeholder="To (e.g. Library, Canteen)" placeholderTextColor={colors.text3} />
      <TextInput style={s.inp} value={time} onChangeText={setTime} placeholder="Time (e.g. 8:30 AM)"        placeholderTextColor={colors.text3} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ROUTE ALERTS SCREEN
// ═══════════════════════════════════════════════════════════════
export function RouteAlertsScreen({ navigation }) {
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
    <SafeAreaView style={styles.safe} edges={['top']}>
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
//  INCIDENT REPORT SCREEN
// ═══════════════════════════════════════════════════════════════
export function IncidentReportScreen({ navigation }) {
  const { user } = useAuth();
  const isProvider = user?.role === 'provider' || user?.role === 'both';

  const [rides,       setRides]       = useState([]);
  const [rideId,      setRideId]      = useState('');
  const [incidentType,setIncidentType]= useState('');
  const [description, setDescription] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [ridesLoading,setRidesLoading]= useState(true);
  const [success,     setSuccess]     = useState(false);
  const [error,       setError]       = useState('');

  const TYPES = isProvider ? [
    'Passenger No Show', 'Passenger Rude Behaviour', 'Passenger Harassment',
    'Passenger Refused to Pay', 'Accident / Collision', 'Vehicle Breakdown', 'Other',
  ] : [
    'Rash Driving', 'Driver Behaviour', 'Route Deviation', 'Overcharging',
    'Late Pickup / No Show', 'Physical Safety Threat', 'Accident / Collision', 'Other',
  ];

  useEffect(() => {
    const getter = isProvider ? api.getMyRides : api.getMyBookings;
    getter()
      .then(data => setRides(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setRidesLoading(false));
  }, []);

  const submit = async () => {
    if (!rideId || !incidentType || !description.trim()) { setError('Fill all fields'); return; }
    setLoading(true); setError('');
    try {
      await api.reportIncident({ rideId, type: incidentType, description, role: isProvider ? 'provider' : 'seeker' });
      setSuccess(true);
    } catch (e) { setError(e.message || 'Failed to submit'); }
    finally { setLoading(false); }
  };

  const { TextInput, Picker } = require('react-native');

  if (success) return (
    <SafeAreaView style={[styles.safe, { alignItems:'center', justifyContent:'center', padding:24 }]}>
      <Text style={{ fontSize: 52, marginBottom: 16 }}>✅</Text>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>Report Submitted</Text>
      <Text style={{ color: colors.text2, fontSize: 14, textAlign: 'center', marginBottom: 32 }}>Our team will review your report within 24 hours.</Text>
      <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.btn, { width:'100%' }]}>
        <Text style={styles.btnText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );

  const inputStyle = { backgroundColor:colors.surface2, borderWidth:1, borderColor:colors.border, borderRadius:radius.md, color:colors.text, paddingHorizontal:14, paddingVertical:12, fontSize:14, marginBottom:12 };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.text2, fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 4 }}>⚠️ Report Incident</Text>
        <Text style={{ color: colors.text2, fontSize: 13, marginBottom: spacing.md }}>Help us keep the community safe</Text>

        <Alert message={error} />

        <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>SELECT RIDE</Text>
        {ridesLoading ? <ActivityIndicator color={colors.accent} /> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {rides.slice(0, 10).map(r => {
                const id = r._id || r.rideId?._id;
                const addr = r.pickup?.address || r.rideId?.pickup?.address || 'Ride';
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setRideId(id)}
                    style={[{ borderRadius:radius.md, borderWidth:1.5, padding:10 }, rideId===id ? { borderColor:colors.accent, backgroundColor:colors.accentDim } : { borderColor:colors.border }]}
                  >
                    <Text style={{ color: rideId===id ? colors.accent : colors.text2, fontSize: 12, maxWidth: 140 }} numberOfLines={2}>{addr}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>INCIDENT TYPE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {TYPES.map(t => (
            <TouchableOpacity key={t} onPress={() => setIncidentType(t)}
              style={[{ borderRadius:radius.md, borderWidth:1.5, paddingHorizontal:12, paddingVertical:8 }, incidentType===t ? { borderColor:colors.accent, backgroundColor:colors.accentDim } : { borderColor:colors.border }]}>
              <Text style={{ color: incidentType===t ? colors.accent : colors.text2, fontSize: 12 }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>DESCRIPTION</Text>
        <TextInput
          style={[inputStyle, { height: 100, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe what happened in detail…"
          placeholderTextColor={colors.text3}
          multiline
          maxLength={1000}
        />

        <TouchableOpacity onPress={submit} disabled={loading} style={[styles.btn, loading && { opacity: 0.5 }]}>
          <Text style={styles.btnText}>{loading ? 'Submitting…' : '⚠️ Submit Report'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════
//  FORGOT PASSWORD / OTP RESET SCREEN
// ═══════════════════════════════════════════════════════════════
export function ForgotPasswordScreen({ navigation }) {
  const { TextInput } = require('react-native');
  const [step,        setStep]        = useState(1); // 1: Email, 2: OTP & New Password, 3: Success
  const [email,       setEmail]       = useState('');
  const [otp,         setOtp]         = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [resetToken,  setResetToken]  = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [successMsg,  setSuccessMsg]  = useState('');

  const handleSendOtp = async () => {
    if (!email.trim()) { setError('Enter your registered college email'); return; }
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      const res = await api.sendOtp(email.trim().toLowerCase());
      setSuccessMsg(res.message || `OTP sent to ${email.trim()}`);
      setStep(2);
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
    <SafeAreaView style={styles.safe}>
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

            <TouchableOpacity onPress={handleSendOtp} disabled={loading} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>Didn't receive OTP? Resend code</Text>
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
