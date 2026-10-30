import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, colors } from '../theme';

const defaultThemeValue = {
  theme: 'dark',
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
  setTheme: () => {},
};

const ThemeContext = createContext(defaultThemeValue);

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState('dark');

  useEffect(() => {
    AsyncStorage.getItem('@app_theme').then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        setThemeState(saved);
        updateGlobalColors(saved);
      }
    }).catch(() => {});
  }, []);

  const updateGlobalColors = (t) => {
    const active = t === 'light' ? lightColors : darkColors;
    Object.assign(colors, active);
  };

  const setTheme = (t) => {
    setThemeState(t);
    updateGlobalColors(t);
    AsyncStorage.setItem('@app_theme', t).catch(() => {});
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  const isDark = theme === 'dark';
  const currentColors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors: currentColors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  return ctx || defaultThemeValue;
};

ThemeContext.useTheme = useTheme;
ThemeContext.ThemeProvider = ThemeProvider;

export default ThemeContext;
