import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert as RNAlert, Linking, Modal,
  Animated, Easing, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import TopHeader from '../components/TopHeader';
import FloatingChatBot from '../components/FloatingChatBot';
import { Btn } from '../components/UI';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MAIN_SERVICES = [
  {
    key: 'SearchRides',
    icon: '🔍',
    title: 'Search Your Buddy',
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

  // Per-user Testing popup & Onboarding Tour states
  const [showBetaDisclaimer, setShowBetaDisclaimer] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedFeatureIdx, setSelectedFeatureIdx] = useState(0);

  const userKey = user?._id || user?.id || user?.email || (user?.phone ? String(user.phone) : 'guest');
  const firstName = user?.name ? user.name.split(' ')[0] : 'Juhi';
  const collegeName = user?.college || 'Rnsit';

  // Animation values for vehicle and pointing indicator
  const bikeAnim = useRef(new Animated.Value(0)).current;
  const pointerAnim = useRef(new Animated.Value(0)).current;

  // Continuous vehicle cruising animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bikeAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bikeAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [bikeAnim]);

  // Pointing beacon bounce animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pointerAnim, {
          toValue: 6,
          duration: 500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pointerAnim, {
          toValue: 0,
          duration: 500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pointerAnim]);

  // Per-user First-time Beta Disclaimer & Onboarding Tour checks
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const betaKey = `@has_seen_beta_testing_popup_${userKey}`;
        const seenBeta = await AsyncStorage.getItem(betaKey);
        if (!seenBeta && mounted) {
          setShowBetaDisclaimer(true);
        }

        const onbKey = `@has_seen_onboarding_tour_${userKey}`;
        const showOnb = await AsyncStorage.getItem('@show_onboarding_carousel');
        const seenOnb = await AsyncStorage.getItem(onbKey);
        if ((showOnb === 'true' || !seenOnb) && mounted) {
          setShowOnboarding(true);
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, [userKey]);

  const dismissBetaDisclaimer = async () => {
    setShowBetaDisclaimer(false);
    try {
      await AsyncStorage.setItem(`@has_seen_beta_testing_popup_${userKey}`, 'true');
    } catch {}
  };

  const dismissOnboarding = async () => {
    setShowOnboarding(false);
    try {
      await AsyncStorage.setItem(`@has_seen_onboarding_tour_${userKey}`, 'true');
      await AsyncStorage.setItem('@show_onboarding_carousel', 'false');
    } catch {}
  };

  const ONBOARDING_FEATURES = [
    {
      id: 'search',
      title: 'Search Your Buddy',
      icon: '🔍',
      vehicle: '🛵💨',
      station: 'Stop 1',
      tagline: 'Match routes within 5km & split fuel cost',
      desc: 'Find verified peers commuting along your exact route. View live map paths, calculate commute times, and split fuel costs effortlessly.',
      badge: 'ROUTE MATCHING',
      route: 'SearchRides',
      actionLabel: '🔍 Find Buddy Now →',
    },
    {
      id: 'offer',
      title: 'Get a Buddy (Offer Ride)',
      icon: '🚗',
      vehicle: '🚗💨',
      station: 'Stop 2',
      tagline: 'Post empty seats & save daily commute costs',
      desc: 'Driving or riding to campus? Post your seats, pick up verified classmates, and cut travel costs in half safely.',
      badge: 'OFFER SEATS',
      route: 'CreateRide',
      actionLabel: '🚗 Offer Ride Now →',
    },
    {
      id: 'walk',
      title: 'Nadi Walk Together',
      icon: '🚶',
      vehicle: '👟💨',
      station: 'Stop 3',
      tagline: 'Never walk alone across campus routes',
      desc: 'Find buddies walking the same path across campus hostels, libraries, or metro gates for safe company.',
      badge: 'CAMPUS WALK',
      route: 'WalkTogether',
      actionLabel: '🚶 Walk with Buddy →',
    },
    {
      id: 'community',
      title: 'Sitcom Campus Lounge',
      icon: '🛋️',
      vehicle: '☕💨',
      station: 'Stop 4',
      tagline: 'Central Perk & Dunder Mifflin college chats',
      desc: 'Hang out in sitcom-themed campus hubs (Central Perk, Dunder Mifflin, 99th Precinct) for student alerts & rides.',
      badge: 'CAMPUS COMMUNITY',
      route: 'Community',
      actionLabel: '🛋️ Open Sitcom Lounge →',
    },
    {
      id: 'safety',
      title: 'Safety, Live GPS & SOS',
      icon: '🛡️',
      vehicle: '🚨💨',
      station: 'Stop 5',
      tagline: 'Two-way checklists, live map tracking & emergency SOS',
      desc: 'Mandatory pre-ride checklist between seeker and provider, real-time live map tracking, and 24/7 instant emergency SOS.',
      badge: 'SAFETY & SOS',
      route: 'KYC',
      actionLabel: '🛡️ Verify Documents →',
    },
  ];

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

              {/* Price displayed to seeker to pay upon provider acceptance */}
              {tripRole === 'rider' && (
                <View style={styles.riderFareBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={styles.riderFareTag}>💰 FARE TO PAY DRIVER</Text>
                      <Text style={styles.riderFareSub}>Pay directly to driver via UPI or cash</Text>
                    </View>
                    <Text style={styles.riderFareAmount}>
                      ₹{(activeTrip.costPerSeat || 49) * (activeTrip.bookedSeats || 1)}
                    </Text>
                  </View>
                </View>
              )}

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

      {/* ── First-Time Short Testing Version Notice ── */}
      <Modal
        visible={showBetaDisclaimer}
        transparent
        animationType="fade"
        onRequestClose={dismissBetaDisclaimer}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.disclaimerCard, { padding: 22, maxWidth: 310, alignItems: 'center', borderRadius: radius.xl }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🧪</Text>
            <Text style={{ color: colors.accent, fontSize: 17, fontWeight: '800', marginBottom: 6 }}>Testing Version</Text>
            <Text style={{ color: colors.text2, fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 16 }}>
              This is a trial testing version of HOGO for campus evaluation.
            </Text>
            <Btn
              label="✓ Got it"
              onPress={dismissBetaDisclaimer}
              style={{ width: '100%', paddingVertical: 10 }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Interactive All-Features Transit Tour with Vehicle Animation & Pointer ── */}
      <Modal
        visible={showOnboarding && !showBetaDisclaimer}
        transparent
        animationType="slide"
        onRequestClose={dismissOnboarding}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.tourCard}>
            {/* Header */}
            <View style={styles.tourHeader}>
              <View style={styles.tourBadgePill}>
                <Text style={styles.tourBadgeText}>CAMPUS TRANSIT TOUR</Text>
              </View>
              <Text style={styles.tourTitle}>Explore All Campus Features</Text>
              <Text style={styles.tourSub}>
                Hop in with fellow students and cruise across every feature
              </Text>
            </View>

            {/* Vehicle Roadmap & Track */}
            <View style={styles.tourTrackContainer}>
              <View style={styles.tourTrackLine} />
              <View style={styles.tourStationsRow}>
                {ONBOARDING_FEATURES.map((feat, idx) => {
                  const isCur = selectedFeatureIdx === idx;
                  return (
                    <TouchableOpacity
                      key={feat.id}
                      style={[styles.stationNode, isCur && styles.stationNodeActive]}
                      onPress={() => setSelectedFeatureIdx(idx)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.stationIcon, isCur && { fontSize: 18 }]}>{feat.icon}</Text>
                      {isCur && (
                        <View style={styles.stationActiveGlow} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Animated Vehicle Cruising on Track */}
              <Animated.View
                style={[
                  styles.animatedCruisingVehicle,
                  {
                    transform: [
                      {
                        translateX: bikeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-15, SCREEN_WIDTH > 380 ? 250 : 200],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={{ fontSize: 20 }}>
                  {ONBOARDING_FEATURES[selectedFeatureIdx]?.vehicle || '🛵💨'}
                </Text>
              </Animated.View>
            </View>

            {/* All Features Stack with Pointer pointing at selected */}
            <ScrollView
              style={{ maxHeight: 290, width: '100%' }}
              contentContainerStyle={{ gap: 8, paddingBottom: 6 }}
              showsVerticalScrollIndicator={false}
            >
              {ONBOARDING_FEATURES.map((feat, idx) => {
                const isSelected = selectedFeatureIdx === idx;
                return (
                  <View key={feat.id} style={styles.featureItemWrapper}>
                    {/* Animated Pointer pointing at active feature */}
                    {isSelected ? (
                      <Animated.View
                        style={[
                          styles.pointerBeacon,
                          {
                            transform: [{ translateX: pointerAnim }],
                          },
                        ]}
                      >
                        <Text style={styles.pointerBeaconEmoji}>👉</Text>
                      </Animated.View>
                    ) : (
                      <View style={styles.pointerBeaconPlaceholder} />
                    )}

                    <TouchableOpacity
                      style={[
                        styles.featureCard,
                        isSelected && styles.featureCardSelected,
                      ]}
                      onPress={() => setSelectedFeatureIdx(idx)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.featureCardTopRow}>
                        <View style={styles.featureCardIconBadge}>
                          <Text style={{ fontSize: 18 }}>{feat.icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={[styles.featureCardTitle, isSelected && styles.featureCardTitleActive]}>
                              {feat.title}
                            </Text>
                            {isSelected && (
                              <Animated.View
                                style={{
                                  transform: [
                                    {
                                      translateX: bikeAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, 6],
                                      }),
                                    },
                                  ],
                                }}
                              >
                                <Text style={{ fontSize: 15 }}>{feat.vehicle}</Text>
                              </Animated.View>
                            )}
                          </View>
                          <Text style={styles.featureCardTagline}>{feat.tagline}</Text>
                        </View>
                      </View>

                      {isSelected && (
                        <View style={styles.featureDetailSection}>
                          <Text style={styles.featureCardDesc}>{feat.desc}</Text>
                          <TouchableOpacity
                            style={styles.featureHopInBtn}
                            onPress={() => {
                              dismissOnboarding();
                              if (feat.route) navigation.navigate(feat.route);
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.featureHopInBtnText}>
                              🚀 Hop in & Explore {feat.title} →
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>

            {/* Bottom Controls */}
            <View style={styles.tourBottomRow}>
              <Btn
                label={selectedFeatureIdx === ONBOARDING_FEATURES.length - 1 ? 'Start Commuting 🚀' : 'Next Stop →'}
                onPress={() => {
                  if (selectedFeatureIdx < ONBOARDING_FEATURES.length - 1) {
                    setSelectedFeatureIdx(i => i + 1);
                  } else {
                    dismissOnboarding();
                  }
                }}
                style={{ flex: 1 }}
              />
              <Btn
                label="Close"
                onPress={dismissOnboarding}
                variant="ghost"
                style={{ paddingHorizontal: 16 }}
              />
            </View>
          </View>
        </View>
      </Modal>

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
  riderFareBox: {
    backgroundColor: 'rgba(45, 212, 160, 0.12)',
    borderWidth: 1.5,
    borderColor: '#2dd4a0',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 12,
  },
  riderFareTag: {
    color: '#2dd4a0',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  riderFareSub: {
    color: colors.text2,
    fontSize: 11,
    marginTop: 2,
  },
  riderFareAmount: {
    color: '#2dd4a0',
    fontSize: 22,
    fontWeight: '900',
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

  /* Modal Backdrop & Shared Styles */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },

  /* Beta Disclaimer Card */
  disclaimerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 380,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
  },
  disclaimerIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  disclaimerBadge: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  disclaimerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
  },
  disclaimerBody: {
    color: colors.text2,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
  },
  disclaimerBulletBox: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    gap: 8,
  },
  disclaimerBullet: {
    color: colors.text2,
    fontSize: 11.5,
    lineHeight: 16,
  },

  /* Interactive All-Features Transit Tour */
  tourCard: {
    backgroundColor: '#0d1117',
    borderRadius: radius.xxl,
    padding: 16,
    width: '100%',
    maxWidth: 390,
    borderWidth: 1.5,
    borderColor: '#30363d',
    alignItems: 'center',
  },
  tourHeader: {
    alignItems: 'center',
    marginBottom: 10,
  },
  tourBadgePill: {
    backgroundColor: 'rgba(45, 212, 160, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 160, 0.3)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 4,
  },
  tourBadgeText: {
    color: '#2dd4a0',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tourTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 2,
  },
  tourSub: {
    color: colors.text2,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  tourTrackContainer: {
    width: '100%',
    height: 48,
    backgroundColor: '#131822',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#21262d',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginVertical: 10,
    paddingHorizontal: 12,
  },
  tourTrackLine: {
    position: 'absolute',
    top: 23,
    left: 20,
    right: 20,
    height: 2,
    borderWidth: 1,
    borderColor: '#30363d',
    borderStyle: 'dashed',
  },
  tourStationsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  stationNode: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161b22',
    borderWidth: 1.5,
    borderColor: '#30363d',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stationNodeActive: {
    backgroundColor: 'rgba(45, 212, 160, 0.2)',
    borderColor: '#2dd4a0',
    transform: [{ scale: 1.15 }],
  },
  stationIcon: {
    fontSize: 14,
  },
  stationActiveGlow: {
    position: 'absolute',
    bottom: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2dd4a0',
  },
  animatedCruisingVehicle: {
    position: 'absolute',
    top: 10,
    zIndex: 1,
  },
  featureItemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  pointerBeacon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  pointerBeaconEmoji: {
    fontSize: 16,
  },
  pointerBeaconPlaceholder: {
    width: 24,
    marginRight: 2,
  },
  featureCard: {
    flex: 1,
    backgroundColor: '#131822',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#21262d',
    padding: 10,
  },
  featureCardSelected: {
    backgroundColor: '#161d2b',
    borderColor: '#2dd4a0',
    borderWidth: 1.5,
  },
  featureCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureCardIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1c2333',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  featureCardTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  featureCardTitleActive: {
    color: '#2dd4a0',
  },
  featureCardTagline: {
    color: colors.text3,
    fontSize: 10.5,
    marginTop: 1,
  },
  featureDetailSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
  },
  featureCardDesc: {
    color: colors.text2,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 8,
  },
  featureHopInBtn: {
    backgroundColor: '#2dd4a0',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureHopInBtnText: {
    color: '#000000',
    fontSize: 11.5,
    fontWeight: '800',
  },
  tourBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    width: '100%',
  },
});
