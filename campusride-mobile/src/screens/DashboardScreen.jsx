import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert as RNAlert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import TopHeader from '../components/TopHeader';
import FloatingChatBot from '../components/FloatingChatBot';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';

const MAIN_SERVICES = [
  {
    key: 'SearchRides',
    icon: '🔍',
    title: 'Search Your Match',
    sub: 'Match with commuters on your route',
    iconBg: '#1a2233',
  },
  {
    key: 'CreateRide',
    icon: '🚗',
    title: 'Offer a Ride',
    sub: 'Post your route and split the cost',
    iconBg: '#1c2630',
  },
  {
    key: 'Community',
    icon: '💬',
    title: 'Community',
    sub: 'Posts, chat and campus alerts',
    iconBg: '#1e2430',
  },
  {
    key: 'WalkTogether',
    icon: '🚶',
    title: 'Walk Together',
    sub: 'Find someone walking the same campus route',
    iconBg: '#222328',
  },
];

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [activeTrip, setActiveTrip] = useState(null);
  const [tripRole,   setTripRole]   = useState('driver'); // 'driver' | 'rider'
  const [loading,    setLoading]    = useState(false);

  const firstName = user?.name ? user.name.split(' ')[0] : 'Juhi';
  const collegeName = user?.college || 'Rnsit';

  // Load active trip status
  useEffect(() => {
    let mounted = true;
    const fetchActiveTrip = async () => {
      try {
        const [bookingsRes, ridesRes, requestsRes] = await Promise.allSettled([
          api.getMyBookings(),
          api.getMyRides(),
          api.getRideRequests(),
        ]);
        if (!mounted) return;

        const rides = ridesRes.status === 'fulfilled' ? (Array.isArray(ridesRes.value) ? ridesRes.value : ridesRes.value?.rides || []) : [];
        const bookings = bookingsRes.status === 'fulfilled' ? (Array.isArray(bookingsRes.value) ? bookingsRes.value : bookingsRes.value?.bookings || []) : [];
        const requests = requestsRes.status === 'fulfilled' ? (Array.isArray(requestsRes.value) ? requestsRes.value : requestsRes.value?.requests || []) : [];

        // Check if user is provider of an in-progress ride, OR an active ride that has at least one accepted passenger!
        const activeDriverRide = rides.find(r => {
          if (r.status === 'in-progress') return true;
          if (r.status === 'active') {
            return requests.some(b => (b.rideId === r._id || b.rideId?._id === r._id) && b.status === 'accepted');
          }
          return false;
        });

        if (activeDriverRide) {
          setActiveTrip(activeDriverRide);
          setTripRole('driver');
          return;
        }

        // Check if user is passenger with an accepted booking
        const activeSeekerBooking = bookings.find(b =>
          b.status === 'accepted' && (b.rideId?.status === 'in-progress' || b.rideId?.status === 'active')
        );
        if (activeSeekerBooking?.rideId) {
          setActiveTrip(activeSeekerBooking.rideId);
          setTripRole('rider');
          return;
        }

        setActiveTrip(null);
      } catch (err) {
        console.log('Error loading active trip:', err);
      }
    };

    fetchActiveTrip();
    const interval = setInterval(fetchActiveTrip, 15000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const handleFinishTrip = () => {
    if (!activeTrip) return;
    RNAlert.alert(
      '🏁 Finish & Complete Ride',
      'Are you sure you want to end this ride? All passengers will be marked as reached destination.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete Ride',
          onPress: async () => {
            try {
              await api.completeRide(activeTrip._id || activeTrip.id);
              setActiveTrip(null);
              RNAlert.alert('🎉 Ride Completed', 'The trip has been completed successfully!');
            } catch (err) {
              RNAlert.alert('Error', err.message || 'Failed to complete ride');
            }
          }
        }
      ]
    );
  };

  const getAddress = (loc) => {
    if (!loc) return 'Campus';
    if (typeof loc === 'string') return loc;
    return loc.address || loc.label || 'Campus Route';
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top Header matching Images 2 & 3 */}
      <TopHeader title="HOGO" subtitle="Find Your Match" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hey Greeting Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroGlowCircle} />
          <Text style={styles.heroGreeting}>Hey, {firstName} 👋</Text>
          <View style={styles.collegeRow}>
            <Text style={{ fontSize: 13, marginRight: 4 }}>🏫</Text>
            <Text style={styles.heroCollege}>{collegeName}</Text>
          </View>
        </View>

        {/* WHAT DO YOU NEED? section */}
        <Text style={styles.sectionLabel}>WHAT DO YOU NEED?</Text>

        <View style={styles.servicesContainer}>
          {MAIN_SERVICES.map(item => (
            <TouchableOpacity
              key={item.key}
              style={styles.serviceCard}
              onPress={() => navigation.navigate(item.key)}
              activeOpacity={0.8}
            >
              <View style={[styles.serviceIconWrap, { backgroundColor: item.iconBg }]}>
                <Text style={styles.serviceIcon}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.serviceTitle}>{item.title}</Text>
                <Text style={styles.serviceSub}>{item.sub}</Text>
              </View>
              <Text style={styles.serviceArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ACTIVE TRIP STATUS (Matching Image 3) */}
        {activeTrip && (
          <View style={styles.activeTripSection}>
            <Text style={styles.sectionLabel}>ACTIVE TRIP STATUS</Text>
            <View style={styles.activeTripCard}>
              {/* Trip Header */}
              <View style={styles.tripHeaderRow}>
                <View style={styles.tripStatusIndicator}>
                  <View style={[styles.liveGreenDot, activeTrip.status !== 'in-progress' && { backgroundColor: colors.accent }]} />
                  <Text style={styles.tripHeaderText}>
                    {activeTrip.status === 'in-progress'
                      ? (tripRole === 'driver' ? '🚀 YOU ARE DRIVING (LIVE TRIP)' : '🚗 YOU ARE RIDING (LIVE TRIP)')
                      : (tripRole === 'driver' ? '🚗 UPCOMING TRIP (READY TO START)' : '🚗 MATCHED TRIP (WAITING TO START)')}
                  </Text>
                </View>
                <View style={[styles.liveBadge, activeTrip.status !== 'in-progress' && { backgroundColor: colors.accentDim, borderColor: colors.accent }]}>
                  <Text style={[styles.liveBadgeText, activeTrip.status !== 'in-progress' && { color: colors.accent }]}>
                    {activeTrip.status === 'in-progress' ? 'LIVE' : 'CONFIRMED'}
                  </Text>
                </View>
              </View>

              {activeTrip.date && (
                <Text style={styles.tripDateSub}>
                  {activeTrip.date} {activeTrip.time ? `• ${activeTrip.time}` : ''}
                </Text>
              )}

              {/* Driver & Vehicle Box */}
              <View style={styles.driverBox}>
                <View style={styles.driverIconCircle}>
                  <Text style={{ fontSize: 18 }}>🚗</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverTitle}>
                    {tripRole === 'driver' ? 'You (Driver)' : (activeTrip.providerId?.name || 'Assigned Driver')}
                  </Text>
                  <Text style={styles.driverVehicle}>
                    {activeTrip.vehicleName || activeTrip.providerId?.kycDocuments?.vehicleName || 'Vehicle'}
                  </Text>
                </View>
              </View>

              {/* Route Points — Full address display */}
              <View style={styles.routeBox}>
                <View style={styles.routePointRow}>
                  <View style={[styles.routeDot, { backgroundColor: colors.green }]} />
                  <Text style={styles.routeAddressText} numberOfLines={2}>
                    {getAddress(activeTrip.pickup)}
                  </Text>
                </View>
                <View style={styles.routeConnectingLine} />
                <View style={styles.routePointRow}>
                  <View style={[styles.routeDot, { backgroundColor: colors.red }]} />
                  <Text style={styles.routeAddressText} numberOfLines={2}>
                    {getAddress(activeTrip.drop)}
                  </Text>
                </View>
              </View>

              {/* Seats & Cost */}
              <View style={styles.tripMetaRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 14 }}>👥</Text>
                  <Text style={styles.tripMetaText}>{activeTrip.seatsAvailable || 2} seats</Text>
                </View>
                <Text style={styles.tripCostText}>₹{activeTrip.costPerSeat || 49} / seat</Text>
              </View>

              {/* Action Buttons based on in-progress vs pre-start */}
              {activeTrip.status === 'in-progress' ? (
                <TouchableOpacity
                  style={styles.openGpsBtn}
                  onPress={() => navigation.navigate('LiveTracking', { rideId: activeTrip._id || activeTrip.id })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.openGpsBtnText}>📍 Open Live GPS & Tracking →</Text>
                </TouchableOpacity>
              ) : tripRole === 'driver' ? (
                <TouchableOpacity
                  style={[styles.openGpsBtn, { backgroundColor: colors.green }]}
                  onPress={async () => {
                    const rId = activeTrip._id || activeTrip.id;
                    try {
                      await api.startRide(rId);
                    } catch {}
                    navigation.navigate('LiveTracking', { rideId: rId });
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.openGpsBtnText, { color: '#000' }]}>🚀 Start Ride Now →</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ gap: 6 }}>
                  <TouchableOpacity
                    style={styles.openGpsBtn}
                    onPress={() => navigation.navigate('PreRideChecklist', { rideId: activeTrip._id || activeTrip.id })}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.openGpsBtnText}>🛡️ View Safety Checklist & Details →</Text>
                  </TouchableOpacity>
                  <Text style={{ color: colors.accent, fontSize: 11.5, textAlign: 'center', fontWeight: '600', marginTop: 2 }}>
                    ⏳ Pre-ride matched. Live tracking will activate once driver taps Start Ride.
                  </Text>
                </View>
              )}

              {/* Secondary Buttons Row with Finish Ride */}
              <View style={styles.secondaryBtnRow}>
                {tripRole === 'driver' && (
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { backgroundColor: 'rgba(0,230,118,0.15)', borderColor: colors.green }]}
                    onPress={handleFinishTrip}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.secondaryBtnText, { color: colors.green, fontWeight: '900' }]}>🏁 Finish Ride</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => navigation.navigate('RideDetail', { rideId: activeTrip._id || activeTrip.id })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryBtnText}>Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => navigation.navigate(tripRole === 'driver' ? 'ProviderBookings' : 'MyBookings')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryBtnText}>
                    {tripRole === 'driver' ? 'Requests' : 'Bookings'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Footer Tagline */}
        <Text style={styles.tagline}>The operating system for daily commuting in Indian cities</Text>
      </ScrollView>

      {/* Floating HOGO AI Assistant Button */}
      <FloatingChatBot />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 36 },

  heroCard: {
    backgroundColor: '#0e1218',
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: '#1e2430',
    padding: 22,
    marginBottom: spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlowCircle: {
    position: 'absolute',
    right: -25,
    top: -25,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(245,166,35,0.06)',
  },
  heroGreeting: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  collegeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroCollege: {
    color: colors.text2,
    fontSize: 14,
    fontWeight: '600',
  },

  sectionLabel: {
    color: colors.text2,
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 4,
  },

  servicesContainer: {
    gap: 10,
    marginBottom: spacing.md,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0e1218',
    borderWidth: 1.5,
    borderColor: '#1e2533',
    borderRadius: radius.xxl,
    padding: 16,
  },
  serviceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  serviceIcon: {
    fontSize: 20,
  },
  serviceTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  serviceSub: {
    color: colors.text2,
    fontSize: 12,
    lineHeight: 16,
  },
  serviceArrow: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },

  activeTripSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  activeTripCard: {
    backgroundColor: '#0c1017',
    borderRadius: radius.xxl,
    borderWidth: 2,
    borderColor: colors.accent,
    padding: 18,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  tripHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tripStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  liveGreenDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.green,
  },
  tripHeaderText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  liveBadge: {
    backgroundColor: 'rgba(0,230,118,0.15)',
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  liveBadgeText: {
    color: colors.green,
    fontSize: 10,
    fontWeight: '900',
  },
  tripDateSub: {
    color: colors.text3,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 17,
    marginBottom: 12,
  },

  driverBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131822',
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1e2636',
  },
  driverIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245,166,35,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  driverTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  driverVehicle: {
    color: colors.text2,
    fontSize: 12,
    marginTop: 2,
  },

  routeBox: {
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  routePointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeConnectingLine: {
    width: 2,
    height: 16,
    backgroundColor: '#262f40',
    marginLeft: 3,
    marginVertical: 2,
  },
  routeAddressText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },

  tripMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1e2636',
    paddingTop: 12,
    marginBottom: 14,
  },
  tripMetaText: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '700',
  },
  tripCostText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },

  openGpsBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  openGpsBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
  },

  secondaryBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#131822',
    borderWidth: 1,
    borderColor: '#1e2636',
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '700',
  },

  tagline: {
    color: colors.text3,
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
});
