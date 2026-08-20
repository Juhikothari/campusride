import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import * as api from '../services/api';
import { colors } from '../theme';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,     setUserState] = useState(null);
  const [loading,  setLoading]   = useState(false);
  const [initDone, setInitDone]  = useState(false);

  const saveAuth = async ({ token, user }) => {
    if (token) await api.setToken(token);
    if (user)  await api.setUser(user);
    setUserState(user);
  };

  const logout = useCallback(async () => {
    await api.removeToken().catch(() => {});
    await api.removeUser().catch(() => {});
    setUserState(null);
  }, []);

  const loginUser = async (email, password) => {
    setLoading(true);
    try {
      const data = await api.login({ email, password });
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
      const data = await api.register(fields);
      await saveAuth(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  // Validate stored token and load user on mount (with guaranteed timeout)
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const [token, cachedUser] = await Promise.all([
          api.getToken().catch(() => ''),
          api.getUser().catch(() => null)
        ]);

        if (cachedUser && isMounted) {
          setUserState(cachedUser);
        }

        if (token) {
          try {
            const u = await api.getMe();
            if (u && isMounted) {
              await api.setUser(u);
              setUserState(u);
            }
          } catch (e) {
            console.log('Session verification error:', e.message);
            // Only force logout if the token is explicitly rejected (401/403),
            // but keep cached session if it was just a temporary network timeout.
            if (e.status === 401 || e.status === 403) {
              if (isMounted) await logout();
            }
          }
        }
      } catch (err) {
        console.log('Auth initialization error:', err);
      } finally {
        if (isMounted) {
          setInitDone(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [logout]);

  if (!initDone) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.accent, fontSize: 24, fontWeight: '800', letterSpacing: 1 }}>
          Campus<Text style={{ color: colors.text }}>Ride</Text>
        </Text>
        <ActivityIndicator color={colors.accent} size="large" style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, registerUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
