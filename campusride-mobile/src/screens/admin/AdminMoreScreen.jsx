// campusride-mobile/src/screens/admin/AdminMoreScreen.jsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/api';

export function AdminMoreScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [exporting, setExporting] = useState(false);

  const handleExport = async (type) => {
    setExporting(true);
    try {
      const res = await apiClient.get(`/admin/export/${type}`);
      const dataStr = JSON.stringify(res.data?.data || [], null, 2);
      Alert.alert(
        'Export Generated',
        `Retrieved ${res.data?.count || 0} records for ${type}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share / Save',
            onPress: () => Share.share({ message: dataStr, title: `HOGO_${type}_Export.json` })
          }
        ]
      );
    } catch (err) {
      Alert.alert('Export Error', err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Log out of administrator session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout }
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerBadge}>ADMINISTRATION</Text>
          <Text style={styles.headerTitle}>System & Tools</Text>
          <Text style={styles.headerSub}>Logged in as {user?.name || 'Administrator'} ({user?.email})</Text>
        </View>

        {/* Section 1: Communications */}
        <Text style={styles.sectionLabel}>COMMUNICATIONS</Text>
        <View style={styles.cardGroup}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('Broadcast')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>📢</Text>
              <View>
                <Text style={styles.menuTitle}>Broadcast Notification</Text>
                <Text style={styles.menuSub}>Deliver instant push notices to students or colleges</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Section 2: Integrity & Audit */}
        <Text style={styles.sectionLabel}>COMPLIANCE & AUDIT</Text>
        <View style={styles.cardGroup}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('AuditLogs')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>🛡️</Text>
              <View>
                <Text style={styles.menuTitle}>Audit Trail Logs</Text>
                <Text style={styles.menuSub}>View ledger of all administrative decisions</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Section 3: Data Exports */}
        <Text style={styles.sectionLabel}>DATA EXPORT & BACKUPS</Text>
        <View style={styles.cardGroup}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => handleExport('users')}
            disabled={exporting}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>👥</Text>
              <View>
                <Text style={styles.menuTitle}>Export User Directory</Text>
                <Text style={styles.menuSub}>Download student accounts, KYC and phone numbers</Text>
              </View>
            </View>
            <Text style={styles.chevron}>⬇</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => handleExport('rides')}
            disabled={exporting}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>🚗</Text>
              <View>
                <Text style={styles.menuTitle}>Export Ride Ledger</Text>
                <Text style={styles.menuSub}>Download ride histories and booking metrics</Text>
              </View>
            </View>
            <Text style={styles.chevron}>⬇</Text>
          </TouchableOpacity>
        </View>

        {/* Section 4: Account Actions */}
        <Text style={styles.sectionLabel}>SESSION</Text>
        <View style={styles.cardGroup}>
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 0 }]}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>🚪</Text>
              <View>
                <Text style={[styles.menuTitle, { color: '#ef4444' }]}>Log Out of Admin</Text>
                <Text style={styles.menuSub}>Safely end administrator access</Text>
              </View>
            </View>
            <Text style={[styles.chevron, { color: '#ef4444' }]}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07090d' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 20, paddingTop: 4 },
  headerBadge: { color: '#2dd4a0', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  headerTitle: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
  headerSub: { color: '#8b949e', fontSize: 12, marginTop: 4 },
  sectionLabel: { color: '#8b949e', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8, marginTop: 12 },
  cardGroup: { backgroundColor: '#0d1117', borderRadius: 14, borderWidth: 1, borderColor: '#21262d', overflow: 'hidden', marginBottom: 12 },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  menuIcon: { fontSize: 20 },
  menuTitle: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  menuSub: { color: '#8b949e', fontSize: 11, marginTop: 2 },
  chevron: { color: '#6e7681', fontSize: 20, fontWeight: '300' },
  divider: { height: 1, backgroundColor: '#161b22', marginLeft: 46 },
});
