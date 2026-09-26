// campusride-mobile/src/screens/admin/AdminDashboardScreen.jsx
import React, { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet, RefreshControl,
  TouchableOpacity, Alert, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminStore } from '../../store/adminStore';
import { StatCard } from '../../components/admin/StatCard';
import { SimpleLineChart } from '../../components/admin/SimpleLineChart';
import { apiClient } from '../../services/api';

export function AdminDashboardScreen({ navigation }) {
  const { stats, fetchStats, loading } = useAdminStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  const handleExportData = async (type = 'users') => {
    try {
      const res = await apiClient.get(`/admin/export/${type}`);
      const dataStr = JSON.stringify(res.data?.data || [], null, 2);
      Alert.alert(
        'Data Export Ready',
        `Exported ${res.data?.count || 0} ${type} records.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share / Save',
            onPress: () => Share.share({ message: dataStr, title: `CampusRide_${type}_Export.json` })
          }
        ]
      );
    } catch (err) {
      Alert.alert('Export Failed', err.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2dd4a0" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerBadge}>CAMPUS OPERATIONS</Text>
            <Text style={styles.title}>Admin Dashboard</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Text style={styles.refreshBtnText}>⟳ Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stat Cards ─────────────────────────── */}
        <View style={styles.grid}>
          <StatCard label="Total Users"    value={stats?.totalUsers}    color="#2dd4a0" />
          <StatCard label="Active Rides"   value={stats?.activeRides}   color="#3b82f6" />
          <StatCard label="Pending KYC"    value={stats?.pendingKyc}    color="#f59e0b" />
          <StatCard label="Blocked Users"  value={stats?.blockedUsers}  color="#ef4444" />
          <StatCard label="Total Rides"    value={stats?.totalRides}    color="#8b5cf6" />
          <StatCard label="Open Incidents" value={stats?.openIncidents} color="#f97316" />
        </View>

        {/* ── Rides over last 7 days ──────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Rides — Last 7 Days</Text>
          <Text style={styles.sectionSub}>Daily ride frequency</Text>
        </View>
        <SimpleLineChart data={stats?.ridesPerDay ?? []} color="#2dd4a0" />

        {/* ── New signups over last 7 days ─────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>New Signups — Last 7 Days</Text>
          <Text style={styles.sectionSub}>Campus user onboarding</Text>
        </View>
        <SimpleLineChart data={stats?.signupsPerDay ?? []} color="#3b82f6" />

        {/* ── Quick Actions ───────────────────────── */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: '#2dd4a0' }]}
            onPress={() => navigation.navigate('More', { screen: 'Broadcast' })}
          >
            <Text style={[styles.actionText, { color: '#2dd4a0' }]}>📢 Broadcast Push</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: '#3b82f6' }]}
            onPress={() => handleExportData('users')}
          >
            <Text style={[styles.actionText, { color: '#3b82f6' }]}>⬇ Export CSV / JSON</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: '#f59e0b' }]}
            onPress={() => navigation.navigate('KYC')}
          >
            <Text style={[styles.actionText, { color: '#f59e0b' }]}>🪪 Review Pending KYC</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: '#8b5cf6' }]}
            onPress={() => navigation.navigate('More', { screen: 'AuditLogs' })}
          >
            <Text style={[styles.actionText, { color: '#8b5cf6' }]}>🛡️ View Audit Trail</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#07090d',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 8,
  },
  headerBadge: {
    color: '#2dd4a0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  refreshBtn: {
    backgroundColor: '#161b22',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  refreshBtnText: {
    color: '#2dd4a0',
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionSub: {
    color: '#8b949e',
    fontSize: 11,
    marginBottom: 6,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  actionBtn: {
    width: '48%',
    backgroundColor: '#0d1117',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
