import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert as RNAlert, Dimensions, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import TopHeader from '../components/TopHeader';
import LiveMapView from '../components/LiveMapView';
import FloatingChatBot from '../components/FloatingChatBot';
import { Btn, Alert, EmptyState } from '../components/UI';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';
import { subscribeToNotifications } from '../hooks/useSocket';

const { width: SCREEN_W } = Dimensions.get('window');

function fmt(s) {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export default function LiveTrackingScreen({ navigation, route }) {
  const { rideId: paramRideId } = route?.params || {};
  const { user } = useAuth();

  const [activeRideId,     setActiveRideId]     = useState(paramRideId || null);
  const [tracking,         setTracking]         = useState(true);
  const [sosSent,          setSosSent]          = useState(false);
  const [sosLoading,       setSosLoading]       = useState(false);
  const [elapsed,          setElapsed]          = useState(0);
  const [userLat,          setUserLat]          = useState(null);
  const [userLng,          setUserLng]          = useState(null);
  const [driverCoords,     setDriverCoords]     = useState(null);
  const [pickupCoords,     setPickupCoords]     = useState(null);
  const [dropCoords,       setDropCoords]       = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [leg1Coords,       setLeg1Coords]       = useState([]);
  const [leg2Coords,       setLeg2Coords]       = useState([]);
  const [leg1Distance,     setLeg1Distance]     = useState('');
  const [leg1Duration,     setLeg1Duration]     = useState('');
  const [leg2Distance,     setLeg2Distance]     = useState('');
  const [leg2Duration,     setLeg2Duration]     = useState('');
  const [routeDistance,    setRouteDistance]    = useState('');
  const [routeDuration,    setRouteDuration]    = useState('');
  const [rideInfo,         setRideInfo]         = useState(null);
  const [error,            setError]            = useState('');
  const [loading,          setLoading]          = useState(true);
  const [lookingUp,        setLookingUp]        = useState(!paramRideId);
  const [isMapExpanded,    setIsMapExpanded]    = useState(false);

  const timerRef = useRef(null);

  // 1. Auto-discover active ride if no rideId was passed
  useEffect(() => {
    let isMounted = true;
    if (paramRideId) {
      setActiveRideId(paramRideId);
      setLookingUp(false);
      return;
    }

    const findActiveRide = async () => {
      try {
        setLookingUp(true);
        // Check provider active rides
        const myRides = await api.getMyRides().catch(() => []);
        const activeProviderRide = myRides.find(r => r.status === 'in-progress' || r.status === 'active');
        if (activeProviderRide && isMounted) {
          setActiveRideId(activeProviderRide._id);
          setLookingUp(false);
          return;
        }

        // Check seeker active bookings
        const myBookings = await api.getMyBookings().catch(() => []);
        const activeBooking = myBookings.find(b =>
          b.status === 'accepted' && (b.rideId?.status === 'in-progress' || b.rideId?.status === 'active')
        );
        if (activeBooking?.rideId && isMounted) {
          setActiveRideId(activeBooking.rideId._id || activeBooking.rideId);
          setLookingUp(false);
          return;
        }
      } catch (err) {
        console.log('Error looking up active ride:', err);
      } finally {
        if (isMounted) setLookingUp(false);
      }
    };

    findActiveRide();
    return () => { isMounted = false; };
  }, [paramRideId]);

  // 2. Fetch ride info & calculate ETA
  useEffect(() => {
    if (!activeRideId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError('');

    api.getRideById(activeRideId)
      .then(async (data) => {
        if (!isMounted) return;
        setRideInfo(data);

        const parseCoord = (loc) => {
          if (!loc) return null;
          if (loc.lat && loc.lng) return { lat: parseFloat(loc.lat), lng: parseFloat(loc.lng) };
          if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
            const c0 = parseFloat(loc.coordinates[0]);
            const c1 = parseFloat(loc.coordinates[1]);
            // India coordinates: Longitude > 50, Latitude < 40
            if (c0 > 50) return { lat: c1, lng: c0 };
            return { lat: c0, lng: c1 };
          }
          return null;
        };

        const pickupPt = parseCoord(data?.pickup);
        const dropPt   = parseCoord(data?.drop);

        if (pickupPt?.lat && pickupPt?.lng) {
          setPickupCoords({ latitude: pickupPt.lat, longitude: pickupPt.lng });
        }
        if (dropPt?.lat && dropPt?.lng) {
          setDropCoords({ latitude: dropPt.lat, longitude: dropPt.lng });
        }

        // Immediately set direct route line between pickup and drop so map shows route line right away
        if (pickupPt?.lat && pickupPt?.lng && dropPt?.lat && dropPt?.lng) {
          setRouteCoordinates([
            { latitude: pickupPt.lat, longitude: pickupPt.lng },
            { latitude: (pickupPt.lat + dropPt.lat) / 2, longitude: (pickupPt.lng + dropPt.lng) / 2 },
            { latitude: dropPt.lat, longitude: dropPt.lng }
          ]);

          try {
            const routeData = await api.getOptimalRoute(pickupPt.lat, pickupPt.lng, dropPt.lat, dropPt.lng);
            if (isMounted && routeData) {
              setRouteDistance(routeData.distanceKm ? `${routeData.distanceKm} km` : '');
              setRouteDuration(routeData.durationMin ? `${routeData.durationMin} mins` : '');
              if (Array.isArray(routeData.coordinates) && routeData.coordinates.length > 0) {
                setRouteCoordinates(routeData.coordinates);
              }
            }
          } catch (e) {
            console.log('Route calc note:', e.message);
          }
        }
      })
      .catch((e) => {
        if (isMounted) setError(e.message || 'Failed to load ride details');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [activeRideId]);

  // Real-time synchronization for arrival, checklist, and ride started
  useEffect(() => {
    const unsub = subscribeToNotifications((event, data) => {
      if (event === 'riderArrivedAtSeeker' || event === 'rider-arrived') {
        if (!data?.rideId || data.rideId === activeRideId) {
          setRideInfo(prev => prev ? ({ ...prev, riderReachedSeeker: true }) : prev);
        }
      } else if (event === 'checklistCompleted') {
        if (!data?.rideId || data.rideId === activeRideId) {
          setRideInfo(prev => prev ? ({ ...prev, seekerChecklistCompleted: true }) : prev);
        }
      } else if (event === 'rideStarted') {
        if (!data?.rideId || data.rideId === activeRideId) {
          setRideInfo(prev => prev ? ({ ...prev, status: 'in-progress' }) : prev);
        }
      }
    });
    return () => unsub();
  }, [activeRideId]);

  // Screen focus listener to refresh ride info
  useEffect(() => {
    if (!activeRideId) return;
    const unsubFocus = navigation?.addListener ? navigation.addListener('focus', () => {
      api.getRideById(activeRideId).then(data => {
        if (data) setRideInfo(data);
      }).catch(() => {});
    }) : () => {};
    return () => unsubFocus();
  }, [activeRideId, navigation]);

  // 3. Elapsed ride timer
  useEffect(() => {
    if (!tracking) return;
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [tracking]);

  const isDriver = Boolean(
    user?._id === (rideInfo?.providerId?._id || rideInfo?.providerId) ||
    user?.id === (rideInfo?.providerId?._id || rideInfo?.providerId) ||
    (user?.email && rideInfo?.providerId?.email && user.email === rideInfo.providerId.email)
  );

  const effectiveDriverCoords = isDriver
    ? (userLat && userLng ? { latitude: userLat, longitude: userLng } : driverCoords)
    : (driverCoords || (userLat && userLng ? { latitude: userLat, longitude: userLng } : null));

  // 4. GPS tracking & real-time broadcast (driver broadcasts, seeker can also update own)
  useEffect(() => {
    if (!tracking || !activeRideId) return;
    let sub = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: 8000 },
          (loc) => {
            const { latitude, longitude } = loc.coords;
            setUserLat(latitude);
            setUserLng(longitude);
            if (activeRideId) {
              api.updateLocation({ rideId: activeRideId, latitude, longitude }).catch(() => {});
            }
          }
        );
      } catch (e) {
        console.log('Location watch error:', e);
      }
    })();
    return () => { sub?.remove?.(); };
  }, [tracking, activeRideId]);

  // 5. Poll driver's live GPS tracking from server (for seekers)
  useEffect(() => {
    if (!activeRideId || !tracking) return;
    let isMounted = true;
    const fetchDriverPosition = async () => {
      try {
        const trk = await api.getTracking(activeRideId);
        if (!isMounted) return;
        if (trk?.currentLocation?.coordinates && Array.isArray(trk.currentLocation.coordinates)) {
          const [c0, c1] = trk.currentLocation.coordinates;
          const lat = c0 > 50 ? c1 : c0;
          const lng = c0 > 50 ? c0 : c1;
          if (lat && lng) {
            setDriverCoords({ latitude: parseFloat(lat), longitude: parseFloat(lng) });
          }
        }
      } catch (e) {}
    };

    fetchDriverPosition();
    const pollInterval = setInterval(fetchDriverPosition, 5000);
    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [activeRideId, tracking]);

  // 6. Calculate 2-Leg Route:
  // Leg 1: Provider -> Seeker Pickup Point
  useEffect(() => {
    if (!effectiveDriverCoords?.latitude || !effectiveDriverCoords?.longitude || !pickupCoords?.latitude || !pickupCoords?.longitude) return;
    let isMounted = true;
    api.getOptimalRoute(
      effectiveDriverCoords.latitude, effectiveDriverCoords.longitude,
      pickupCoords.latitude, pickupCoords.longitude
    ).then(data => {
      if (!isMounted || !data) return;
      setLeg1Distance(data.distanceKm ? `${data.distanceKm} km` : '');
      setLeg1Duration(data.durationMin ? `${data.durationMin} mins` : '');
      if (Array.isArray(data.coordinates) && data.coordinates.length > 0) {
        setLeg1Coords(data.coordinates);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [effectiveDriverCoords?.latitude, effectiveDriverCoords?.longitude, pickupCoords?.latitude, pickupCoords?.longitude]);

  // Leg 2: Seeker Pickup Point -> Drop Destination
  useEffect(() => {
    if (!pickupCoords?.latitude || !pickupCoords?.longitude || !dropCoords?.latitude || !dropCoords?.longitude) return;
    let isMounted = true;
    api.getOptimalRoute(
      pickupCoords.latitude, pickupCoords.longitude,
      dropCoords.latitude, dropCoords.longitude
    ).then(data => {
      if (!isMounted || !data) return;
      setLeg2Distance(data.distanceKm ? `${data.distanceKm} km` : '');
      setLeg2Duration(data.durationMin ? `${data.durationMin} mins` : '');
      setRouteDistance(data.distanceKm ? `${data.distanceKm} km` : '');
      setRouteDuration(data.durationMin ? `${data.durationMin} mins` : '');
      if (Array.isArray(data.coordinates) && data.coordinates.length > 0) {
        setLeg2Coords(data.coordinates);
        setRouteCoordinates(data.coordinates);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [pickupCoords?.latitude, pickupCoords?.longitude, dropCoords?.latitude, dropCoords?.longitude]);

  const triggerSOS = useCallback(() => {
    RNAlert.alert(
      '🆘 Send SOS Alert',
      'This will instantly alert campus security, emergency contacts, and support with your exact live location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS', style: 'destructive',
          onPress: async () => {
            setSosLoading(true);
            try {
              await api.triggerSOS({
                rideId: activeRideId,
                lat: userLat,
                lng: userLng,
                message: 'Emergency SOS triggered from HOGO live tracking',
              });
              setSosSent(true);
            } catch (e) {
              RNAlert.alert('Error', e.message || 'SOS failed. Please call 112 immediately.');
            } finally {
              setSosLoading(false);
            }
          },
        },
      ]
    );
  }, [activeRideId, userLat, userLng]);

  const [actionLoading, setActionLoading] = useState(false);

  const handleArrivedAtSeeker = async () => {
    setActionLoading(true);
    try {
      await api.markArrivedAtSeeker(activeRideId);
      setRideInfo(prev => ({ ...prev, riderReachedSeeker: true }));
      RNAlert.alert(
        '📍 Arrived at Seeker',
        'Arrival confirmed! The passenger can now complete their safety checklist before departure.'
      );
    } catch (err) {
      RNAlert.alert('Error', err.message || 'Failed to update arrival status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartRide = async () => {
    if (!rideInfo?.riderReachedSeeker) {
      RNAlert.alert(
        '📍 Confirm Arrival First',
        'Please confirm you have arrived at the passenger pickup spot before starting the ride.'
      );
      return;
    }
    if (!rideInfo?.seekerChecklistCompleted) {
      RNAlert.alert(
        '⏳ Passenger Checklist Incomplete',
        'For campus safety, the passenger must complete their pre-ride safety checklist before departure. Once verified, you will be able to start the ride.'
      );
      return;
    }
    setActionLoading(true);
    try {
      await api.startRide(activeRideId);
      setRideInfo(prev => ({ ...prev, status: 'in-progress' }));
      RNAlert.alert('🚀 Trip Started', 'Your ride is now LIVE. Route to destination is now displayed on the map.');
    } catch (err) {
      RNAlert.alert('Error', err.message || 'Failed to start ride');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteRide = () => {
    RNAlert.alert(
      '🏁 Finish & Complete Ride',
      'Are you sure you want to end this ride? All passengers will be marked as reached destination.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete Ride',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.completeRide(activeRideId);
              setRideInfo(prev => ({ ...prev, status: 'completed' }));
              RNAlert.alert('🎉 Ride Completed', 'The trip has been marked as finished successfully!', [
                { text: 'Back to Home', onPress: () => navigation.navigate('Home') }
              ]);
            } catch (err) {
              RNAlert.alert('Error', err.message || 'Failed to complete ride');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCancelRide = () => {
    RNAlert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride? All passenger bookings will be cancelled.',
      [
        { text: 'Keep Ride', style: 'cancel' },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.cancelRide(activeRideId, 'Cancelled by provider');
              RNAlert.alert('Ride Cancelled', 'The ride has been cancelled.', [
                { text: 'OK', onPress: () => navigation.navigate('Home') }
              ]);
            } catch (err) {
              RNAlert.alert('Error', err.message || 'Failed to cancel ride');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCancelBooking = async () => {
    RNAlert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel your seat in this ride?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const myBookings = await api.getMyBookings().catch(() => []);
              const currentBooking = myBookings.find(b => (b.rideId?._id || b.rideId) === activeRideId && b.status !== 'cancelled');
              if (currentBooking) {
                await api.cancelBooking(currentBooking._id);
              }
              RNAlert.alert('Booking Cancelled', 'Your booking has been cancelled.', [
                { text: 'OK', onPress: () => navigation.navigate('Home') }
              ]);
            } catch (err) {
              RNAlert.alert('Error', err.message || 'Failed to cancel booking');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const isTripToDestination = rideInfo?.status === 'in-progress' || rideInfo?.status === 'completed';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopHeader title="HOGO Track" subtitle="Live Route & Navigation" />

      {lookingUp || loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Checking active ride & route...</Text>
        </View>
      ) : !activeRideId || !rideInfo ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="📍"
            title="No Active Ride to Track"
            subtitle="When you start or book a ride, your live route, GPS location, and ETA will show here in real time."
            action={() => navigation.navigate('SearchMatch')}
            actionLabel="Find a Ride →"
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Interactive Route Map with Eye-Catching Points — Always Shown in Track Ride */}
          <View style={styles.radarCard}>
            <View style={styles.radarHeader}>
              <View style={[styles.livePulseDot, !isTripToDestination && { backgroundColor: colors.accent }]} />
              <Text style={styles.radarTitle}>
                {isTripToDestination
                  ? '🛰️ LIVE GPS TRACKING ACTIVE'
                  : (rideInfo?.riderReachedSeeker ? '🟢 AT PASSENGER PICKUP' : '🗺️ EN ROUTE TO SEEKER PICKUP')}
              </Text>
              <View style={[styles.timerBadge, !isTripToDestination && { backgroundColor: 'rgba(245,166,35,0.15)', borderColor: colors.accent }]}>
                <Text style={[styles.timerText, !isTripToDestination && { color: colors.accent }]}>
                  {isTripToDestination ? fmt(elapsed) : (rideInfo?.riderReachedSeeker ? 'CHECKLIST' : 'LEG 1')}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 4 }}>
              <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
                {isTripToDestination
                  ? (isMapExpanded ? '🗺️ DESTINATION ROUTE (FULL)' : '🗺️ ROUTE TO FINAL DESTINATION')
                  : (isMapExpanded ? '🗺️ ROUTE TO SEEKER (FULL)' : '🗺️ ROUTE TO PASSENGER PICKUP')}
              </Text>
              <TouchableOpacity
                onPress={() => setIsMapExpanded(e => !e)}
                style={styles.expandMapBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.expandMapBtnText}>
                  {isMapExpanded ? '↙ Standard View' : '⛶ Enlarge Map'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Interactive OpenStreetMap Live Map with Eye-Catching Markers */}
            {/* FIRST rider gets route to seeker location; AFTER reaching seeker and checklist, gets route to destination */}
            <LiveMapView
              pickup={pickupCoords ? { lat: pickupCoords.latitude, lng: pickupCoords.longitude, label: rideInfo?.pickup?.address } : null}
              drop={isTripToDestination && dropCoords ? { lat: dropCoords.latitude, lng: dropCoords.longitude, label: rideInfo?.drop?.address } : null}
              driverLocation={effectiveDriverCoords ? { lat: effectiveDriverCoords.latitude, lng: effectiveDriverCoords.longitude } : null}
              coordinates={isTripToDestination ? routeCoordinates : []}
              leg1Coordinates={!isTripToDestination ? leg1Coords : []}
              leg2Coordinates={isTripToDestination ? leg2Coords : []}
              height={isMapExpanded ? 460 : 320}
              style={{ marginBottom: 12 }}
            />

            {/* Visual Route Path: Provider -> Seeker Pickup -> Drop Destination */}
            <View style={styles.routeDiagram}>
              {/* Node 1: Provider Position */}
              <View style={styles.routeNode}>
                <View style={[styles.nodeIcon, { backgroundColor: '#00E5FF22', borderColor: '#00E5FF' }]}>
                  <Text style={{ fontSize: 16 }}>🚗</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nodeLabel, { color: '#00E5FF' }]}>1. PROVIDER LOCATION</Text>
                  <Text style={styles.nodeAddress} numberOfLines={1}>
                    {isDriver ? 'Your Live Location' : `${rideInfo?.providerId?.name || rideInfo?.providerName || 'Provider'} (${isTripToDestination ? 'Trip in Progress' : 'En Route to Pickup'})`}
                  </Text>
                </View>
              </View>

              {/* Leg 1 connector: Provider to Pickup */}
              <View style={styles.nodeConnector}>
                <View style={[styles.connectorLine, { borderColor: '#00E5FF', borderStyle: isTripToDestination ? 'solid' : 'dashed' }]} />
                <View style={[styles.liveCarBadge, { borderColor: '#00E5FF' }]}>
                  <Text style={{ fontSize: 11 }}>{rideInfo?.riderReachedSeeker ? '✅' : '➡️'}</Text>
                  <Text style={[styles.liveCarText, { color: '#00E5FF' }]}>
                    {isTripToDestination
                      ? 'Reached Seeker ✅'
                      : (rideInfo?.riderReachedSeeker ? 'Arrived at Pickup 🟢' : (leg1Duration ? `To Seeker (${leg1Duration})` : 'Heading to Pickup'))}
                  </Text>
                </View>
              </View>

              {/* Node 2: Seeker Pickup Point */}
              <View style={styles.routeNode}>
                <View style={[styles.nodeIcon, { backgroundColor: colors.green + '22', borderColor: colors.green }]}>
                  <Text style={{ fontSize: 16 }}>🟢</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nodeLabel}>2. SEEKER PICKUP POINT</Text>
                  <Text style={styles.nodeAddress} numberOfLines={2}>{rideInfo?.pickup?.address || 'Pickup Location'}</Text>
                </View>
              </View>

              {/* Leg 2 connector: Pickup to Destination */}
              <View style={styles.nodeConnector}>
                <View style={[styles.connectorLine, !isTripToDestination && { borderColor: 'rgba(255,255,255,0.15)', borderStyle: 'dotted' }]} />
                <View style={[styles.liveCarBadge, !isTripToDestination && { borderColor: 'rgba(255,255,255,0.2)' }]}>
                  <Text style={{ fontSize: 11 }}>{isTripToDestination ? '🏁' : '🔒'}</Text>
                  <Text style={[styles.liveCarText, !isTripToDestination && { color: colors.text3 }]}>
                    {isTripToDestination
                      ? (leg2Duration ? `To Destination (${leg2Duration})` : 'In Transit')
                      : 'Route unlocks after departure'}
                  </Text>
                </View>
              </View>

              {/* Node 3: Drop-off Destination */}
              <View style={[styles.routeNode, !isTripToDestination && { opacity: 0.65 }]}>
                <View style={[styles.nodeIcon, { backgroundColor: colors.accent + '22', borderColor: isTripToDestination ? colors.accent : colors.text3 }]}>
                  <Text style={{ fontSize: 16 }}>🏁</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nodeLabel, !isTripToDestination && { color: colors.text3 }]}>3. DROP-OFF DESTINATION</Text>
                  <Text style={styles.nodeAddress} numberOfLines={2}>{rideInfo?.drop?.address || 'Destination'}</Text>
                </View>
              </View>
            </View>

            {/* GPS Telemetry Bar */}
            <View style={styles.telemetryBar}>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryLabel}>TO PICKUP</Text>
                <Text style={[styles.telemetryVal, { color: '#00E5FF' }]}>
                  {rideInfo?.riderReachedSeeker ? 'Reached 🟢' : (leg1Duration || leg1Distance || 'Approaching')}
                </Text>
              </View>
              <View style={styles.telemetryDivider} />
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryLabel}>TO DESTINATION</Text>
                <Text style={[styles.telemetryVal, { color: colors.accent }]}>
                  {isTripToDestination ? (leg2Duration || leg2Distance || routeDuration || 'En Route') : 'Locked until start'}
                </Text>
              </View>
              <View style={styles.telemetryDivider} />
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryLabel}>STATUS</Text>
                <Text style={[styles.telemetryVal, { color: isTripToDestination ? colors.green : colors.accent }]}>
                  {isTripToDestination ? 'TRIP LIVE' : (rideInfo?.riderReachedSeeker ? 'AT PICKUP' : 'APPROACHING')}
                </Text>
              </View>
            </View>
          </View>

          {/* Pre-Departure Info Card if ride not started yet */}
          {!isTripToDestination && (
            <View style={styles.preDepartureNoticeBox}>
              <Text style={{ fontSize: 24, textAlign: 'center', marginBottom: 6 }}>
                {rideInfo?.riderReachedSeeker ? '📍' : '🚗'}
              </Text>
              <Text style={styles.preDepartureTitle}>
                {rideInfo?.riderReachedSeeker ? 'Rider at Pickup Location' : 'Rider En Route to Pickup'}
              </Text>
              <Text style={styles.preDepartureSub}>
                {isDriver
                  ? (!rideInfo?.riderReachedSeeker
                      ? 'Follow the map above to passenger pickup spot. Once you arrive, tap "I Have Reached Seeker Location" below.'
                      : (rideInfo?.seekerChecklistCompleted
                          ? 'Passenger safety checklist verified! Tap "🚀 Start Ride" below to begin destination navigation.'
                          : 'Waiting for passenger to complete their pre-ride safety checklist before departure.'))
                  : (!rideInfo?.riderReachedSeeker
                      ? `Rider is on the way to your pickup point (${rideInfo?.pickup?.address || 'Pickup'}). You will complete the safety checklist upon arrival.`
                      : (rideInfo?.seekerChecklistCompleted
                          ? 'Safety checklist verified! Driver is ready to begin your trip.'
                          : 'Your rider has arrived! Please complete your safety checklist below to start your ride.'))}
              </Text>
            </View>
          )}

          {/* ── DETAILS CARD: SHOW PASSENGER DETAILS TO DRIVER, DRIVER DETAILS TO SEEKER ── */}
          {rideInfo && (
            <View style={styles.driverCard}>
              {isDriver ? (
                <>
                  <Text style={styles.driverSectionTitle}>👥 ASSIGNED PASSENGER DETAILS</Text>
                  {rideInfo.passengers && rideInfo.passengers.length > 0 ? (
                    rideInfo.passengers.map((p, pIdx) => (
                      <View key={p.bookingId || pIdx} style={{ marginBottom: pIdx < rideInfo.passengers.length - 1 ? 12 : 0 }}>
                        <View style={styles.driverRow}>
                          <View style={[styles.driverAvatar, { borderColor: colors.green }]}>
                            <Text style={[styles.driverAvatarText, { color: colors.green }]}>
                              {p.seeker?.name?.charAt(0) || 'S'}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.driverName}>{p.seeker?.name || 'Passenger'}</Text>
                            <Text style={styles.driverVehicleName}>
                              💺 {p.seats || 1} Seat(s) Booked • {p.status?.toUpperCase() || 'CONFIRMED'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.driverDetailsGrid}>
                          {p.seeker?.usn && (
                            <View style={styles.driverGridItem}>
                              <Text style={styles.driverGridLabel}>USN</Text>
                              <Text style={styles.driverGridVal}>{p.seeker.usn}</Text>
                            </View>
                          )}
                          {p.seeker?.phone && (
                            <TouchableOpacity
                              style={styles.driverGridItem}
                              onPress={() => Linking.openURL(`tel:${p.seeker.phone}`)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.driverGridLabel}>PHONE (TAP TO CALL)</Text>
                              <Text style={[styles.driverGridVal, { color: colors.accent, textDecorationLine: 'underline' }]}>
                                📞 {p.seeker.phone}
                              </Text>
                            </TouchableOpacity>
                          )}
                          {p.seeker?.college && (
                            <View style={styles.driverGridItem}>
                              <Text style={styles.driverGridLabel}>CAMPUS</Text>
                              <Text style={styles.driverGridVal}>{p.seeker.college}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={{ paddingVertical: 8 }}>
                      <Text style={{ color: colors.text2, fontSize: 13 }}>
                        Passenger confirmed for this ride.
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.driverSectionTitle}>🚗 ASSIGNED VEHICLE & RIDER</Text>
                  <View style={styles.driverRow}>
                    <View style={styles.driverAvatar}>
                      <Text style={styles.driverAvatarText}>{rideInfo?.providerId?.name?.charAt(0) || 'P'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.driverName}>{rideInfo?.providerId?.name || 'Campus Provider'}</Text>
                      <Text style={styles.driverVehicleName}>
                        🚘 {rideInfo?.vehicleName || rideInfo?.providerId?.kycDocuments?.vehicleName || 'Vehicle'} • {(rideInfo?.vehicleType || 'Car').toUpperCase()}
                      </Text>
                    </View>
                    {(rideInfo?.vehicleNumber || rideInfo?.providerId?.kycDocuments?.vehicleNumber) && (
                      <View style={styles.plateContainer}>
                        <Text style={styles.plateText}>
                          {rideInfo?.vehicleNumber || rideInfo?.providerId?.kycDocuments?.vehicleNumber}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.driverDetailsGrid}>
                    {rideInfo?.providerId?.usn && (
                      <View style={styles.driverGridItem}>
                        <Text style={styles.driverGridLabel}>USN</Text>
                        <Text style={styles.driverGridVal}>{rideInfo.providerId.usn}</Text>
                      </View>
                    )}
                    {rideInfo?.providerId?.phone && (
                      <TouchableOpacity
                        style={styles.driverGridItem}
                        onPress={() => Linking.openURL(`tel:${rideInfo.providerId.phone}`)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.driverGridLabel}>PHONE (TAP TO CALL)</Text>
                        <Text style={[styles.driverGridVal, { color: colors.accent, textDecorationLine: 'underline' }]}>
                          📞 {rideInfo.providerId.phone}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {rideInfo?.college && (
                      <View style={styles.driverGridItem}>
                        <Text style={styles.driverGridLabel}>CAMPUS</Text>
                        <Text style={styles.driverGridVal}>{rideInfo.college}</Text>
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>
          )}

          <Alert message={error} />

          {/* ── DRIVER TRIP CONTROLS CARD ── */}
          {isDriver && (
            <View style={styles.driverControlCard}>
              <Text style={styles.driverControlTitle}>⚡ DRIVER TRIP CONTROLS</Text>
              
              {rideInfo?.status === 'in-progress' ? (
                <>
                  <TouchableOpacity
                    style={styles.completeRideBtn}
                    onPress={handleCompleteRide}
                    disabled={actionLoading}
                    activeOpacity={0.85}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color="#000" size="small" />
                    ) : (
                      <Text style={styles.completeRideBtnText}>🏁 Complete & Finish Ride</Text>
                    )}
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <TouchableOpacity
                      style={styles.driverSubBtn}
                      onPress={() => navigation.navigate('ProviderBookings')}
                    >
                      <Text style={styles.driverSubBtnText}>👥 Passengers</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.driverSubBtn, { borderColor: colors.red + '55' }]}
                      onPress={handleCancelRide}
                    >
                      <Text style={[styles.driverSubBtnText, { color: colors.red }]}>Cancel Ride</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : rideInfo?.status === 'active' ? (
                <View style={{ gap: 10 }}>
                  {!rideInfo?.riderReachedSeeker ? (
                    <>
                      <View style={{ backgroundColor: 'rgba(0,229,255,0.12)', borderWidth: 1, borderColor: '#00E5FF', borderRadius: radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ fontSize: 24 }}>📍</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#00E5FF', fontSize: 13, fontWeight: '800' }}>Navigating to Seeker</Text>
                          <Text style={{ color: colors.text2, fontSize: 11, marginTop: 2, lineHeight: 15 }}>
                            Map is guiding you to {rideInfo?.pickup?.address || 'passenger pickup'}. Tap below when you reach the passenger.
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[styles.completeRideBtn, { backgroundColor: '#00E5FF', borderColor: '#00E5FF' }]}
                        onPress={handleArrivedAtSeeker}
                        disabled={actionLoading}
                        activeOpacity={0.85}
                      >
                        {actionLoading ? (
                          <ActivityIndicator color="#000" size="small" />
                        ) : (
                          <Text style={[styles.completeRideBtnText, { color: '#000' }]}>
                            📍 I Have Reached Seeker Location
                          </Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.driverSubBtn, { borderColor: colors.red + '55', paddingVertical: 12 }]}
                        onPress={handleCancelRide}
                      >
                        <Text style={[styles.driverSubBtnText, { color: colors.red, textAlign: 'center' }]}>✕ Cancel Ride</Text>
                      </TouchableOpacity>
                    </>
                  ) : !rideInfo?.seekerChecklistCompleted ? (
                    <>
                      <View style={{ backgroundColor: 'rgba(255,160,0,0.12)', borderWidth: 1, borderColor: colors.accent, borderRadius: radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ fontSize: 22 }}>⏳</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '800' }}>Waiting for Passenger Checklist</Text>
                          <Text style={{ color: colors.text2, fontSize: 11, marginTop: 2, lineHeight: 15 }}>
                            You have arrived at pickup! Passenger must verify safety checklist before ride departure.
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[styles.driverSubBtn, { borderColor: colors.red + '55', paddingVertical: 12 }]}
                        onPress={handleCancelRide}
                      >
                        <Text style={[styles.driverSubBtnText, { color: colors.red, textAlign: 'center' }]}>✕ Cancel Ride</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <View style={{ backgroundColor: 'rgba(0,230,118,0.12)', borderWidth: 1, borderColor: colors.green, borderRadius: radius.md, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 16 }}>✅</Text>
                        <Text style={{ color: colors.green, fontSize: 12, fontWeight: '700', flex: 1 }}>
                          Passenger checklist verified! Tap below to start ride and show route to destination.
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity
                          style={[
                            styles.completeRideBtn,
                            {
                              flex: 1,
                              backgroundColor: colors.accent,
                              borderWidth: 1,
                              borderColor: colors.accent,
                            }
                          ]}
                          onPress={handleStartRide}
                          disabled={actionLoading}
                        >
                          <Text style={[styles.completeRideBtnText, { color: '#000' }]}>
                            🚀 Start Ride to Destination
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.driverSubBtn, { borderColor: colors.red + '55', paddingHorizontal: 16 }]}
                          onPress={handleCancelRide}
                        >
                          <Text style={[styles.driverSubBtnText, { color: colors.red }]}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              ) : null}
            </View>
          )}

          {/* Passenger Checklist & Cancel Booking Option */}
          {!isDriver && (rideInfo?.status === 'active' || rideInfo?.status === 'in-progress') && (
            <View style={{ gap: 10, marginBottom: 12 }}>
              {rideInfo?.status === 'active' && (
                !rideInfo?.riderReachedSeeker ? (
                  <View style={{ backgroundColor: 'rgba(0,229,255,0.12)', borderWidth: 1, borderColor: '#00E5FF', borderRadius: radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 20 }}>🚗</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#00E5FF', fontSize: 13, fontWeight: '800' }}>Rider Approaching Pickup</Text>
                      <Text style={{ color: colors.text2, fontSize: 11, marginTop: 2, lineHeight: 15 }}>
                        Your rider is on their way. Safety checklist will unlock as soon as your rider arrives at your pickup spot.
                      </Text>
                    </View>
                  </View>
                ) : !rideInfo?.seekerChecklistCompleted ? (
                  <>
                    <View style={{ backgroundColor: 'rgba(0,230,118,0.12)', borderWidth: 1, borderColor: colors.green, borderRadius: radius.md, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 18 }}>📍</Text>
                      <Text style={{ color: colors.green, fontSize: 12, fontWeight: '700', flex: 1 }}>
                        Your rider has arrived! Please complete your safety checklist now.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.completeRideBtn, { backgroundColor: colors.accent }]}
                      onPress={() => navigation.navigate('PreRideChecklist', { rideId: activeRideId })}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.completeRideBtnText}>🛡️ Complete Safety Checklist Now →</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ backgroundColor: 'rgba(0,230,118,0.12)', borderWidth: 1, borderColor: colors.green, borderRadius: radius.md, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 16 }}>✅</Text>
                    <Text style={{ color: colors.green, fontSize: 12, fontWeight: '700', flex: 1 }}>
                      Safety checklist completed. Waiting for provider to start ride to destination.
                    </Text>
                  </View>
                )
              )}

              <TouchableOpacity
                style={styles.passengerCancelBtn}
                onPress={handleCancelBooking}
                disabled={actionLoading}
              >
                <Text style={styles.passengerCancelText}>Cancel My Booking</Text>
              </TouchableOpacity>
            </View>
          )}

          {sosSent && (
            <View style={styles.sosSentBanner}>
              <Text style={styles.sosSentText}>🆘 SOS Alert broadcasted! Help is on the way.</Text>
            </View>
          )}

          {/* Emergency & Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.sosBtn, sosSent && { opacity: 0.5 }]}
              onPress={triggerSOS}
              disabled={sosSent || sosLoading}
              activeOpacity={0.8}
            >
              {sosLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sosBtnText}>🆘 SOS EMERGENCY</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.detailsBtn}
              onPress={() => navigation.navigate('RideDetail', { rideId: activeRideId })}
              activeOpacity={0.8}
            >
              <Text style={styles.detailsBtnText}>Ride Details →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Floating HOGO AI Assistant Button */}
      <FloatingChatBot />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  loadingText: { color: colors.text2, marginTop: 14, fontSize: 14, fontWeight: '600' },
  scroll: { padding: spacing.md, paddingBottom: 40 },

  preDepartureNoticeBox: {
    backgroundColor: '#121722',
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: spacing.md,
  },
  preDepartureTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  preDepartureSub: {
    color: colors.text2,
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
  },

  radarCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  radarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  livePulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.green,
    marginRight: 8,
  },
  radarTitle: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    flex: 1,
  },
  timerBadge: {
    backgroundColor: colors.surface2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  timerText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  expandMapBtn: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  expandMapBtnText: {
    color: colors.accent,
    fontSize: 10.5,
    fontWeight: '800',
  },

  routeDiagram: {
    paddingVertical: 8,
  },
  routeNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nodeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeLabel: {
    color: colors.text3,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  nodeAddress: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  nodeConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    paddingLeft: 17,
  },
  connectorLine: {
    width: 2,
    height: 32,
    backgroundColor: colors.border,
  },
  liveCarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginLeft: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.accent + '55',
  },
  liveCarText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },

  telemetryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  telemetryItem: {
    alignItems: 'center',
    flex: 1,
  },
  telemetryLabel: {
    color: colors.text3,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  telemetryVal: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  telemetryDivider: {
    width: 1,
    backgroundColor: colors.border,
  },

  coordCard: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  coordTitle: {
    color: colors.text2,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  coordText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },

  sosSentBanner: {
    backgroundColor: 'rgba(224,85,85,0.15)',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.red + '55',
  },
  sosSentText: {
    color: colors.red,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  sosBtn: {
    flex: 1,
    backgroundColor: colors.red,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  detailsBtn: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  driverCard: {
    backgroundColor: 'rgba(245,166,35,0.07)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.25)',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  driverSectionTitle: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  driverAvatarText: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  driverName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  driverVehicleName: { color: colors.accent, fontSize: 12, fontWeight: '700', marginTop: 2 },
  plateContainer: {
    backgroundColor: '#000',
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  plateText: { color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  driverDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 10,
  },
  driverGridItem: {
    minWidth: 100,
  },
  driverGridLabel: {
    color: colors.text3,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  driverGridVal: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  driverControlCard: {
    backgroundColor: '#0c1017',
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.xl,
    padding: 16,
    marginBottom: 14,
  },
  driverControlTitle: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  completeRideBtn: {
    backgroundColor: colors.green,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeRideBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
  },
  driverSubBtn: {
    flex: 1,
    backgroundColor: '#131822',
    borderWidth: 1,
    borderColor: '#1e2636',
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverSubBtnText: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '700',
  },
  passengerCancelBtn: {
    backgroundColor: '#141824',
    borderWidth: 1,
    borderColor: colors.red + '55',
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  passengerCancelText: {
    color: colors.red,
    fontSize: 13,
    fontWeight: '700',
  },
});
