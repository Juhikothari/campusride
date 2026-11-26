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

function extractRestrictionFromUser(u) {
  if (!u) return null;
  if (u.blocked || u.isBlocked) {
    return {
      status: 'blocked',
      reason: u.blockReason || 'This account has been blocked by administrators.',
      until: null,
    };
  }
  if (u.suspended) {
    return {
      status: 'suspended',
      reason: u.suspensionReason || 'Your account is currently suspended from HOGO.',
      until: u.suspendedUntil || null,
    };
  }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [accountRestriction, setAccountRestriction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initDone, setInitDone] = useState(false);

  const saveAuth = async ({ token, user: nextUser }) => {
    if (token) await api.setToken(token);
    if (nextUser) await api.setUser(nextUser);
    setAccountRestriction(extractRestrictionFromUser(nextUser));
    setUserState(nextUser);
  };

  const logout = useCallback(() => {
    // 1. Immediately reset state so UI switches to Login screen with ZERO delay
    setAccountRestriction(null);
    setUserState(null);
    disconnectGlobalSocket();

    // 2. Perform all cleanup & unregistration asynchronously in background
    (async () => {
      try {
        await Promise.all([
          api.removeToken().catch(() => {}),
          api.removeUser().catch(() => {}),
          AsyncStorage.removeItem('@cr_account_restriction').catch(() => {}),
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
        const restr = extractRestrictionFromUser(u);
        setAccountRestriction(restr);
        if (restr) {
          AsyncStorage.setItem('@cr_account_restriction', JSON.stringify(restr)).catch(() => {});
        } else {
          AsyncStorage.removeItem('@cr_account_restriction').catch(() => {});
        }
        await api.setUser(u);
        setUserState(u);
        return u;
      }
    } catch (e) {
      if (e.status === 403 && (e.suspended || e.blocked)) {
        const restr = {
          status: e.blocked ? 'blocked' : 'suspended',
          reason: e.suspensionReason || e.message,
          until: e.suspendedUntil || null,
        };
        setAccountRestriction(restr);
        AsyncStorage.setItem('@cr_account_restriction', JSON.stringify(restr)).catch(() => {});
      } else if (e.status === 401) {
        logout();
      } else {
        console.log('Refresh user note:', e.message);
      }
    }
    return null;
  }, [logout]);

  const loginUser = async (email, password, options = {}) => {
    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      const data = await api.login({ email, password, deviceId, ...options });
      await saveAuth(data);
      AsyncStorage.removeItem('@cr_account_restriction').catch(() => {});
      try {
        const fullUser = await api.getMe();
        if (fullUser && (fullUser._id || fullUser.id)) {
          await api.setUser(fullUser);
          setAccountRestriction(extractRestrictionFromUser(fullUser));
          setUserState(fullUser);
        }
      } catch (err) {
        if (err.status === 403 && (err.suspended || err.blocked)) {
          const restr = {
            status: err.blocked ? 'blocked' : 'suspended',
            reason: err.suspensionReason || err.message,
            until: err.suspendedUntil || null,
          };
          setAccountRestriction(restr);
          AsyncStorage.setItem('@cr_account_restriction', JSON.stringify(restr)).catch(() => {});
        }
      }
      return data;
    } catch (err) {
      if (err.status === 403 && (err.suspended || err.blocked)) {
        const restr = {
          status: err.blocked ? 'blocked' : 'suspended',
          reason: err.suspensionReason || err.message,
          until: err.suspendedUntil || null,
        };
        setAccountRestriction(restr);
        AsyncStorage.setItem('@cr_account_restriction', JSON.stringify(restr)).catch(() => {});
      }
      throw err;
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

  // Listen to 403 suspension/block events anywhere in the app
  useEffect(() => {
    return api.subscribeAccountRestriction((restr) => {
      if (restr) {
        setAccountRestriction(restr);
        AsyncStorage.setItem('@cr_account_restriction', JSON.stringify(restr)).catch(() => {});
      }
    });
  }, []);

  // Hydrate persisted session immediately on mount and verify asynchronously without spurious logouts
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const [token, cachedUser, cachedRestrictionRaw] = await Promise.all([
          api.getToken().catch(() => ''),
          api.getUser().catch(() => null),
          AsyncStorage.getItem('@cr_account_restriction').catch(() => null),
        ]);

        let cachedRestriction = null;
        if (cachedRestrictionRaw) {
          try { cachedRestriction = JSON.parse(cachedRestrictionRaw); } catch {}
        }

        if (token) {
          // Immediately hydrate persisted user & restriction state so cold Render wakeup doesn't flash Login
          if (cachedUser && isMounted) {
            setUserState(cachedUser);
            setAccountRestriction(cachedRestriction || extractRestrictionFromUser(cachedUser));
          } else if (cachedRestriction && isMounted) {
            setAccountRestriction(cachedRestriction);
          }

          if (cachedUser || cachedRestriction) {
            setInitDone(true);
            SplashScreen.hideAsync().catch(() => {});
          }

          // Verify/refresh session cleanly with backend
          try {
            const u = await api.getMe();
            if (u && (u._id || u.id) && isMounted) {
              const restr = extractRestrictionFromUser(u);
              setAccountRestriction(restr);
              if (restr) {
                AsyncStorage.setItem('@cr_account_restriction', JSON.stringify(restr)).catch(() => {});
              } else {
                AsyncStorage.removeItem('@cr_account_restriction').catch(() => {});
              }
              await api.setUser(u);
              setUserState(u);
            } else if (isMounted && !cachedUser) {
              logout();
            }
          } catch (e) {
            console.log('Session verification check:', e.status || 'network', e.message);
            if (!isMounted) return;
            if (e.status === 401) {
              // Explicit token rejection / SESSION_REPLACED / deleted account
              logout();
            } else if (e.status === 403 && (e.suspended || e.blocked)) {
              const restr = {
                status: e.blocked ? 'blocked' : 'suspended',
                reason: e.suspensionReason || e.message,
                until: e.suspendedUntil || null,
              };
              setAccountRestriction(restr);
              AsyncStorage.setItem('@cr_account_restriction', JSON.stringify(restr)).catch(() => {});
              if (!cachedUser) setUserState({ suspended: !e.blocked, blocked: !!e.blocked });
            } else if (cachedUser) {
              // Network timeout / Render cold start: keep user signed in
              setUserState(cachedUser);
            }
          }
        } else {
          if (cachedRestriction && isMounted) {
            setAccountRestriction(cachedRestriction);
          }
          if (cachedUser) {
            await api.removeUser().catch(() => {});
          }
          if (isMounted) setUserState(null);
        }
      } catch (err) {
        console.log('Auth initialization error:', err);
      } finally {
        if (isMounted) {
          setInitDone(true);
          SplashScreen.hideAsync().catch(() => {});
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [logout]);

  useEffect(() => {
    if ((user?._id || user?.id) && !accountRestriction && !user?.suspended && !user?.blocked && !user?.isBlocked) {
      registerForPushNotificationsAsync(user?._id || user?.id).catch(() => {});
    }
  }, [user?._id, user?.id, accountRestriction, user?.suspended, user?.blocked, user?.isBlocked]);

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
    <AuthContext.Provider value={{ user, accountRestriction, loading, loginUser, registerUser, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
