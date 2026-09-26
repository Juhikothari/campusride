// campusride-mobile/src/screens/admin/AdminAuditLogsScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../services/api';

export function AdminAuditLogsScreen({ navigation }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/audit-logs');
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.warn('loadLogs error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const getActionColor = (action) => {
    if (action.includes('APPROVE')) return '#2dd4a0';
    if (action.includes('BLOCK') || action.includes('DELETE') || action.includes('FORCE_CANCEL')) return '#ef4444';
    if (action.includes('SUSPEND') || action.includes('REJECT')) return '#f59e0b';
    return '#3b82f6';
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 8 }}>
            <Text style={{ color: '#8b949e', fontSize: 13 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerBadge}>COMPLIANCE & INTEGRITY</Text>
          <Text style={styles.headerTitle}>Admin Audit Trail</Text>
          <Text style={styles.headerSub}>Immutable ledger of administrative decisions.</Text>
        </View>

        <FlatList
          data={logs}
          keyExtractor={l => l._id || l.id}
          onRefresh={loadLogs}
          refreshing={loading}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>📜</Text>
              <Text style={styles.emptyTitle}>No audit logs found</Text>
              <Text style={styles.emptySub}>All administrative actions will be logged here.</Text>
            </View>
          }
          renderItem={({ item: l }) => {
            const color = getActionColor(l.action || '');
            const metaStr = l.meta ? JSON.stringify(l.meta) : '';

            return (
              <View style={[styles.card, { borderLeftColor: color, borderLeftWidth: 3 }]}>
                <View style={styles.row}>
                  <Text style={[styles.actionBadge, { color }]}>{l.action}</Text>
                  <Text style={styles.timestamp}>
                    {new Date(l.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    })}
                  </Text>
                </View>

                <Text style={styles.adminInfo}>
                  By Admin: <Text style={{ color: '#ffffff', fontWeight: '700' }}>{l.adminId?.name || 'Administrator'}</Text>
                  {l.adminId?.email ? ` (${l.adminId.email})` : ''}
                </Text>

                {metaStr && metaStr !== '{}' ? (
                  <View style={styles.metaBox}>
                    <Text style={styles.metaLabel}>Details:</Text>
                    <Text style={styles.metaVal}>{metaStr}</Text>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07090d' },
  container: { flex: 1, padding: 16 },
  header: { marginBottom: 14, paddingTop: 4 },
  headerBadge: { color: '#2dd4a0', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  headerTitle: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
  headerSub: { color: '#8b949e', fontSize: 12, marginTop: 2 },
  listContent: { paddingBottom: 24 },
  card: { backgroundColor: '#0d1117', borderRadius: 10, borderWidth: 1, borderColor: '#21262d', padding: 12, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  actionBadge: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  timestamp: { color: '#6e7681', fontSize: 11 },
  adminInfo: { color: '#8b949e', fontSize: 12, marginBottom: 6 },
  metaBox: { backgroundColor: '#161b22', padding: 8, borderRadius: 6, marginTop: 4 },
  metaLabel: { color: '#8b949e', fontSize: 10, fontWeight: '700', marginBottom: 2 },
  metaVal: { color: '#c9d1d9', fontSize: 11, fontFamily: 'monospace' },
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 44, marginBottom: 8 },
  emptyTitle: { color: '#ffffff', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  emptySub: { color: '#8b949e', fontSize: 12 },
});
