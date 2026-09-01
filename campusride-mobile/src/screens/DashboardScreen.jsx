import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../theme';

const QUICK_ACTIONS = [
  { key: 'SearchRides',      icon: '🔍', title: 'Find a Ride',   sub: 'Match with commuters on your route',         role: 'seeker'   },
  { key: 'CreateRide',       icon: '🚗', title: 'Offer a Ride',  sub: 'Post your route and split the cost',         role: 'provider' },
  { key: 'Community',        icon: '💬', title: 'Community',     sub: 'Posts, chat and campus alerts',              role: 'all'      },
  { key: 'WalkTogether',     icon: '🚶', title: 'Walk Together', sub: 'Find someone walking the same campus route', role: 'all'      },
];

const SECONDARY_ACTIONS = [
  { key: 'MyBookings',       icon: '📋', title: 'My Bookings',   role: 'seeker'   },
  { key: 'ProviderBookings', icon: '📬', title: 'Ride Requests', role: 'provider' },
  { key: 'RouteAlerts',      icon: '🔔', title: 'Route Alerts',  role: 'all'      },
  { key: 'LiveTracking',     icon: '📍', title: 'Live Tracking', role: 'all'      },
  { key: 'IncidentReport',   icon: '⚠️', title: 'Report Incident', role: 'all'   },
];

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();

  const isProvider = user?.role === 'provider' || user?.role === 'both';
  const isSeeker   = user?.role === 'seeker'   || user?.role === 'both';
  const isAdmin    = user?.role === 'admin';

  const canShow = (role) => {
    if (role === 'all') return true;
    if (role === 'seeker'   && isSeeker)   return true;
    if (role === 'provider' && isProvider) return true;
    return false;
  };

  const firstName = user?.name?.split(' ')[0] || 'Welcome';
  const college   = user?.college
    ? user.college.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroBg} />
          <Text style={styles.heroGreeting}>Hey, {firstName} 👋</Text>
          {college ? <Text style={styles.heroCollege}>{college}</Text> : null}
          {isAdmin && <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>Admin</Text></View>}
        </View>

        {/* Admin shortcut */}
        {isAdmin && (
          <TouchableOpacity style={styles.adminCard} onPress={() => navigation.navigate('AdminDashboard')}>
            <Text style={{ fontSize: 20 }}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '700' }}>Admin Dashboard</Text>
              <Text style={{ color: colors.text2, fontSize: 12 }}>Manage users, KYC, rides</Text>
            </View>
            <Text style={{ color: colors.accent, fontSize: 18 }}>→</Text>
          </TouchableOpacity>
        )}

        {/* Primary actions */}
        <Text style={styles.sectionLabel}>What do you need?</Text>
        {QUICK_ACTIONS.filter(a => canShow(a.role)).map(action => (
          <TouchableOpacity
            key={action.key}
            style={styles.actionCard}
            onPress={() => navigation.navigate(action.key)}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>{action.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionSub}>{action.sub}</Text>
            </View>
            <Text style={styles.actionArrow}>→</Text>
          </TouchableOpacity>
        ))}

        {/* Secondary grid */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Quick Access</Text>
        <View style={styles.grid}>
          {SECONDARY_ACTIONS.filter(a => canShow(a.role)).map(action => (
            <TouchableOpacity
              key={action.key + action.title}
              style={styles.gridItem}
              onPress={() => navigation.navigate(action.key)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 24, marginBottom: 6 }}>{action.icon}</Text>
              <Text style={styles.gridItemText}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer tagline */}
        <Text style={styles.tagline}>The OS for daily commuting in Indian cities</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 32 },

  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    marginBottom: spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  heroBg: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.accentGlow,
  },
  heroGreeting: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 4 },
  heroCollege:  { color: colors.text2, fontSize: 13 },
  adminBadge:   { marginTop: 8, backgroundColor: colors.accentDim, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.accent + '44' },
  adminBadgeText: { color: colors.accent, fontSize: 11, fontWeight: '700' },

  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent + '44',
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: spacing.md,
  },

  sectionLabel: {
    color: colors.text2,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },

  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'rgba(245,166,35,0.20)',
    borderRadius: radius.xl,
    padding: 18,
    marginBottom: 10,
  },
  actionIcon:  { fontSize: 26 },
  actionTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  actionSub:   { color: colors.text2, fontSize: 12, lineHeight: 17 },
  actionArrow: { color: colors.text3, fontSize: 18 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.md },
  gridItem: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    alignItems: 'center',
    width: '47%',
  },
  gridItemText: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },

  tagline: {
    color: colors.text3,
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
});
