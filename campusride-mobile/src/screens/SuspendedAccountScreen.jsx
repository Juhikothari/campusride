// campusride-mobile/src/screens/SuspendedAccountScreen.jsx
// Full lockout screen shown whenever an account is suspended or blocked.
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Btn } from '../components/UI';
import { colors, spacing, radius } from '../theme';

export default function SuspendedAccountScreen() {
  const { accountRestriction, logout, refreshUser } = useAuth();
  const { isDark } = useTheme();
  const [checking, setChecking] = useState(false);

  const isBlocked = accountRestriction?.status === 'blocked';
  const title = isBlocked ? 'Account Blocked' : 'Account Suspended';
  const icon = isBlocked ? '🚫' : '⛔';
  const reason = accountRestriction?.reason || (isBlocked
    ? 'This account has been blocked by campus administrators.'
    : 'Your account is currently suspended from HOGO.');
  const until = accountRestriction?.until ? new Date(accountRestriction.until) : null;
  const untilLabel = until && !Number.isNaN(until.getTime())
    ? until.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const handleRefresh = async () => {
    setChecking(true);
    try {
      await refreshUser();
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]}>
      <View style={styles.center}>
        <View style={[styles.card, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? 'rgba(239,68,68,0.4)' : '#fca5a5' }]}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>{icon}</Text>
          </View>

          <Text style={[styles.title, { color: '#ef4444' }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: isDark ? colors.text2 : '#475569' }]}>
            {reason}
          </Text>

          {untilLabel && !isBlocked && (
            <View style={[styles.infoBox, { backgroundColor: isDark ? colors.surface2 : '#fef2f2', borderColor: isDark ? colors.border : '#fecaca' }]}>
              <Text style={[styles.infoLabel, { color: isDark ? colors.text3 : '#64748b' }]}>SUSPENDED UNTIL</Text>
              <Text style={[styles.infoValue, { color: isDark ? colors.text : '#0f172a' }]}>{untilLabel}</Text>
            </View>
          )}

          <Text style={[styles.lockNote, { color: isDark ? colors.text3 : '#64748b' }]}>
            Access to rides, bookings, community chat, notifications actions, and all HOGO features is disabled while your account is {isBlocked ? 'blocked' : 'suspended'}.
          </Text>

          <Btn
            label={checking ? 'Checking...' : 'Check Status'}
            onPress={handleRefresh}
            loading={checking}
            variant="outline"
            style={{ width: '100%', marginTop: spacing.md }}
          />
          <Btn
            label="Sign Out"
            onPress={logout}
            variant="danger"
            style={{ width: '100%', marginTop: spacing.sm }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239,68,68,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  icon: { fontSize: 36 },
  title: { fontSize: 22, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 12 },
  infoBox: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  infoValue: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  lockNote: { fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
});
