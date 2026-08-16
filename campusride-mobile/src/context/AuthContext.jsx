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
    await api.setToken(token);
    await api.setUser(user);
    setUserState(user);
  };

  const logout = useCallback(async () => {
    await api.removeToken();
    await api.removeUser();
    setUserState(null);
  }, []);

  const loginUser = async (email, password) => {
    setLoading(true);
    try {
      const data = await api.login({ email, password });
      await saveAuth(data);
      try {
        const fullUser = await api.getMe();
        await api.setUser(fullUser);
        setUserState(fullUser);
      } catch {}
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

  // Validate stored token on mount
  useEffect(() => {
    (async () => {
      const token = await api.getToken();
      if (token) {
        try {
          const u = await api.getMe();
          await api.setUser(u);
          setUserState(u);
        } catch {
          await logout();
        }
      }
      setInitDone(true);
    })();
  }, []);

  if (!initDone) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.accent, fontSize: 22, fontWeight: '800', letterSpacing: 1 }}>
          Campus<Text style={{ color: colors.text }}>Ride</Text>
        </Text>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
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
