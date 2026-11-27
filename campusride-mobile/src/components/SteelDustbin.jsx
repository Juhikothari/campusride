// campusride-mobile/src/components/SteelDustbin.jsx - Clean Minimalist Trash Bin Icon
import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function SteelDustbin({ size = 15, color = '#ef4444' }) {
  const w = size;
  const h = size * 1.1;

  return (
    <View style={[styles.wrap, { width: w + 4, height: h + 4 }]}>
      {/* Lid clasp */}
      <View style={[styles.handle, { width: w * 0.36, borderColor: color }]} />
      {/* Top bar */}
      <View style={[styles.rim, { width: w + 1, backgroundColor: color }]} />
      {/* Clean outline trapezoid-feel bucket */}
      <View style={[styles.body, { width: w * 0.84, height: h * 0.78, borderColor: color }]}>
        <View style={[styles.bar, { backgroundColor: color }]} />
        <View style={[styles.bar, { backgroundColor: color }]} />
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
    height: 2.5,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  rim: {
    height: 2,
    borderRadius: 1,
    marginBottom: 1,
  },
  body: {
    borderWidth: 1.5,
    borderTopWidth: 0.5,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 1.5,
  },
  bar: {
    width: 1.3,
    height: '68%',
    borderRadius: 1,
  },
});
