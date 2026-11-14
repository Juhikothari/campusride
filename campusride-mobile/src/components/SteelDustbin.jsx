// campusride-mobile/src/components/SteelDustbin.jsx - Modern Stainless Steel Dustbin Icon
import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function SteelDustbin({ size = 16 }) {
  const w = size;
  const h = size * 1.1;

  return (
    <View style={[styles.wrap, { width: w + 4, height: h + 4 }]}>
      {/* Steel Lid Handle */}
      <View style={[styles.handle, { width: w * 0.45, backgroundColor: '#e2e8f0' }]} />
      {/* Metallic Rim */}
      <View style={[styles.rim, { width: w + 2, backgroundColor: '#94a3b8' }]} />
      {/* Ribbed Stainless Steel Can Body */}
      <View style={[styles.body, { width: w, height: h * 0.85 }]}>
        <View style={styles.steelRib} />
        <View style={styles.steelRib} />
        <View style={styles.steelRib} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    height: 2,
    borderRadius: 1,
    marginBottom: 1,
  },
  rim: {
    height: 2.5,
    borderRadius: 1.5,
    borderWidth: 0.5,
    borderColor: '#475569',
  },
  body: {
    backgroundColor: '#94a3b8',
    borderBottomLeftRadius: 3.5,
    borderBottomRightRadius: 3.5,
    borderWidth: 1,
    borderColor: '#475569',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 1,
  },
  steelRib: {
    width: 1,
    height: '75%',
    backgroundColor: '#e2e8f0',
  },
});
