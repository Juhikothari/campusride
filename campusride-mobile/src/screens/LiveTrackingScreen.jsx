import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert as RNAlert, Dimensions,
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
  const [pickupCoords,     setPickupCoords]     = useState(null);
  const [dropCoords,       setDropCoords]       = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeDistance,    setRouteDistance]    = useState('');
  const [routeDuration,    setRouteDuration]    = useState('');
  const [rideInfo,         setRideInfo]         = useState(null);
  const [error,            setError]            = useState('');
  const [loading,          setLoading]          = useState(true);
  const [lookingUp,        setLookingUp]        = useState(!paramRideId);

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

        const pLat = data?.pickup?.coordinates?.[1];
        const pLng = data?.pickup?.coordinates?.[0];
        const dLat = data?.drop?.coordinates?.[1];
        const dLng = data?.drop?.coordinates?.[0];

        if (pLat && pLng) setPickupCoords({ latitude: pLat, longitude: pLng });
        if (dLat && dLng) setDropCoords({ latitude: dLat, longitude: dLng });

        // Calculate route distance & duration
        if (pLat && pLng && dLat && dLng) {
          try {
            const routeData = await api.getOptimalRoute(pLat, pLng, dLat, dLng);
            if (isMounted && routeData) {
              setRouteDistance(routeData.distanceKm ? `${routeData.distanceKm} km` : '');
              setRouteDuration(routeData.durationMin ? `${routeData.durationMin} mins` : '');
              if (routeData.coordinates && routeData.coordinates.length > 0) {
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

  // 3. Elapsed ride timer
  useEffect(() => {
    if (!tracking) return;
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [tracking]);

  // 4. GPS tracking & real-time broadcast
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

  const isDriver = Boolean(
    user?._id === (rideInfo?.providerId?._id || rideInfo?.providerId) ||
    user?.id === (rideInfo?.providerId?._id || rideInfo?.providerId) ||
    (user?.email && rideInfo?.providerId?.email && user.email === rideInfo.providerId.email)
  );

  const [actionLoading, setActionLoading] = useState(false);

  const handleStartRide = async () => {
    setActionLoading(true);
    try {
      await api.startRide(activeRideId);
      setRideInfo(prev => ({ ...prev, status: 'in-progress' }));
      RNAlert.alert('🚀 Trip Started', 'Your ride is now LIVE. Passengers can track your route in real-time.');
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
          {/* Pre-Departure Notice if ride not started yet */}
          {rideInfo?.status !== 'in-progress' && (
            <View style={styles.preDepartureNoticeBox}>
              <Text style={{ fontSize: 22, textAlign: 'center', marginBottom: 4 }}>⏳</Text>
              <Text style={styles.preDepartureTitle}>Ride Not Started Yet</Text>
              <Text style={styles.preDepartureSub}>
                {isDriver
                  ? 'All pre-ride checks verified. Tap "🚀 Start Ride" below when you are ready to begin the commute.'
                  : 'Your booking is accepted and checklist confirmed! Live GPS tracking will activate as soon as the driver taps "Start Ride".'}
              </Text>
            </View>
          )}

          {/* Live GPS Radar & Interactive Map */}
          <View style={styles.radarCard}>
            <View style={styles.radarHeader}>
              <View style={[styles.livePulseDot, rideInfo?.status !== 'in-progress' && { backgroundColor: colors.accent }]} />
              <Text style={styles.radarTitle}>
                {rideInfo?.status === 'in-progress' ? '🛰️ LIVE GPS TRACKING ACTIVE' : '🚗 ROUTE PREVIEW (READY TO START)'}
              </Text>
              {rideInfo?.status === 'in-progress' && (
                <View style={styles.timerBadge}>
                  <Text style={styles.timerText}>{fmt(elapsed)}</Text>
                </View>
              )}
            </View>

            {/* Interactive OpenStreetMap Live Map */}
            <LiveMapView
              pickup={pickupCoords ? { lat: pickupCoords.latitude, lng: pickupCoords.longitude, label: rideInfo?.pickup?.address } : null}
              drop={dropCoords ? { lat: dropCoords.latitude, lng: dropCoords.longitude, label: rideInfo?.drop?.address } : null}
              driverLocation={userLat && userLng ? { lat: userLat, lng: userLng } : null}
              coordinates={routeCoordinates}
              height={260}
              style={{ marginBottom: 12 }}
            />

            {/* Visual Route Path */}
            <View style={styles.routeDiagram}>
              <View style={styles.routeNode}>
                <View style={[styles.nodeIcon, { backgroundColor: colors.green + '22', borderColor: colors.green }]}>
                  <Text style={{ fontSize: 16 }}>🟢</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nodeLabel}>PICKUP POINT</Text>
                  <Text style={styles.nodeAddress} numberOfLines={2}>{rideInfo?.pickup?.address || 'Pickup Location'}</Text>
                </View>
              </View>

              <View style={styles.nodeConnector}>
                <View style={styles.connectorLine} />
                <View style={styles.liveCarBadge}>
                  <Text style={{ fontSize: 14 }}>🚗</Text>
                  <Text style={styles.liveCarText}>In Transit</Text>
                </View>
              </View>

              <View style={styles.routeNode}>
                <View style={[styles.nodeIcon, { backgroundColor: colors.accent + '22', borderColor: colors.accent }]}>
                  <Text style={{ fontSize: 16 }}>🏁</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nodeLabel}>DROP-OFF DESTINATION</Text>
                  <Text style={styles.nodeAddress} numberOfLines={2}>{rideInfo?.drop?.address || 'Destination'}</Text>
                </View>
              </View>
            </View>

            {/* GPS Telemetry Bar */}
            <View style={styles.telemetryBar}>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryLabel}>EST. DISTANCE</Text>
                <Text style={styles.telemetryVal}>{routeDistance || 'Calculating...'}</Text>
              </View>
              <View style={styles.telemetryDivider} />
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryLabel}>EST. TIME</Text>
                <Text style={[styles.telemetryVal, { color: colors.accent }]}>{routeDuration || 'Calculating...'}</Text>
              </View>
              <View style={styles.telemetryDivider} />
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryLabel}>STATUS</Text>
                <Text style={[styles.telemetryVal, { color: colors.green }]}>{rideInfo?.status?.toUpperCase() || 'ACTIVE'}</Text>
              </View>
            </View>
          </View>

          {/* ── DRIVER & VEHICLE DETAILS CARD ── */}
          {rideInfo && (
            <View style={styles.driverCard}>
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
                  <View style={styles.driverGridItem}>
                    <Text style={styles.driverGridLabel}>PHONE</Text>
                    <Text style={[styles.driverGridVal, { color: colors.accent }]}>{rideInfo.providerId.phone}</Text>
                  </View>
                )}
                {rideInfo?.college && (
                  <View style={styles.driverGridItem}>
                    <Text style={styles.driverGridLabel}>CAMPUS</Text>
                    <Text style={styles.driverGridVal}>{rideInfo.college}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <Alert message={error} />

          {/* ── DRIVER TRIP CONTROLS CARD ── */}
          {isDriver && (
            <View style={styles.driverControlCard}>
              <Text style={styles.driverControlTitle}>⚡ DRIVER TRIP CONTROLS</Text>
              
              {rideInfo?.status === 'in-progress' || rideInfo?.status === 'active' ? (
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
              ) : (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.completeRideBtn, { flex: 1, backgroundColor: colors.accent }]}
                    onPress={handleStartRide}
                    disabled={actionLoading}
                  >
                    <Text style={styles.completeRideBtnText}>🚀 Start Ride</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.driverSubBtn, { borderColor: colors.red + '55', paddingHorizontal: 16 }]}
                    onPress={handleCancelRide}
                  >
                    <Text style={[styles.driverSubBtnText, { color: colors.red }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Passenger Cancel Booking Option */}
          {!isDriver && rideInfo?.status !== 'completed' && rideInfo?.status !== 'cancelled' && (
            <TouchableOpacity
              style={styles.passengerCancelBtn}
              onPress={handleCancelBooking}
              disabled={actionLoading}
            >
              <Text style={styles.passengerCancelText}>Cancel My Booking</Text>
            </TouchableOpacity>
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
