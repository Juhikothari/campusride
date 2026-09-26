// campusride-mobile/src/components/admin/SimpleLineChart.jsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function SimpleLineChart({ data = [], color = '#2dd4a0' }) {
  if (!data || data.length === 0) {
    return (
      <View style={styles.chartCard}>
        <Text style={styles.emptyText}>No activity recorded in last 7 days</Text>
      </View>
    );
  }

  const values = data.map(d => Number(d.value ?? d.count ?? 0));
  const maxVal = Math.max(...values, 5);

  return (
    <View style={styles.chartCard}>
      <View style={styles.barsContainer}>
        {data.map((item, idx) => {
          const val = Number(item.value ?? item.count ?? 0);
          const heightPct = Math.max(Math.round((val / maxVal) * 100), 10);
          const rawLabel = item.label || item._id || `${idx + 1}`;
          const displayLabel = rawLabel.includes('/') ? rawLabel : rawLabel.slice(-5);

          return (
            <View key={idx} style={styles.barCol}>
              <Text style={[styles.barVal, { color: val > 0 ? color : '#6e7681' }]}>
                {val}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${heightPct}%`,
                      backgroundColor: color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{displayLabel}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: '#0d1117',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#21262d',
    padding: 16,
    marginBottom: 20,
  },
  emptyText: {
    color: '#8b949e',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 10,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barVal: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  barTrack: {
    width: 14,
    height: 80,
    backgroundColor: '#161b22',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barLabel: {
    color: '#8b949e',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
  },
});
