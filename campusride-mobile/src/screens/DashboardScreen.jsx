import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert as RNAlert, Linking, Modal,
  Animated, Easing, Dimensions, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import TopHeader from '../components/TopHeader';
import FloatingChatBot from '../components/FloatingChatBot';
import { subscribeToCommunityUnread, getCommunityUnreadCount } from '../hooks/useSocket';
import { Btn } from '../components/UI';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';
import { getDisplayUSN } from '../utils/usn';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MAIN_SERVICES = [
  {
    key: 'SearchRides',
    title: 'Search Your Buddy',
    sub: 'Match with commuters on your route',
    iconBg: '#1a2233',
  },
  {
    key: 'CreateRide',
    title: 'Get a Buddy',
    sub: 'Offer a ride and travel together',
    iconBg: '#1c2630',
  },
  {
    key: 'Community',
    title: 'Community',
    sub: 'Posts, chat and campus alerts',
    iconBg: '#1e2430',
  },
  {
    key: 'WalkTogether',
    title: 'Nadi',
    sub: 'Find someone walking the same campus route',
    iconBg: '#222328',
  },
];

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [activeTrip, setActiveTrip] = useState(null);
  const [tripRole,   setTripRole]   = useState('driver'); // 'driver' | 'rider'
  const [loading,    setLoading]    = useState(false);

  // Per-user Testing popup & Onboarding Tour states
  const [showBetaDisclaimer, setShowBetaDisclaimer] = useState(false);
  const [showOnboardingPopup, setShowOnboardingPopup] = useState(false);
  const [popupStep, setPopupStep] = useState(0); // 0 to 3 for the 4 options
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(1); // 1 to 4
  const [unreadCommunityCount, setUnreadCommunityCount] = useState(getCommunityUnreadCount());

  // Refs for auto-scrolling to options on dashboard
  const scrollViewRef = useRef(null);
  const serviceCardPositions = useRef({});

  useEffect(() => {
    const unsub = subscribeToCommunityUnread((cnt) => {
      setUnreadCommunityCount(cnt);
    });
    return unsub;
  }, []);

  const userKey = user?._id || user?.id || user?.email || (user?.phone ? String(user.phone) : 'guest');
  const firstName = user?.name ? user.name.split(' ')[0] : 'Juhi';
  const collegeName = user?.college || 'Rnsit';

  // Animation values for vehicle and pointing indicator
  const bikeAnim = useRef(new Animated.Value(0)).current;
  const pointerAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const bikeBounceAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const stepContentAnim = useRef(new Animated.Value(1)).current;

  // Icon pulse animation loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.07,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Subtle bike riding bounce loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bikeBounceAnim, {
          toValue: -3,
          duration: 250,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(bikeBounceAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bikeBounceAnim]);

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
          toValue: 8,
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
          setShowOnboardingPopup(true);
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

  const handleSkipOnboarding = async () => {
    setShowOnboardingPopup(false);
    setIsTourActive(false);
    try {
      await AsyncStorage.setItem(`@has_seen_onboarding_tour_${userKey}`, 'true');
      await AsyncStorage.setItem('@show_onboarding_carousel', 'false');
    } catch {}
  };

  const finishTour = async () => {
    setIsTourActive(false);
    setShowOnboardingPopup(false);
    try {
      await AsyncStorage.setItem(`@has_seen_onboarding_tour_${userKey}`, 'true');
      await AsyncStorage.setItem('@show_onboarding_carousel', 'false');
    } catch {}
  };

  const peekTimeoutRef = useRef(null);

  const ONBOARDING_STEPS = [
    {
      step: 1,
      icon: '🤝',
      tagline: 'CAMPUS COMMUTE REIMAGINED',
      title: 'Meet HOGO',
      desc: 'Find matching buddy, travel together across campus, walk safer in groups, and stay connected!',
      btnLabel: 'Start →',
      targetKey: null,
      screenName: null,
    },
    {
      step: 2,
      icon: '🔍',
      tagline: 'NEVER COMMUTE ALONE',
      title: 'Search Your Buddy',
      desc: 'Need a ride? Connect with verified peers heading along your exact route in seconds. Commute together effortlessly.',
      btnLabel: 'Next →',
      targetKey: 'SearchRides',
      screenName: 'SearchRides',
    },
    {
      step: 3,
      icon: '🏍️',
      tagline: 'EMPTY SEATS? SHARE THE RIDE',
      title: 'Get a Buddy (Offer Ride)',
      desc: 'Riding or driving to campus? Post your route, pick up verified classmates, and travel to college together with ease.',
      btnLabel: 'Next →',
      targetKey: 'CreateRide',
      screenName: 'CreateRide',
    },
    {
      step: 4,
      icon: '💬',
      tagline: 'YOUR CAMPUS PULSE',
      title: 'College Community',
      desc: 'Verified student lounge for route updates, transit alerts, question boards, and real-time campus chat.',
      btnLabel: 'Next →',
      targetKey: 'Community',
      screenName: 'Community',
    },
    {
      step: 5,
      icon: '🚶‍♀️',
      tagline: 'SAFETY IN NUMBERS',
      title: 'Nadi (Walk Together)',
      desc: 'Heading across campus or to the metro? Pair up with verified walking companions anytime. Auto-disappears after 24 hrs.',
      btnLabel: 'Next →',
      targetKey: 'WalkTogether',
      screenName: 'WalkTogether',
    },
    {
      step: 6,
      icon: '🛡️',
      tagline: 'VERIFIED & IN CONTROL',
      title: 'Profile & Security',
      desc: 'View your uploaded KYC documents, register vehicles, check ride history, and toggle dark/light theme anytime.',
      btnLabel: 'Next →',
      targetKey: 'Profile',
      screenName: 'Profile',
    },
    {
      step: 7,
      icon: '🎉',
      tagline: "YOU'RE READY TO ROLL!",
      title: 'All Set for HOGO',
      desc: 'Connect with peers, travel safe, and make campus commutes fast and fun. Enjoy riding together!',
      btnLabel: "Let's Ride 🚀",
      targetKey: null,
      screenName: null,
    },
  ];

  const handleNextOnboarding = () => {
    if (popupStep === ONBOARDING_STEPS.length - 1) {
      finishTour();
      return;
    }
    const nextIdx = popupStep + 1;
    goToStep(nextIdx);
  };

  // Helper for navigating onboarding steps
  const goToStep = (stepIdx) => {
    try {
      const clamped = Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, stepIdx));
      setPopupStep(clamped);

      // Animate progress fill with clamp
      Animated.timing(progressAnim, {
        toValue: clamped / (ONBOARDING_STEPS.length - 1),
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

      // Trigger step content transition safely with JS driver
      stepContentAnim.setValue(0);
      Animated.timing(stepContentAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: false,
      }).start();

      // Scroll dashboard to match active feature
      const target = ONBOARDING_STEPS[clamped];
      if (target?.targetKey) {
        if (target.targetKey === 'Profile') {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        } else if (serviceCardPositions.current?.[target.targetKey] != null) {
          const yPos = serviceCardPositions.current[target.targetKey];
          setTimeout(() => {
            try {
              scrollViewRef.current?.scrollTo({
                y: Math.max(0, yPos - 120),
                animated: true,
              });
            } catch (e) {}
          }, 100);
        }
      }
    } catch (err) {
      console.log('goToStep error:', err);
    }
  };

  const navigateToOption = (stepIndex) => {
    goToStep(stepIndex - 1);
  };
  const TOUR_STEPS = ONBOARDING_STEPS;
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
          if (r.status === 'completed' || r.status === 'cancelled') return false;
          if (r.status === 'in-progress') return true;
          if (r.status === 'active') {
            return requests.some(b => (b.rideId === r._id || b.rideId?._id === r._id) && b.status === 'accepted');
          }
          return false;
        });

        if (activeDriverRide) {
          const matchedBookings = requests.filter(b => (b.rideId === activeDriverRide._id || b.rideId?._id === activeDriverRide._id) && b.status === 'accepted');
          const passengerNames = matchedBookings.map(b => getDisplayUSN(b.seekerId, 'Buddy')).filter(Boolean);
          const passengerColleges = matchedBookings.map(b => b.seekerId?.college).filter(Boolean);
          const passengerPhones = matchedBookings.map(b => b.seekerId?.phone).filter(Boolean);
          const isChecklistDone = activeDriverRide.seekerChecklistCompleted || matchedBookings.some(b => b.checklistCompleted);

          const passengersList = matchedBookings.map(b => ({
            name: 'Buddy',
            usn: getDisplayUSN(b.seekerId, 'Buddy'),
            college: b.seekerId?.college || activeDriverRide.college || 'Campus Commuter',
            phone: b.seekerId?.phone || null,
            seats: b.seats || 1,
            bookingId: b._id,
          }));

          let passengerPhone = passengerPhones[0] || null;
          if (!passengerPhone && activeDriverRide.passengers?.length > 0) {
            passengerPhone = activeDriverRide.passengers[0]?.seeker?.phone || null;
          }

          setActiveTrip({
            ...activeDriverRide,
            passengersList,
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
          b.status === 'accepted' &&
          b.rideId?.status !== 'completed' &&
          b.rideId?.status !== 'cancelled' &&
          (b.rideId?.status === 'in-progress' || b.rideId?.status === 'active')
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
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]} edges={['top']}>
      {/* Top Header matching Images 2 & 3 */}
      <TopHeader title="HOGO" subtitle="Find Your Match" showBack={false} highlightProfile={showOnboardingPopup && (ONBOARDING_STEPS[popupStep]?.targetKey === 'Profile')} />

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hey Greeting Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: isDark ? '#0e1218' : '#ffffff', borderColor: isDark ? '#1e2430' : '#e2e8f0' }]}>
          <View style={styles.heroGlowCircle} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroGreeting, { color: isDark ? colors.text : '#0f172a' }]}>Hey, {firstName} 👋</Text>
              <View style={styles.collegeRow}>
                <Text style={{ fontSize: 13, marginRight: 4 }}>🏫</Text>
                <Text style={[styles.heroCollege, { color: isDark ? colors.text2 : '#475569' }]} numberOfLines={1}>{collegeName}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={toggleTheme}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? '#1a2234' : '#f1f5f9',
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: isDark ? '#2e3a52' : '#cbd5e1',
                gap: 6,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 14 }}>{isDark ? '☀️' : '🌙'}</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#f1f5f9' : '#0f172a' }}>
                {isDark ? 'Light' : 'Dark'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* WHAT DO YOU NEED? section */}
        <Text style={[styles.sectionLabel, { color: isDark ? colors.text2 : '#475569' }]}>WHAT DO YOU NEED?</Text>

        <View style={styles.servicesContainer}>
          {MAIN_SERVICES.map((item, idx) => {
            const isHighlighted = showOnboardingPopup && (ONBOARDING_STEPS[popupStep]?.targetKey === item.key);
            const isTourTarget = isTourActive && !showBetaDisclaimer && (tourStep === idx + 1);
            return (
              <View
                key={item.key}
                style={{ position: 'relative' }}
                onLayout={(e) => {
                  serviceCardPositions.current[item.key] = e.nativeEvent.layout.y;
                }}
              >
                {isTourTarget && (
                  <View style={styles.tourPointingRow}>
                    <Animated.View
                      style={[
                        styles.tourBikeAnimatedBadge,
                        {
                          transform: [
                            {
                              translateX: bikeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 24],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 22 }}>🛵💨</Text>
                    </Animated.View>
                    <View style={styles.tourCurrentStopBadge}>
                      <Text style={styles.tourCurrentStopText}>📍 OPTION {tourStep}/4 · {item.title.toUpperCase()}</Text>
                    </View>
                  </View>
                )}
                {isHighlighted && (
                  <View style={styles.onbHighlightCardBanner}>
                    <Text style={styles.onbHighlightCardBannerText}>
                      ✨ STEP {popupStep + 1}: {item.title.toUpperCase()}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    styles.serviceCard,
                    { backgroundColor: isDark ? '#0e1218' : '#ffffff', borderColor: isDark ? '#1e2533' : '#e2e8f0' },
                    isTourTarget && styles.serviceCardTourActive,
                    isHighlighted && styles.serviceCardOnbHighlighted,
                  ]}
                  onPress={() => {
                    if (isTourActive && tourStep < 4) {
                      navigateToOption(tourStep + 1);
                    }
                    navigation.navigate(item.key);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[styles.serviceTitle, { color: isDark ? colors.text : '#0f172a' }]}>{item.title}</Text>
                      {item.key === 'Community' && unreadCommunityCount > 0 && (
                        <View style={styles.whatsappBadge}>
                          <Text style={styles.whatsappBadgeText}>{unreadCommunityCount}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.serviceSub, { color: isDark ? colors.text2 : '#475569' }]}>{item.sub}</Text>
                  </View>
                  
                  {/* Clean chevron arrow when idle; animated tour bike ONLY when this card is targeted by tour */}
                  <View style={styles.serviceNavWrap}>
                    {isTourTarget ? (
                      <Animated.View
                        style={{
                          transform: [
                            {
                              translateX: bikeAnim.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [0, 6, 0],
                              }),
                            },
                          ],
                        }}
                      >
                        <Text style={styles.serviceNavBike}>🛵💨</Text>
                      </Animated.View>
                    ) : (
                      <Text style={[styles.serviceChevron, { color: isDark ? '#8d98ad' : '#64748b' }]}>›</Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* ACTIVE TRIP STATUS (Matching Image 3) */}
        {/* Active Trip Live Card (Hidden after completed or cancelled) */}
        {activeTrip && activeTrip.status !== 'completed' && activeTrip.status !== 'cancelled' && (
          <View style={styles.activeTripSection}>
            <Text style={[styles.sectionLabel, { color: isDark ? colors.text2 : '#475569' }]}>ACTIVE TRIP STATUS</Text>
            <View style={[styles.activeTripCard, { backgroundColor: isDark ? '#0c1017' : '#ffffff', borderColor: isDark ? colors.accent : '#f5a623' }]}>
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
                <Text style={[styles.tripDateSub, { color: isDark ? colors.text3 : '#64748b' }]}>
                  {activeTrip.date} {activeTrip.time ? `• ${activeTrip.time}` : ''}
                </Text>
              )}

              {/* Driver & Vehicle Box / Buddy Box */}
              {tripRole === 'driver' && activeTrip.passengersList && activeTrip.passengersList.length > 1 ? (
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ color: isDark ? colors.text2 : '#475569', fontSize: 11, fontWeight: '800', marginBottom: 6, letterSpacing: 0.5 }}>
                    👥 BUDDIES ({activeTrip.passengersList.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {activeTrip.passengersList.map((p, pIdx) => (
                      <View
                        key={p.bookingId || pIdx}
                        style={[
                          styles.driverBox,
                          {
                            width: 250,
                            backgroundColor: isDark ? '#131822' : '#f1f5f9',
                            borderColor: isDark ? '#1e2636' : '#cbd5e1',
                            marginBottom: 0,
                          }
                        ]}
                      >
                        <View style={[styles.driverIconCircle, { backgroundColor: 'rgba(33,150,243,0.15)', borderColor: colors.blue }]}>
                          <Text style={{ fontSize: 16 }}>👤</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.driverTitle, { color: isDark ? colors.text : '#0f172a' }]} numberOfLines={1}>
                            {p.usn ? `🪪 ${p.usn}` : p.name}
                          </Text>
                          <Text style={[styles.driverVehicle, { color: isDark ? colors.text2 : '#475569' }]} numberOfLines={1}>
                            💺 {p.seats} seat(s) • {p.college}
                          </Text>
                          {p.phone ? (
                            <TouchableOpacity
                              onPress={() => Linking.openURL(`tel:${p.phone}`)}
                              style={styles.phoneContactRow}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.phoneContactText}>📞 {p.phone}</Text>
                              <View style={styles.phoneCallBadge}>
                                <Text style={styles.phoneCallBadgeText}>Call</Text>
                              </View>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : (
                <View style={[styles.driverBox, { backgroundColor: isDark ? '#131822' : '#f1f5f9', borderColor: isDark ? '#1e2636' : '#cbd5e1' }]}>
                  <View style={[styles.driverIconCircle, tripRole === 'driver' && { backgroundColor: 'rgba(33,150,243,0.15)', borderColor: colors.blue }]}>
                    <Text style={{ fontSize: 18 }}>{tripRole === 'driver' ? '👤' : '🚗'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.driverTitle, { color: isDark ? colors.text : '#0f172a' }]}>
                      {tripRole === 'driver'
                        ? `Buddy: ${activeTrip.matchedPassengerName && activeTrip.matchedPassengerName.toUpperCase() !== 'STUDENT' ? activeTrip.matchedPassengerName : 'Buddy'}`
                        : (activeTrip.providerId?.name || 'Assigned Driver')}
                    </Text>
                    <Text style={[styles.driverVehicle, { color: isDark ? colors.text2 : '#475569' }]}>
                      {tripRole === 'driver'
                        ? `🎓 ${activeTrip.matchedPassengerCollege || 'Campus Commuter'}`
                        : `${activeTrip.vehicleName || activeTrip.providerId?.kycDocuments?.vehicleName || 'Vehicle'} • ${activeTrip.vehicleNumber || activeTrip.providerId?.kycDocuments?.vehicleNumber || activeTrip.providerId?.vehicleNumber || activeTrip.vehicleType || 'Verified Vehicle'}`}
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
                    {tripRole === 'driver' && (
                      <TouchableOpacity
                        onPress={() => {
                          const loc = activeTrip.pickup;
                          const coords = loc?.coordinates;
                          const lat = Array.isArray(coords) ? coords[1] : (loc?.lat || loc?.latitude);
                          const lng = Array.isArray(coords) ? coords[0] : (loc?.lng || loc?.longitude);
                          const query = (lat && lng) ? `${lat},${lng}` : encodeURIComponent(loc?.name || loc?.address || 'Pickup');
                          const url = Platform.select({
                            ios: `maps:0,0?q=${query}`,
                            android: `geo:0,0?q=${query}(Buddy+Pickup)`,
                            default: `https://www.google.com/maps/search/?api=1&query=${query}`,
                          });
                          Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`));
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: 'rgba(0,229,255,0.12)',
                          borderWidth: 1,
                          borderColor: '#00E5FF',
                          borderRadius: radius.md,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          alignSelf: 'flex-start',
                          marginTop: 6,
                          gap: 6,
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={{ fontSize: 13 }}>🗺️</Text>
                        <Text style={{ color: '#00E5FF', fontSize: 11, fontWeight: '800' }}>
                          Seeker Location Map →
                        </Text>
                      </TouchableOpacity>
                    )}
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
              )}

              {/* Route Points — Full address display */}
              <View style={styles.routeBox}>
                <View style={styles.routePointRow}>
                  <View style={[styles.routeDot, { backgroundColor: colors.green }]} />
                  <Text style={[styles.routeAddressText, { color: isDark ? colors.text : '#0f172a' }]} numberOfLines={2}>
                    {getAddress(activeTrip.pickup)}
                  </Text>
                </View>
                <View style={styles.routeConnectingLine} />
                <View style={styles.routePointRow}>
                  <View style={[styles.routeDot, { backgroundColor: colors.red }]} />
                  <Text style={[styles.routeAddressText, { color: isDark ? colors.text : '#0f172a' }]} numberOfLines={2}>
                    {getAddress(activeTrip.drop)}
                  </Text>
                </View>
              </View>

              {/* Seats & Cost */}
              <View style={[styles.tripMetaRow, { borderTopColor: isDark ? '#1e2636' : '#e2e8f0' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 14 }}>👥</Text>
                  <Text style={[styles.tripMetaText, { color: isDark ? colors.text2 : '#475569' }]}>
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
                        ✓ Buddy verified safety checklist! Ready to depart.
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
                  style={[styles.secondaryBtn, { backgroundColor: isDark ? '#131822' : '#f1f5f9', borderColor: isDark ? '#1e2636' : '#cbd5e1' }]}
                  onPress={() => navigation.navigate(tripRole === 'driver' ? 'ProviderBookings' : 'MyBookings')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.secondaryBtnText, { color: isDark ? colors.text2 : '#475569' }]}>
                    {tripRole === 'driver' ? 'Requests' : 'Bookings'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryBtn, { backgroundColor: isDark ? '#131822' : '#f1f5f9', borderColor: colors.red + '66' }]}
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

      {/* ── HOGO Onboarding Pop-up Carousel (HOGO Template) ── */}
      <Modal
        visible={showOnboardingPopup && !showBetaDisclaimer}
        transparent
        animationType="fade"
        onRequestClose={handleSkipOnboarding}
      >
        <View style={styles.onbOverlay}>
          <View style={[styles.onbPop, { backgroundColor: isDark ? '#101728' : '#ffffff', borderColor: isDark ? '#1c2638' : '#e2e8f0' }]}>
            {/* Pulsing Circular Icon Container (.ic) */}
            <Animated.View style={[styles.onbIconBox, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={{ fontSize: 44 }}>{ONBOARDING_STEPS[popupStep]?.icon || '🛴'}</Text>
            </Animated.View>

            {/* Step Label (.step) */}
            <Text style={styles.onbStepText}>
              STEP {popupStep + 1} OF {ONBOARDING_STEPS.length}
            </Text>

            {/* Tagline Badge */}
            {ONBOARDING_STEPS[popupStep]?.tagline ? (
              <View style={{
                backgroundColor: 'rgba(245, 166, 35, 0.12)',
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 2,
                marginBottom: 6,
                borderWidth: 1,
                borderColor: 'rgba(245, 166, 35, 0.3)',
              }}>
                <Text style={{ color: '#F5A623', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
                  {ONBOARDING_STEPS[popupStep].tagline}
                </Text>
              </View>
            ) : null}

            {/* Title & Description with entry spring transition (.ct) */}
            <Animated.View
              style={{
                opacity: stepContentAnim,
                transform: [
                  {
                    translateY: stepContentAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
                minHeight: 95,
                alignItems: 'center',
                width: '100%',
              }}
            >
              <Text style={[styles.onbTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>{ONBOARDING_STEPS[popupStep]?.title}</Text>
              <Text style={[styles.onbDesc, { color: isDark ? '#8d98ad' : '#475569' }]}>{ONBOARDING_STEPS[popupStep]?.desc}</Text>
            </Animated.View>

            {/* Animated Bike Runner Track (.bw) - moves across to the very end on final step */}
            <View style={styles.onbTrackWrapper}>
              {/* Track Line (.bar) */}
              <View style={[styles.onbTrackBg, { backgroundColor: isDark ? '#1c2638' : '#e2e8f0' }]}>
                <Animated.View
                  style={[
                    styles.onbTrackFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}
                />
              </View>

              {/* Animated Bouncing Bike reaching 88% (end of track) on final step */}
              <Animated.View
                style={[
                  styles.onbBikeRunner,
                  {
                    left: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '88%'],
                      extrapolate: 'clamp',
                    }),
                  },
                ]}
              >
                <Animated.View style={{ transform: [{ translateY: bikeBounceAnim }] }}>
                  <Text style={styles.onbBikeText}>🚲</Text>
                </Animated.View>
              </Animated.View>
            </View>

            {/* Controls Row (.ctl) */}
            <View style={styles.onbControlsRow}>
              {/* Skip button (or Replay on final step) */}
              <TouchableOpacity
                onPress={() => {
                  if (popupStep === ONBOARDING_STEPS.length - 1) {
                    goToStep(0);
                  } else {
                    handleSkipOnboarding();
                  }
                }}
                style={styles.onbSkipBtn}
                activeOpacity={0.7}
              >
                <Text style={[styles.onbSkipText, { color: isDark ? '#8d98ad' : '#64748b' }]}>
                  {popupStep === ONBOARDING_STEPS.length - 1 ? 'Replay ↻' : 'Skip'}
                </Text>
              </TouchableOpacity>

              {/* Right Button Group: Back and Next/Let's Ride */}
              <View style={styles.onbRightBtns}>
                {popupStep > 0 ? (
                  <TouchableOpacity
                    onPress={() => goToStep(popupStep - 1)}
                    style={[styles.onbBackBtn, { backgroundColor: isDark ? '#1a2233' : '#f1f5f9', borderColor: isDark ? '#26334a' : '#cbd5e1' }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.onbBackText, { color: isDark ? '#c8d4e6' : '#334155' }]}>← Back</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  onPress={handleNextOnboarding}
                  style={styles.onbNextPill}
                  activeOpacity={0.85}
                >
                  <Text style={styles.onbNextPillText}>
                    {ONBOARDING_STEPS[popupStep]?.btnLabel || 'Next →'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Floating Guided Tour Bar (On Dashboard when tour is active) ── */}
      {isTourActive && !showBetaDisclaimer && (
        <View style={styles.floatingTourGuide}>
          <View style={styles.floatingGuideHeader}>
            <View style={styles.floatingGuideBadge}>
              <Text style={styles.floatingGuideBadgeText}>OPTION {tourStep} OF 4</Text>
            </View>
            <Text style={styles.floatingGuideTitle} numberOfLines={1}>
              {TOUR_STEPS[tourStep - 1]?.title}
            </Text>
            <TouchableOpacity onPress={finishTour} style={styles.floatingGuideCloseBtn} activeOpacity={0.7}>
              <Text style={styles.floatingGuideCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.floatingGuideDesc} numberOfLines={2}>
            {TOUR_STEPS[tourStep - 1]?.desc}
          </Text>

          <View style={styles.floatingGuideActions}>
            {tourStep > 1 && (
              <TouchableOpacity
                style={styles.floatingGuidePrevBtn}
                onPress={() => navigateToOption(tourStep - 1)}
                activeOpacity={0.8}
              >
                <Text style={styles.floatingGuidePrevText}>‹ Prev</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.floatingGuideNextBtn}
              onPress={() => {
                if (tourStep < 4) {
                  navigateToOption(tourStep + 1);
                } else {
                  finishTour();
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.floatingGuideNextText}>
                {tourStep < 4 ? `Ride to Option ${tourStep + 1} 🛵💨` : 'Finish Tour 🚀'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
  serviceNavWrap: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  serviceNavBike: {
    fontSize: 16,
  },
  tourBikeAnimatedBadge: {
    paddingRight: 6,
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

  /* Guided Onboarding Banner */
  tourBannerCard: {
    backgroundColor: '#0e1622',
    borderRadius: radius.xxl,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#2dd4a0',
    marginBottom: spacing.md,
    shadowColor: '#2dd4a0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  tourBannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tourBannerBadge: {
    backgroundColor: 'rgba(45, 212, 160, 0.15)',
    borderWidth: 1,
    borderColor: '#2dd4a0',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tourBannerBadgeText: {
    color: '#2dd4a0',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tourDismissBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tourDismissBtnText: {
    color: colors.text3,
    fontSize: 11,
    fontWeight: '700',
  },
  tourBannerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    flex: 1,
  },
  tourBannerDesc: {
    color: colors.text2,
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 12,
  },
  tourNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tourNavPrevBtn: {
    backgroundColor: '#161d2b',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
  },
  tourNavPrevText: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '700',
  },
  tourNavNextBtn: {
    flex: 1,
    backgroundColor: '#2dd4a0',
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tourNavNextText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
  },

  /* Card Pointing Row */
  tourPointingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    paddingLeft: 4,
  },
  tourCurrentStopBadge: {
    backgroundColor: 'rgba(45, 212, 160, 0.2)',
    borderWidth: 1,
    borderColor: '#2dd4a0',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tourCurrentStopText: {
    color: '#f5a623',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  serviceCardTourActive: {
    borderColor: '#f5a623',
    borderWidth: 2,
    backgroundColor: '#111827',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },

  /* Sleek chevron arrow next to services when idle */
  serviceChevron: {
    color: '#64748b',
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 6,
  },

  /* WhatsApp Style Community Unread Badge */
  whatsappBadge: {
    backgroundColor: '#25D366',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappBadgeText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
  },

  /* ── Onboarding Pop-up Modal Styles (Image 1 Aesthetic) ── */
  onboardingPopupCard: {
    backgroundColor: '#0d1522',
    borderRadius: 24,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#1e385c',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  onboardingPopupMedia: {
    height: 125,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  onboardingPopupBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#0288d1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  onboardingPopupBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  onboardingPopupLiveBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  onboardingPopupLiveBadgeText: {
    color: '#e0e0e0',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  onboardingPopupBody: {
    padding: 18,
    backgroundColor: '#0b1320',
  },
  onboardingPopupTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  popupRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  popupRatingText: {
    color: '#f5a623',
    fontSize: 12,
    fontWeight: '900',
  },
  popupCostTag: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '800',
  },
  onboardingPopupHighlight: {
    color: '#94a3b8',
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 12,
  },

  /* Pop-up Bike Track Animation */
  popupBikeTrack: {
    height: 34,
    backgroundColor: '#131e30',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#1f3350',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  popupBikeTrackLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: '#23395b',
    top: 16,
  },

  onboardingGoThroughBtn: {
    backgroundColor: '#f5a623',
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 12,
  },
  onboardingGoThroughBtnText: {
    color: '#000000',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  popupNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  popupNavBtn: {
    backgroundColor: '#162235',
    borderWidth: 1,
    borderColor: '#2b3e5e',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 64,
    alignItems: 'center',
  },
  popupNavBtnText: {
    color: '#c9d1d9',
    fontSize: 12,
    fontWeight: '800',
  },
  popupDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  popupDot: {
    height: 6,
    borderRadius: 3,
  },
  popupDotActive: {
    width: 18,
    backgroundColor: '#f5a623',
  },
  popupDotInactive: {
    width: 6,
    backgroundColor: '#22354e',
  },

  /* ── Floating Guided Tour Bar (Docked at bottom of dashboard during tour) ── */
  floatingTourGuide: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#0d1522',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#f5a623',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 99,
  },
  floatingGuideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  floatingGuideBadge: {
    backgroundColor: 'rgba(245, 166, 35, 0.2)',
    borderWidth: 1,
    borderColor: '#f5a623',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
  },
  floatingGuideBadgeText: {
    color: '#f5a623',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  floatingGuideTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  floatingGuideCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1b2434',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  floatingGuideCloseText: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '800',
  },
  floatingGuideDesc: {
    color: '#94a3b8',
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 10,
  },
  floatingGuideActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floatingGuidePrevBtn: {
    backgroundColor: '#162235',
    borderWidth: 1,
    borderColor: '#2b3e5e',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingGuidePrevText: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '800',
  },
  floatingGuideNextBtn: {
    flex: 1,
    backgroundColor: '#f5a623',
    borderRadius: radius.md,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  floatingGuideNextText: {
    color: '#000000',
    fontSize: 12.5,
    fontWeight: '900',
  },
  // Onboarding Carousel Styles (HOGO Template)
  onbOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 4, 8, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  onbPop: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#101728',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#1c2638',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 20,
  },
  onbIconBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(245, 166, 35, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  onbStepText: {
    color: '#f5a623',
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  onbTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  onbDesc: {
    color: '#8d98ad',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  onbTrackWrapper: {
    width: '100%',
    height: 38,
    justifyContent: 'center',
    marginTop: 14,
    position: 'relative',
  },
  onbTrackBg: {
    height: 3,
    backgroundColor: '#1c2638',
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  onbTrackFill: {
    height: '100%',
    backgroundColor: '#f5a623',
  },
  onbBikeRunner: {
    position: 'absolute',
    bottom: 5,
  },
  onbBikeText: {
    fontSize: 22,
    lineHeight: 24,
  },
  onbControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 16,
    paddingTop: 6,
  },
  onbSkipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  onbSkipText: {
    color: '#8d98ad',
    fontSize: 13,
    fontWeight: '700',
  },
  onbRightBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  onbBackBtn: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  onbBackText: {
    color: '#8d98ad',
    fontSize: 13,
    fontWeight: '700',
  },
  onbNextPill: {
    backgroundColor: '#f5a623',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  onbNextPillText: {
    color: '#111111',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  onbHighlightCardBanner: {
    backgroundColor: '#f5a623',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  onbHighlightCardBannerText: {
    color: '#000000',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  serviceCardOnbHighlighted: {
    borderColor: '#f5a623',
    borderWidth: 2,
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
    transform: [{ scale: 1.02 }],
  },
});
