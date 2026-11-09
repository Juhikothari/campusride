import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import TopHeader from '../components/TopHeader';
import { colors, radius } from '../theme';

export default function RewardsScreen({ navigation }) {
  const { isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]} edges={['top']}>
      <TopHeader title="Campus Rewards" subtitle="Milestone Perks & Offers" showBack={true} />

      <View style={styles.centerContainer}>
        <View style={[
          styles.iconCircle,
          {
            backgroundColor: isDark ? 'rgba(245,166,35,0.15)' : '#fffbeb',
            borderColor: isDark ? 'rgba(245,166,35,0.35)' : '#fde047',
          }
        ]}>
          <Text style={{ fontSize: 44 }}>🎁</Text>
        </View>

        <Text style={[styles.title, { color: isDark ? '#ffffff' : '#0f172a' }]}>
          Campus Rewards
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          No rewards available right now. Exciting rewards and scratch perks will be unlocked here after you complete campus rides!
        </Text>

        <View style={[
          styles.badgeCard,
          {
            backgroundColor: isDark ? '#111827' : '#ffffff',
            borderColor: isDark ? '#1f2937' : '#e2e8f0',
          }
        ]}>
          <Text style={{ fontSize: 18 }}>✨</Text>
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>
            New awards will be unlocked soon
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
    marginBottom: 28,
  },
  badgeCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
});
