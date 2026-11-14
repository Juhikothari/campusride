import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import * as api from '../services/api';
import { registerForPushNotificationsAsync } from '../services/pushNotification';
import { disconnectGlobalSocket } from '../hooks/useSocket';
import { colors } from '../theme';

const AuthContext = createContext(null);

export const getDeviceId = async () => {
  try {
    let id = await AsyncStorage.getItem('@cr_device_id');
    if (!id) {
      id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
      await AsyncStorage.setItem('@cr_device_id', id);
    }
    return id;
  } catch {
    return 'dev_' + Date.now().toString(36);
  }
};

export function AuthProvider({ children }) {
  const [user,     setUserState] = useState(null);
  const [loading,  setLoading]   = useState(false);
  const [initDone, setInitDone]  = useState(false);

  const saveAuth = async ({ token, user }) => {
    if (token) await api.setToken(token);
    if (user)  await api.setUser(user);
    setUserState(user);
  };

  const logout = useCallback(() => {
    // 1. Immediately reset state so UI switches to Login screen with ZERO delay
    setUserState(null);
    disconnectGlobalSocket();

    // 2. Perform all cleanup & unregistration asynchronously in background
    (async () => {
      try {
        await Promise.all([
          api.removeToken().catch(() => {}),
          api.removeUser().catch(() => {}),
          AsyncStorage.removeItem('@last_handled_notif_response_id').catch(() => {}),
          AsyncStorage.removeItem('@user_registered_vehicles_list').catch(() => {}),
        ]);
        api.unregisterPushToken().catch(() => {});
        api.logout().catch(() => {});
      } catch (_) {}
    })();
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const u = await api.getMe();
      if (u && (u._id || u.id)) {
        await api.setUser(u);
        setUserState(u);
        return u;
      }
    } catch (e) {
      console.log('Refresh user error:', e.message);
    }
    return null;
  }, []);

  const loginUser = async (email, password, options = {}) => {
    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      const data = await api.login({ email, password, deviceId, ...options });
      await saveAuth(data);
      try {
        const fullUser = await api.getMe();
        if (fullUser && (fullUser._id || fullUser.id)) {
          await api.setUser(fullUser);
          setUserState(fullUser);
        }
      } catch (err) {
        console.log('Post-login profile refresh note:', err.message);
      }
      return data;
    } finally {
      setLoading(false);
    }
  };

  const registerUser = async (fields) => {
    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      const data = await api.register({ ...fields, deviceId });
      await saveAuth(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  // Validate stored token and load user on mount (with guaranteed fast timeout)
  useEffect(() => {
    let isMounted = true;

    // Safety fallback timer — maximum 1.2s on launch
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setInitDone(true);
        SplashScreen.hideAsync().catch(() => {});
      }
    }, 1200);

    (async () => {
      try {
        const [token, cachedUser] = await Promise.all([
          api.getToken().catch(() => ''),
          api.getUser().catch(() => null)
        ]);

        if (token) {
          try {
            // Verify session with backend before entering logged-in state
            const u = await api.getMe();
            if (u && (u._id || u.id) && isMounted) {
              await api.setUser(u);
              setUserState(u);
            } else if (isMounted) {
              logout();
            }
          } catch (e) {
            console.log('Session verification error:', e.message);
            if (e.status === 401 || e.status === 403 || e.message?.includes('token') || e.message?.includes('auth')) {
              // Stale/expired token: clear out immediately, do not display logged-in dashboard
              if (isMounted) logout();
            } else if (cachedUser && isMounted) {
              // Pure offline fallback when server is unreachable
              setUserState(cachedUser);
            }
          }
        } else {
          // No token found: ensure cached user is also purged so logged-out state is immediate
          if (cachedUser) {
            await api.removeUser().catch(() => {});
          }
          if (isMounted) setUserState(null);
        }
      } catch (err) {
        console.log('Auth initialization error:', err);
      } finally {
        clearTimeout(safetyTimer);
        if (isMounted) {
          setInitDone(true);
          SplashScreen.hideAsync().catch(() => {});
        }
      }
    })();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [logout]);

  useEffect(() => {
    if (user?._id || user?.id) {
      registerForPushNotificationsAsync(user?._id || user?.id).catch(() => {});
    }
  }, [user?._id, user?.id]);

  if (!initDone) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 44, marginBottom: 12 }}>🚗</Text>
        <Text style={{ color: colors.accent, fontSize: 28, fontWeight: '900', letterSpacing: 2 }}>
          HO<Text style={{ color: colors.text }}>GO</Text>
        </Text>
        <Text style={{ color: colors.text3, fontSize: 13, marginTop: 4, fontWeight: '600', letterSpacing: 0.5 }}>
          Find Your Match
        </Text>
        <ActivityIndicator color={colors.accent} size="small" style={{ marginTop: 28 }} />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, registerUser, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
