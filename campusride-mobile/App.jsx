import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { addNotificationListener, initNotificationService } from './src/services/notificationService';

export const navigationRef = createNavigationContainerRef();

export function navigateFromNotification(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  } else {
    setTimeout(() => {
      if (navigationRef.isReady()) navigationRef.navigate(name, params);
    }, 600);
  }
}

export function handleNotificationResponse(response) {
  try {
    const notifId = response?.notification?.request?.identifier || String(response?.notification?.date || Date.now());
    const data = response?.notification?.request?.content?.data || response?.data;
    if (!data) return;

    // Mark as handled so it won't re-trigger on subsequent cold starts
    AsyncStorage.setItem('@last_handled_notif_response_id', notifId).catch(() => {});

    if (data.rideId) {
      if (data.type === 'new-booking') {
        navigateFromNotification('ProviderBookings');
      } else if (data.type === 'rider-reached' || data.type === 'RIDER_ARRIVED') {
        navigateFromNotification('LiveTracking', { rideId: data.rideId });
      } else {
        navigateFromNotification('LiveTracking', { rideId: data.rideId });
      }
    } else if (data.postId || data.type === 'community-reply') {
      navigateFromNotification('Community');
    } else if (data.type === 'walk-joined') {
      navigateFromNotification('WalkTogether');
    } else if (data.type === 'adminSOSAlert' || data.type === 'emergency_sos') {
      navigateFromNotification('AdminLiveSOS');
    } else if (data.type === 'newIncidentReport') {
      navigateFromNotification('AdminIncidents');
    } else if (data.type === 'newKYCSubmission' || data.type === 'newVehicleSubmission') {
      navigateFromNotification('AdminKYC');
    }
    // Note: Do NOT fallback to 'Notifications' here; if there is no explicit target route, stay on Home/Dashboard
  } catch (err) {
    console.log('[NotificationResponse] Error:', err?.message);
  }
}

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('CRITICAL APP ERROR:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#07090d', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>⚠️</Text>
          <Text style={{ color: '#f5a623', fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
            App Encountered an Issue
          </Text>
          <Text style={{ color: '#8b949e', fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
            {String(this.state.error?.message || this.state.error || 'Unknown error')}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#2dd4a0', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={{ color: '#000', fontWeight: '800' }}>Retry / Reload</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function AppNotificationBanner() {
  const insets = useSafeAreaInsets();
  const [currentNotif, setCurrentNotif] = useState(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const timeoutRef = useRef(null);

  useEffect(() => {
    const unsub = addNotificationListener((notif) => {
      setCurrentNotif(notif);
      Animated.spring(translateY, {
        toValue: insets.top > 0 ? insets.top + 6 : 24,
        useNativeDriver: true,
        friction: 8,
      }).start();

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -120,
          duration: 250,
          useNativeDriver: true,
        }).start(() => setCurrentNotif(null));
      }, 4000);
    });
    return () => unsub();
  }, [insets.top]);

  if (!currentNotif) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 14,
        right: 14,
        transform: [{ translateY }],
        zIndex: 99999,
        backgroundColor: '#131822',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#2dd4a0',
        padding: 12,
        shadowColor: '#2dd4a0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <TouchableOpacity
        onPress={() => {
          Animated.timing(translateY, {
            toValue: -120,
            duration: 200,
            useNativeDriver: true,
          }).start(() => setCurrentNotif(null));
          if (currentNotif?.data) {
            handleNotificationResponse({ data: currentNotif.data });
          }
        }}
        activeOpacity={0.85}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: 'rgba(45,212,160,0.15)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 20 }}>🔔</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#2dd4a0', fontWeight: '800', fontSize: 13, marginBottom: 2 }}>
            {currentNotif.title}
          </Text>
          <Text style={{ color: '#e6edf3', fontSize: 12, lineHeight: 16 }} numberOfLines={2}>
            {currentNotif.body}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          Animated.timing(translateY, {
            toValue: -120,
            duration: 200,
            useNativeDriver: true,
          }).start(() => setCurrentNotif(null));
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{ padding: 4 }}
      >
        <Text style={{ color: '#8b949e', fontSize: 14, fontWeight: '700' }}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#07090d',
    card: '#101520',
    text: '#edf0f7',
    border: '#212840',
    primary: '#f5a623',
  },
};

const customLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f8fafc',
    card: '#ffffff',
    text: '#0f172a',
    border: '#cbd5e1',
    primary: '#d97706',
  },
};

function MainApp() {
  const { isDark, colors } = useTheme();

  return (
    <NavigationContainer ref={navigationRef} theme={isDark ? customDarkTheme : customLightTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.bg} />
      <AppNavigator />
      <AppNotificationBanner />
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    // Hide native splash screen immediately on mount
    SplashScreen.hideAsync().catch(() => {});
    // Initialize system notification permissions and Android channels
    initNotificationService().catch(() => {});

    // Handle outside notification tap when app opened from killed/cold state
    Notifications.getLastNotificationResponseAsync().then(async (resp) => {
      if (!resp) return;
      try {
        const notifId = resp.notification?.request?.identifier || String(resp.notification?.date || '');
        const notifDate = resp.notification?.date ? resp.notification.date * 1000 : null;
        const lastHandled = await AsyncStorage.getItem('@last_handled_notif_response_id');

        // If notification is already handled or older than 20 seconds, ignore stale cold-start cache
        if (lastHandled && lastHandled === notifId) return;
        if (notifDate && (Date.now() - notifDate > 20000)) return;

        setTimeout(() => handleNotificationResponse(resp), 900);
      } catch {}
    }).catch(() => {});

    // Listen for notification taps when app is backgrounded / active outside
    const sub = Notifications.addNotificationResponseReceivedListener(resp => {
      handleNotificationResponse(resp);
    });

    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <MainApp />
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
