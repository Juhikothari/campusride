import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert as RNAlert, Linking } from 'react-native';
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
    title: 'Get a Buddy',
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
    title: 'Nadi',
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
          const matchedBookings = requests.filter(b => (b.rideId === activeDriverRide._id || b.rideId?._id === activeDriverRide._id) && b.status === 'accepted');
          const passengerNames = matchedBookings.map(b => b.seekerId?.name || 'Passenger').filter(Boolean);
          const passengerColleges = matchedBookings.map(b => b.seekerId?.college).filter(Boolean);
          const passengerPhones = matchedBookings.map(b => b.seekerId?.phone).filter(Boolean);
          const isChecklistDone = activeDriverRide.seekerChecklistCompleted || matchedBookings.some(b => b.checklistCompleted);

          let passengerPhone = passengerPhones[0] || null;
          if (!passengerPhone && activeDriverRide.passengers?.length > 0) {
            passengerPhone = activeDriverRide.passengers[0]?.seeker?.phone || null;
          }

          setActiveTrip({
            ...activeDriverRide,
            matchedPassengerName: passengerNames[0] || (passengerNames.length > 0 ? passengerNames.join(', ') : 'Passenger'),
            matchedPassengerCollege: passengerColleges[0] || activeDriverRide.college || 'Campus Commuter',
            matchedPassengerPhone: passengerPhone,
            hasAcceptedBookings: matchedBookings.length > 0,
            seekerChecklistCompleted: isChecklistDone,
          });
          setTripRole('driver');
          return;
        }

        // Check if user is passenger with an accepted booking
        const activeSeekerBooking = bookings.find(b =>
          b.status === 'accepted' && (b.rideId?.status === 'in-progress' || b.rideId?.status === 'active')
        );
        if (activeSeekerBooking?.rideId) {
          setActiveTrip({
            ...activeSeekerBooking.rideId,
            bookedSeats: activeSeekerBooking.seats || 1,
            seatsAvailable: activeSeekerBooking.rideId?.seatsAvailable,
            seekerChecklistCompleted: activeSeekerBooking.checklistCompleted || activeSeekerBooking.rideId?.seekerChecklistCompleted,
          });
          setActiveBookingId(activeSeekerBooking._id || activeSeekerBooking.id);
          setTripRole('rider');
          return;
        }

        setActiveTrip(null);
        setActiveBookingId(null);
      } catch (err) {
        console.log('Error loading active trip:', err);
      }
    };

    fetchActiveTrip();
    const interval = setInterval(fetchActiveTrip, 15000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const [activeBookingId, setActiveBookingId] = useState(null);

  const handleCancelTrip = () => {
    if (!activeTrip) return;
    const isDriver = tripRole === 'driver';
    RNAlert.alert(
      isDriver ? '❌ Cancel Ride' : '❌ Cancel Booking',
      isDriver
        ? 'Are you sure you want to cancel this ride? All matched passengers will be notified.'
        : 'Are you sure you want to cancel your seat on this ride?',
      [
        { text: 'Keep Ride', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const rId = activeTrip._id || activeTrip.id;
              if (isDriver) {
                await api.cancelRide(rId, 'Cancelled by driver');
              } else {
                if (activeBookingId) {
                  await api.cancelBooking(activeBookingId);
                } else {
                  await api.cancelRide(rId, 'Cancelled by seeker');
                }
              }
              setActiveTrip(null);
              RNAlert.alert('Cancelled', isDriver ? 'Ride cancelled successfully.' : 'Booking cancelled successfully.');
            } catch (err) {
              RNAlert.alert('Error', err.message || 'Failed to cancel');
            }
          }
        }
      ]
    );
  };

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

              {/* Driver & Vehicle Box / Passenger Box */}
              <View style={styles.driverBox}>
                <View style={[styles.driverIconCircle, tripRole === 'driver' && { backgroundColor: 'rgba(33,150,243,0.15)', borderColor: colors.blue }]}>
                  <Text style={{ fontSize: 18 }}>{tripRole === 'driver' ? '👤' : '🚗'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverTitle}>
                    {tripRole === 'driver'
                      ? `Passenger: ${activeTrip.matchedPassengerName || 'Matched Passenger'}`
                      : (activeTrip.providerId?.name || 'Assigned Driver')}
                  </Text>
                  <Text style={styles.driverVehicle}>
                    {tripRole === 'driver'
                      ? `🎓 ${activeTrip.matchedPassengerCollege || 'Campus Commuter'}`
                      : `${activeTrip.vehicleName || 'Vehicle'} • ${activeTrip.vehicleNumber || 'Plate Number'}`}
                  </Text>
                  {tripRole === 'driver' && activeTrip.matchedPassengerPhone ? (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${activeTrip.matchedPassengerPhone}`)}
                      style={styles.phoneContactRow}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.phoneContactText}>📞 {activeTrip.matchedPassengerPhone}</Text>
                      <View style={styles.phoneCallBadge}>
                        <Text style={styles.phoneCallBadgeText}>Call</Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}
                  {tripRole === 'rider' && activeTrip.providerId?.phone ? (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${activeTrip.providerId.phone}`)}
                      style={styles.phoneContactRow}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.phoneContactText}>📞 {activeTrip.providerId.phone}</Text>
                      <View style={styles.phoneCallBadge}>
                        <Text style={styles.phoneCallBadgeText}>Call Driver</Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}
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
                  <Text style={styles.tripMetaText}>
                    {(() => {
                      const avail = (activeTrip.seatsAvailable !== undefined && activeTrip.seatsAvailable !== null)
                        ? Number(activeTrip.seatsAvailable)
                        : 1;
                      return `${avail} seat${avail === 1 ? '' : 's'}`;
                    })()}
                  </Text>
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
                <View style={{ gap: 6 }}>
                  {activeTrip.seekerChecklistCompleted ? (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.openGpsBtn,
                          { backgroundColor: colors.green, borderWidth: 1, borderColor: colors.green }
                        ]}
                        onPress={async () => {
                          const rId = activeTrip._id || activeTrip.id;
                          try {
                            await api.startRide(rId);
                            navigation.navigate('LiveTracking', { rideId: rId });
                          } catch (err) {
                            RNAlert.alert('Cannot Start Ride', err.message || 'Wait for passenger to complete safety checklist.');
                          }
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.openGpsBtnText, { color: '#000' }]}>
                          🚀 Start Ride Now →
                        </Text>
                      </TouchableOpacity>
                      <Text style={{ color: colors.green, fontSize: 11.5, textAlign: 'center', fontWeight: '600' }}>
                        ✓ Passenger verified safety checklist! Ready to depart.
                      </Text>
                    </>
                  ) : (
                    <View style={{ backgroundColor: 'rgba(255,160,0,0.12)', borderWidth: 1, borderColor: colors.accent, borderRadius: radius.md, padding: 12, alignItems: 'center' }}>
                      <Text style={{ fontSize: 20, marginBottom: 4 }}>⏳</Text>
                      <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '800' }}>Waiting for Passenger Checklist</Text>
                      <Text style={{ color: colors.text2, fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 2 }}>
                        The passenger must complete their safety checklist before departure. Start option will appear once verified.
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ gap: 6 }}>
                  {!activeTrip.seekerChecklistCompleted ? (
                    <TouchableOpacity
                      style={[styles.openGpsBtn, { backgroundColor: colors.accent }]}
                      onPress={() => navigation.navigate('PreRideChecklist', { rideId: activeTrip._id || activeTrip.id })}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.openGpsBtnText, { color: '#000' }]}>🛡️ Complete Safety Checklist to Start →</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ backgroundColor: 'rgba(0,230,118,0.12)', borderWidth: 1, borderColor: colors.green, borderRadius: radius.md, padding: 10, alignItems: 'center' }}>
                      <Text style={{ color: colors.green, fontSize: 12, fontWeight: '700' }}>
                        ✅ Safety checklist verified! Waiting for driver to start ride.
                      </Text>
                    </View>
                  )}
                  <Text style={{ color: colors.accent, fontSize: 11.5, textAlign: 'center', fontWeight: '600', marginTop: 2 }}>
                    ⏳ Pre-ride matched. Live tracking map will activate once driver taps Start Ride.
                  </Text>
                </View>
              )}

              {/* Secondary Buttons Row — Details button removed per request */}
              <View style={styles.secondaryBtnRow}>
                {tripRole === 'driver' && activeTrip.status === 'in-progress' && (
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
                  onPress={() => navigation.navigate(tripRole === 'driver' ? 'ProviderBookings' : 'MyBookings')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryBtnText}>
                    {tripRole === 'driver' ? 'Requests' : 'Bookings'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: colors.red + '66' }]}
                  onPress={handleCancelTrip}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.red, fontWeight: '700' }]}>
                    {tripRole === 'driver' ? '❌ Cancel Ride' : '❌ Cancel'}
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
  phoneContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,230,118,0.12)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.3)',
    alignSelf: 'flex-start',
  },
  phoneContactText: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '800',
  },
  phoneCallBadge: {
    backgroundColor: colors.green,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  phoneCallBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
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
