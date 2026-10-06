import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { addNotificationListener } from './src/services/notificationService';

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

export default function App() {
  useEffect(() => {
    // Hide native splash screen immediately on mount
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AuthProvider>
            <NavigationContainer>
              <StatusBar style="light" backgroundColor="#07090d" />
              <AppNavigator />
              <AppNotificationBanner />
            </NavigationContainer>
          </AuthProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
