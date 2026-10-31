// src/components/CropView.jsx
//
// Real, interactive crop editor (drag the box, drag the corners, pick an aspect ratio).
// Used inside the "Photo Staging & Crop" screen. Always dark (it is a photo viewer).
//
// Parent usage:
//   const cropRef = useRef(null);
//   <CropView ref={cropRef} uri={stagedAttachment.uri} />
//   const { uri, changed } = await cropRef.current.getCropped();
//
// Plain react-native components on purpose (not the themed ones).

import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, PanResponder, ActivityIndicator, StyleSheet,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '../context/ThemeContext';

const MIN = 56;   // smallest crop box side (screen px)
const PAD = 26;   // room around the image so corner handles can be touched at the edges
const ASPECTS = [
  { label: 'Free', value: null },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '16:9', value: 16 / 9 },
];
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

const CropView = React.forwardRef(function CropView({ uri, accent = '#f5a623' }, ref) {
  const { isDark } = useTheme();
  const [src, setSrc] = useState(null);                 // { uri, width, height } real pixels
  const [loading, setLoading] = useState(false);
  const [aspect, setAspect] = useState(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState({ x: 0, y: 0, w: 0, h: 0 });   // image-display coords

  const disp = useMemo(() => {
    if (!src || stage.w <= 2 * PAD || stage.h <= 2 * PAD) return { w: 0, h: 0 };
    const aw = stage.w - 2 * PAD; const ah = stage.h - 2 * PAD;
    const s = Math.min(aw / src.width, ah / src.height);
    return { w: src.width * s, h: src.height * s };
  }, [src, stage]);

  // refs so the (once-created) PanResponders always see fresh values
  const rectRef = useRef(rect);
  const dispRef = useRef(disp);
  const aspectRef = useRef(aspect);
  const startRef = useRef(rect);
  dispRef.current = disp;
  aspectRef.current = aspect;
  const applyRect = useRef((r) => { rectRef.current = r; setRect(r); }).current;

  // Load image. A no-op manipulate bakes EXIF rotation in, so crop coordinates are correct.
  useEffect(() => {
    let alive = true;
    if (!uri) { setSrc(null); return undefined; }
    setLoading(true);
    ImageManipulator.manipulateAsync(uri, [], { compress: 1, format: ImageManipulator.SaveFormat.JPEG })
      .then((r) => ({ uri: r.uri, width: r.width, height: r.height }))
      .catch(() => new Promise((resolve, reject) => {
        // fallback: use the original file as-is
        Image.getSize(uri, (width, height) => resolve({ uri, width, height }), reject);
      }))
      .then((r) => { if (alive) setSrc(r); })
      .catch((e) => console.log('[CropView] load error:', e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [uri]);

  // (Re)initialise the crop box: full image, or the biggest box of the chosen ratio
  useEffect(() => {
    if (!disp.w) return;
    let w = disp.w; let h = disp.h;
    if (aspect) {
      if (w / h > aspect) w = h * aspect; else h = w / aspect;
    }
    applyRect({ x: (disp.w - w) / 2, y: (disp.h - h) / 2, w, h });
  }, [disp.w, disp.h, aspect]);

  // drag the whole box
  const movePan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { startRef.current = { ...rectRef.current }; },
    onPanResponderMove: (_, g) => {
      const s = startRef.current; const d = dispRef.current;
      applyRect({ ...s, x: clamp(s.x + g.dx, 0, d.w - s.w), y: clamp(s.y + g.dy, 0, d.h - s.h) });
    },
  }), []);

  // drag a corner (opposite corner stays fixed)
  const makeCornerPan = (corner) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { startRef.current = { ...rectRef.current }; },
    onPanResponderMove: (_, g) => {
      const s = startRef.current; const d = dispRef.current; const asp = aspectRef.current;
      const right = corner.includes('r'); const bottom = corner.includes('b');
      const sx = right ? 1 : -1; const sy = bottom ? 1 : -1;
      const ax = right ? s.x : s.x + s.w;
      const ay = bottom ? s.y : s.y + s.h;
      const px = clamp((right ? s.x + s.w : s.x) + g.dx, 0, d.w);
      const py = clamp((bottom ? s.y + s.h : s.y) + g.dy, 0, d.h);
      const maxW = sx > 0 ? d.w - ax : ax;
      const maxH = sy > 0 ? d.h - ay : ay;
      let w; let h;
      if (asp) {
        w = Math.max(sx * (px - ax), sy * (py - ay) * asp);
        w = clamp(w, MIN, Math.max(MIN, Math.min(maxW, maxH * asp)));
        h = w / asp;
      } else {
        w = clamp(sx * (px - ax), MIN, Math.max(MIN, maxW));
        h = clamp(sy * (py - ay), MIN, Math.max(MIN, maxH));
      }
      applyRect({ x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h });
    },
  });
  const cornerPans = useMemo(() => ({
    tl: makeCornerPan('tl'), tr: makeCornerPan('tr'),
    bl: makeCornerPan('bl'), br: makeCornerPan('br'),
  }), []);

  // Parent asks for the result. If the box still covers the whole image, nothing is cropped.
  useImperativeHandle(ref, () => ({
    async getCropped() {
      const d = dispRef.current; const r = rectRef.current;
      if (!src || !d.w) return { uri, changed: false };
      const full = r.w >= d.w - 1.5 && r.h >= d.h - 1.5;
      if (full) return { uri, changed: false };
      const f = src.width / d.w;
      const originX = clamp(Math.round(r.x * f), 0, src.width - 1);
      const originY = clamp(Math.round(r.y * f), 0, src.height - 1);
      const width = clamp(Math.round(r.w * f), 1, src.width - originX);
      const height = clamp(Math.round(r.h * f), 1, src.height - originY);
      const out = await ImageManipulator.manipulateAsync(
        src.uri,
        [{ crop: { originX, originY, width, height } }],
        { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG },
      );
      return { uri: out.uri, changed: true, width: out.width, height: out.height };
    },
  }), [src, uri]);

  const shade = 'rgba(0,0,0,0.62)';
  const X = PAD + rect.x; const Y = PAD + rect.y;   // box position inside the padded stage
  const corner = (key, left, top) => (
    <View key={key} {...cornerPans[key].panHandlers}
      style={[styles.hit, { left: left - 22, top: top - 22 }]}>
      <View style={[styles.dot, { backgroundColor: accent }]} />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#000000' : '#0a0e17' }]}>
      <View
        style={styles.stage}
        onLayout={(e) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {src && disp.w > 0 && (
          <View style={{ width: disp.w + 2 * PAD, height: disp.h + 2 * PAD }}>
            <Image
              source={{ uri: src.uri }}
              style={{ position: 'absolute', left: PAD, top: PAD, width: disp.w, height: disp.h }}
              resizeMode="stretch"
            />
            {/* dimmed area outside the box */}
            <View pointerEvents="none" style={{ position: 'absolute', left: PAD, top: PAD, width: disp.w, height: rect.y, backgroundColor: shade }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: PAD, top: Y + rect.h, width: disp.w, height: disp.h - rect.y - rect.h, backgroundColor: shade }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: PAD, top: Y, width: rect.x, height: rect.h, backgroundColor: shade }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: X + rect.w, top: Y, width: disp.w - rect.x - rect.w, height: rect.h, backgroundColor: shade }} />

            {/* the crop box: drag to move */}
            <View {...movePan.panHandlers}
              style={{ position: 'absolute', left: X, top: Y, width: rect.w, height: rect.h, borderWidth: 1.5, borderColor: '#fff' }}>
              <View pointerEvents="none" style={[styles.gridV, { left: '33.33%' }]} />
              <View pointerEvents="none" style={[styles.gridV, { left: '66.66%' }]} />
              <View pointerEvents="none" style={[styles.gridH, { top: '33.33%' }]} />
              <View pointerEvents="none" style={[styles.gridH, { top: '66.66%' }]} />
            </View>

            {corner('tl', X, Y)}
            {corner('tr', X + rect.w, Y)}
            {corner('bl', X, Y + rect.h)}
            {corner('br', X + rect.w, Y + rect.h)}
          </View>
        )}
        {loading && (
          <View style={styles.busy}><ActivityIndicator size="large" color={accent} /></View>
        )}
      </View>

      {/* aspect-ratio presets */}
      <View style={styles.aspectRow}>
        {ASPECTS.map((a) => {
          const on = a.value === aspect;
          return (
            <TouchableOpacity
              key={a.label}
              onPress={() => setAspect(a.value)}
              style={[
                styles.chip,
                {
                  borderColor: on ? accent : (isDark ? '#3a4256' : '#475569'),
                  backgroundColor: on ? accent : (isDark ? '#161b22' : '#1e293b'),
                }
              ]}
            >
              <Text style={{ color: on ? '#000' : '#ffffff', fontWeight: '700', fontSize: 12 }}>{a.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: isDark ? '#8b96b0' : '#cbd5e1' }]}>Drag the corners or the box to choose what to keep</Text>
    </View>
  );
});

export default CropView;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hit: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#fff' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.5)' },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.5)' },
  busy: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  aspectRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  hint: { color: '#8b96b0', fontSize: 11, textAlign: 'center', paddingBottom: 8 },
});
