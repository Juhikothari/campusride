// campusride-mobile/src/screens/admin/AdminUsersScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Alert, Modal, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../services/api';

export function AdminUsersScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [suspendModal, setSuspendModal] = useState(null);
  const [suspendDuration, setSuspendDuration] = useState('24'); // hours

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/users', {
        params: { search, role: roleFilter, page, limit: 30 }
      });
      const list = res.data?.users || (Array.isArray(res.data) ? res.data : []);
      setUsers(list);
    } catch (err) {
      console.warn('loadUsers error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayTimer = setTimeout(() => {
      loadUsers();
    }, 250);
    return () => clearTimeout(delayTimer);
  }, [search, roleFilter, page]);

  const handleBlock = async (userId, currentlyBlocked) => {
    const action = currentlyBlocked ? 'unblock' : 'block';
    Alert.alert(
      `${currentlyBlocked ? 'Unblock' : 'Block'} User`,
      `Are you sure you want to ${action} this user?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          style: currentlyBlocked ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await apiClient.post(`/admin/users/${action}`, { userId });
              loadUsers();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  const handleSuspend = async (userId, hours) => {
    try {
      await apiClient.post('/admin/users/suspend', {
        userId,
        hours,
        suspendUntil: new Date(Date.now() + hours * 3600000).toISOString(),
        reason: 'Policy violation'
      });
      setSuspendModal(null);
      loadUsers();
      Alert.alert('Suspended', `User suspended for ${hours} hours.`);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDelete = async (userId, name) => {
    Alert.alert(
      'Delete User',
      `Permanently delete ${name}? All associated bookings and rides will also be removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/admin/users/${userId}`);
              loadUsers();
              Alert.alert('Deleted', 'User account permanently removed.');
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerBadge}>COMMUNITY ACCESS</Text>
          <Text style={styles.headerTitle}>User Management</Text>
        </View>

        {/* Search */}
        <TextInput
          style={styles.search}
          placeholder="Search by name, phone, college..."
          placeholderTextColor="#6e7681"
          value={search}
          onChangeText={setSearch}
        />

        {/* Role Filter */}
        <View style={styles.filterRow}>
          {['all', 'student', 'provider', 'admin'].map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, roleFilter === r && styles.chipActive]}
              onPress={() => setRoleFilter(r)}
            >
              <Text style={[styles.chipText, roleFilter === r && styles.chipTextActive]}>
                {r.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={users}
          keyExtractor={u => u._id || u.id}
          refreshing={loading}
          onRefresh={loadUsers}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No users found matching query.</Text>
            </View>
          }
          renderItem={({ item: u }) => {
            const isSuspended = u.suspendedUntil && new Date(u.suspendedUntil) > new Date();
            const blocked = !!(u.isBlocked || u.blocked);

            return (
              <View style={styles.userCard}>
                <View style={styles.userInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={styles.userName}>{u.name}</Text>
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>{u.role}</Text>
                    </View>
                  </View>
                  <Text style={styles.userSub}>📞 {u.phone || 'No phone'} · 🏫 {u.collegeName || u.college || '—'}</Text>
                  <Text style={styles.userMeta}>
                    KYC: <Text style={{ color: u.kycStatus === 'approved' ? '#2dd4a0' : '#f59e0b' }}>{u.kycStatus}</Text>
                    {' · '}Rides: {u.totalRides ?? 0}
                    {blocked ? ' · 🚫 BLOCKED' : ''}
                    {isSuspended ? ` · ⏸ Suspended till ${new Date(u.suspendedUntil).toLocaleDateString('en-IN')}` : ''}
                  </Text>
                </View>

                <View style={styles.userActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, blocked ? styles.unblockBtn : styles.blockBtn]}
                    onPress={() => handleBlock(u._id || u.id, blocked)}
                  >
                    <Text style={blocked ? styles.unblockText : styles.blockText}>
                      {blocked ? 'Unblock' : 'Block'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.suspendBtn]}
                    onPress={() => setSuspendModal(u)}
                  >
                    <Text style={styles.suspendText}>Suspend</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => handleDelete(u._id || u.id, u.name)}
                  >
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />

        {/* Suspend Modal */}
        <Modal visible={!!suspendModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Timed Suspension</Text>
              <Text style={styles.modalSub}>
                Temporarily restrict {suspendModal?.name} from booking or offering rides:
              </Text>

              <View style={styles.durationGrid}>
                {['1', '6', '24', '72', '168'].map(h => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.durationBtn, suspendDuration === h && styles.durationBtnActive]}
                    onPress={() => setSuspendDuration(h)}
                  >
                    <Text style={[styles.durationText, suspendDuration === h && styles.durationTextActive]}>
                      {h === '1' ? '1 hour' : h === '168' ? '7 days' : `${h} hours`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => handleSuspend(suspendModal?._id || suspendModal?.id, parseInt(suspendDuration))}
              >
                <Text style={styles.confirmBtnText}>Confirm Suspension</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setSuspendModal(null)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
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
    padding: 16,
  },
  header: {
    marginBottom: 12,
    paddingTop: 4,
  },
  headerBadge: {
    color: '#2dd4a0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  search: {
    backgroundColor: '#161b22',
    color: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#30363d',
    fontSize: 14,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  chipActive: {
    backgroundColor: 'rgba(45,212,160,0.15)',
    borderColor: '#2dd4a0',
  },
  chipText: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#2dd4a0',
    fontWeight: '800',
  },
  listContent: {
    paddingBottom: 20,
  },
  userCard: {
    backgroundColor: '#0d1117',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#21262d',
    padding: 14,
    marginBottom: 10,
  },
  userInfo: {
    marginBottom: 10,
  },
  userName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  roleBadge: {
    backgroundColor: '#161b22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  roleBadgeText: {
    color: '#8b949e',
    fontSize: 10,
    fontWeight: '700',
  },
  userSub: {
    color: '#8b949e',
    fontSize: 12,
    marginTop: 4,
  },
  userMeta: {
    color: '#6e7681',
    fontSize: 11,
    marginTop: 4,
  },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#161b22',
    paddingTop: 10,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  blockBtn: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  unblockBtn: {
    borderColor: '#2dd4a0',
    backgroundColor: 'rgba(45,212,160,0.1)',
  },
  blockText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  unblockText: {
    color: '#2dd4a0',
    fontSize: 11,
    fontWeight: '700',
  },
  suspendBtn: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  suspendText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteBtn: {
    borderColor: '#6e7681',
    backgroundColor: '#161b22',
  },
  deleteText: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8b949e',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#0d1117',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#30363d',
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSub: {
    color: '#8b949e',
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 18,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  durationBtn: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#161b22',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
  },
  durationBtnActive: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: '#f59e0b',
  },
  durationText: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '700',
  },
  durationTextActive: {
    color: '#f59e0b',
    fontWeight: '800',
  },
  confirmBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmBtnText: {
    color: '#07090d',
    fontSize: 13,
    fontWeight: '800',
  },
  cancelBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelText: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
  },
});
