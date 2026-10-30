// src/theme/themed.jsx
//
// Light-mode fix layer.
//
// Most screens build their styles once (StyleSheet.create at the top of the file) with
// the DARK palette baked in, so in light mode some text stayed pale on a light
// background ("words not visible"). These are drop-in replacements for the React
// Native components (View, Text, TextInput, ...). In dark mode they do nothing.
// In light mode they remap dark-palette colors to readable light-palette colors
// right before rendering, so every screen that uses them follows the theme.
//
// Usage:  import { View, Text, TouchableOpacity } from '../theme/themed';
//
// Admin screens are intentionally not routed through this file (they stay dark).

import React, { createContext, useContext } from 'react';
import * as RN from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

// ── colour parsing ────────────────────────────────────────────────────────────
const NAMED = { white: '#ffffff', black: '#000000', transparent: 'rgba(0,0,0,0)' };

function parse(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim().toLowerCase();
  if (NAMED[s]) s = NAMED[s];
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    let a = 1;
    if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }
  return null;
}

function toHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0; let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h, s, l };
}

function fromHsl({ h, s, l }, a = 1) {
  const f = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r; let g; let b;
  if (s === 0) { r = g = b = l; } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3);
  }
  const hx = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  const base = `#${hx(r)}${hx(g)}${hx(b)}`;
  return a < 1 ? `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})` : base;
}

// ── light-mode mapping rules ──────────────────────────────────────────────────
// Exact matches for the app's own dark palette -> its light palette (see theme/index.js)
const PALETTE_MAP = {
  '#07090d': '#f8fafc', // bg
  '#0c0f17': '#f1f5f9', // bg2
  '#101520': '#ffffff', // surface
  '#161c2a': '#f1f5f9', // surface2
  '#1d2438': '#e2e8f0', // surface3
  '#212840': '#cbd5e1', // border
  '#2c3454': '#94a3b8', // border2
};

// Backgrounds & borders: dark surfaces become light surfaces (same hue, kept subtle).
function lightSurface(value, role = 'bg') {
  const c = parse(value);
  if (!c || c.a === 0) return value;
  // translucent white tints (used on dark cards) -> translucent dark tints
  if (c.a < 1) {
    if (c.r > 235 && c.g > 235 && c.b > 235) return `rgba(15,23,42,${+(c.a * 0.8).toFixed(3)})`;
    return value; // black overlays & coloured tints work in both themes
  }
  if (c.r === 0 && c.g === 0 && c.b === 0) return value; // pure black stays (image viewers, camera)
  const exact = PALETTE_MAP[String(value).trim().toLowerCase()];
  if (exact) return exact;
  const hsl = toHsl(c);
  if (hsl.l < 0.28 && hsl.s < 0.75) {
    const l = role === 'border' ? 0.9 - 0.4 * hsl.l : 0.99 - 0.55 * hsl.l;
    return fromHsl({ h: hsl.h, s: Math.min(hsl.s * 0.6, 0.3), l });
  }
  return value;
}

// Text: pale text becomes dark; coloured text is darkened so it reads on white.
function lightText(value, onDark) {
  const c = parse(value);
  if (!c || onDark) return value;
  const hsl = toHsl(c);
  if (c.a < 1) {
    if (c.r > 200 && c.g > 200 && c.b > 200) return `rgba(15,23,42,${c.a})`;
    return value;
  }
  if (hsl.s < 0.5) {
    if (hsl.l >= 0.75) return '#0f172a';
    if (hsl.l >= 0.5) return '#475569';
    return value;
  }
  if (hsl.l > 0.46) return fromHsl({ h: hsl.h, s: hsl.s, l: 0.34 });
  return value;
}

// Is a (mapped, opaque) background dark / saturated enough that white text belongs on it?
function isDarkSurface(value) {
  const c = parse(value);
  if (!c) return null;
  if (c.a < 0.35) return null; // transparent: inherit
  const { s, l } = toHsl(c);
  if (c.a < 1) {
    // dark scrims over images / video
    return c.r < 40 && c.g < 40 && c.b < 40 ? true : null;
  }
  if (l < 0.5 && (l < 0.3 || s > 0.35)) return true; // dark or strongly coloured (buttons)
  if (l >= 0.5 && s > 0.55 && l < 0.62) return true; // saturated mid tones (amber/green buttons)
  return false;
}

const BG_KEYS = ['backgroundColor'];
const BORDER_KEYS = ['borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'borderStartColor', 'borderEndColor'];

// Returns { style, surface } where surface = true/false/null (null = inherit)
function mapStyle(style, isDark, onDark) {
  if (isDark || !style) return { style, surface: null };
  const flat = RN.StyleSheet.flatten(style);
  if (!flat) return { style, surface: null };
  const out = { ...flat };
  let surface = null;
  for (const k of BG_KEYS) {
    if (typeof out[k] === 'string') {
      out[k] = lightSurface(out[k]);
      surface = isDarkSurface(out[k]);
    }
  }
  for (const k of BORDER_KEYS) {
    if (typeof out[k] === 'string') out[k] = lightSurface(out[k], 'border');
  }
  const nowOnDark = surface === null ? onDark : surface;
  if (typeof out.color === 'string') out.color = lightText(out.color, nowOnDark);
  return { style: out, surface };
}

// "Are we sitting on a dark/coloured surface?" - lets white text stay white on buttons.
const SurfaceContext = createContext(false);

// Wrap a subtree in <DarkScope> to keep it dark even when the app is in light mode
// (used for full-screen photo viewers / editors).
const ForceDarkContext = createContext(false);
export function DarkScope({ children }) {
  return <ForceDarkContext.Provider value={true}>{children}</ForceDarkContext.Provider>;
}
function useIsDark() {
  const { isDark } = useTheme();
  const forced = useContext(ForceDarkContext);
  return isDark || forced;
}

// ── generic wrapper factory (for components with a single `style` prop) ───────
function make(Base, name, opts = {}) {
  const extraStyleProps = opts.extraStyleProps || [];
  const textProps = opts.textProps || [];
  const forceDark = !!opts.forceDark;

  function Themed(props) {
    const isDark = useIsDark();
    const onDark = useContext(SurfaceContext);
    if (isDark) return <Base {...props} />;

    const next = { ...props };
    const { style, surface } = mapStyle(props.style, false, onDark);
    next.style = style;
    for (const key of extraStyleProps) {
      if (props[key]) next[key] = mapStyle(props[key], false, onDark).style;
    }
    for (const key of textProps) {
      if (typeof props[key] === 'string') next[key] = lightText(props[key], onDark);
    }
    const providerValue = forceDark ? true : surface;
    const el = <Base {...next} />;
    if (providerValue === null || providerValue === onDark) return el;
    return <SurfaceContext.Provider value={providerValue}>{el}</SurfaceContext.Provider>;
  }
  Themed.displayName = `Themed(${name})`;
  return Themed;
}

export const View = make(RN.View, 'View');
export const Text = make(RN.Text, 'Text');
export const TouchableOpacity = make(RN.TouchableOpacity, 'TouchableOpacity');
export const TouchableHighlight = make(RN.TouchableHighlight, 'TouchableHighlight');
export const KeyboardAvoidingView = make(RN.KeyboardAvoidingView, 'KeyboardAvoidingView');
export const ImageBackground = make(RN.ImageBackground, 'ImageBackground', { forceDark: true });
export const SafeAreaView = make(RNSafeAreaView, 'SafeAreaView');
export const ScrollView = make(RN.ScrollView, 'ScrollView', {
  extraStyleProps: ['contentContainerStyle'],
});
export const FlatList = make(RN.FlatList, 'FlatList', {
  extraStyleProps: ['contentContainerStyle', 'columnWrapperStyle', 'ListHeaderComponentStyle'],
});
export const SectionList = make(RN.SectionList, 'SectionList', {
  extraStyleProps: ['contentContainerStyle'],
});

export function TextInput(props) {
  const isDark = useIsDark();
  const onDark = useContext(SurfaceContext);
  if (isDark) return <RN.TextInput {...props} />;
  const { style } = mapStyle(props.style, false, onDark);
  const next = { ...props, style };
  if (typeof props.placeholderTextColor === 'string') {
    next.placeholderTextColor = lightText(props.placeholderTextColor, false);
  }
  // An input always sits on its own (mapped) background, so make sure typed text is readable.
  if (style && typeof style.color !== 'string') next.style = { ...style, color: '#0f172a' };
  return <RN.TextInput {...next} />;
}

export function Pressable(props) {
  const isDark = useIsDark();
  const onDark = useContext(SurfaceContext);
  if (isDark) return <RN.Pressable {...props} />;
  const { style } = props;
  const mapped = typeof style === 'function'
    ? (state) => mapStyle(style(state), false, onDark).style
    : mapStyle(style, false, onDark).style;
  return <RN.Pressable {...props} style={mapped} />;
}

export function ActivityIndicator(props) {
  const isDark = useIsDark();
  const onDark = useContext(SurfaceContext);
  if (isDark || typeof props.color !== 'string') return <RN.ActivityIndicator {...props} />;
  return <RN.ActivityIndicator {...props} color={lightText(props.color, onDark)} />;
}

export { SurfaceContext };
