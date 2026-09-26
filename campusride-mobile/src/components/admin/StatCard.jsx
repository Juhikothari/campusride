// campusride-mobile/src/components/admin/StatCard.jsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function StatCard({ label, value, color = '#2dd4a0' }) {
  const displayVal = (value !== undefined && value !== null) ? value : '0';

  return (
    <View style={[styles.card, { borderColor: color + '33' }]}>
      <View style={styles.topRow}>
        <View style={[styles.indicator, { backgroundColor: color }]} />
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.value, { color }]}>{displayVal}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: '#0d1117',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  value: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
