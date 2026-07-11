import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUserState] = useState(() => api.getUser());
  const [loading, setLoading]   = useState(false);
  const [initDone, setInitDone] = useState(false);

  // ── Save auth to state + localStorage ──────────────────────────
  const saveAuth = ({ token, user }) => {
    api.setToken(token);
    api.setUser(user);
    setUserState(user);
  };

  // ── Logout ─────────────────────────────────────────────────────
  const logout = useCallback(() => {
    api.removeToken();
    api.removeUser();
    setUserState(null);
  }, []);

  // ── Login ──────────────────────────────────────────────────────
  const loginUser = async (email, password) => {
    setLoading(true);
    try {
      const data = await api.login({ email, password });
      saveAuth(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  // ── Register ───────────────────────────────────────────────────
  const registerUser = async (fields) => {
    setLoading(true);
    try {
      const data = await api.register(fields);
      saveAuth(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  // ── Validate stored token on mount ─────────────────────────────
  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.getMe()
        .then(u => { api.setUser(u); setUserState(u); })
        .catch(() => logout())
        .finally(() => setInitDone(true));
    } else {
      setInitDone(true);
    }
  }, []); // eslint-disable-line

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, registerUser, logout }}>
      {initDone ? children : (
        // Minimal loading screen while validating token
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#07090d', color:'#f5a623', fontFamily:'Syne,sans-serif', fontSize:18, fontWeight:700 }}>
          CampusRide
        </div>
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
