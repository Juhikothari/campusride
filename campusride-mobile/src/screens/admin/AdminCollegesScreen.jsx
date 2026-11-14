// campusride-mobile/src/screens/admin/AdminCollegesScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, Alert as RNAlert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdminHeader } from '../../components/admin/AdminHeader';
import * as api from '../../services/api';
import { colors, spacing, radius } from '../../theme';
import SteelDustbin from '../../components/SteelDustbin';

export function AdminCollegesScreen({ navigation }) {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state for approving/standardizing a college
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPending, setSelectedPending] = useState(null);
  const [stdName, setStdName] = useState('');
  const [stdShort, setStdShort] = useState('');
  const [stdCity, setStdCity] = useState('Bengaluru');
  const [submitting, setSubmitting] = useState(false);

  // Modal for adding a new college from scratch
  const [isAddMode, setIsAddMode] = useState(false);

  const fetchColleges = async () => {
    try {
      const res = await api.getPendingColleges();
      setPending(res?.pending || []);
      setApproved(res?.approved || []);
    } catch (err) {
      RNAlert.alert('Error', err.message || 'Failed to load college directory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchColleges();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchColleges();
  };

  const handleOpenApproveModal = (item) => {
    setIsAddMode(false);
    setSelectedPending(item);
    setStdName(item.name || '');
    setStdShort(item.short || (item.name ? item.name.split(' ')[0].toUpperCase() : ''));
    setStdCity(item.city || 'Bengaluru');
    setModalVisible(true);
  };

  const handleOpenAddModal = () => {
    setIsAddMode(true);
    setSelectedPending(null);
    setStdName('');
    setStdShort('');
    setStdCity('Bengaluru');
    setModalVisible(true);
  };

  const handleSaveCollege = async () => {
    if (!stdName.trim()) {
      RNAlert.alert('Validation Error', 'Please enter a standardized college name.');
      return;
    }
    setSubmitting(true);
    try {
      if (isAddMode) {
        await api.addAdminCollege({
          name: stdName.trim(),
          short: stdShort.trim().toUpperCase(),
          city: stdCity.trim(),
        });
        RNAlert.alert('College Added', `"${stdName.trim()}" has been added to the official college dropdown.`);
      } else {
        const res = await api.approveCollege({
          collegeId: selectedPending?._id,
          rawName: selectedPending?.rawRequestedName || selectedPending?.name,
          standardizedName: stdName.trim(),
          short: stdShort.trim().toUpperCase(),
          city: stdCity.trim(),
        });
        RNAlert.alert(
          'College Approved',
          `"${stdName.trim()}" is now approved! ${res?.updatedStudents ?? 1} student account(s) have been updated to this standardized name.`
        );
      }
      setModalVisible(false);
      fetchColleges();
    } catch (err) {
      RNAlert.alert('Operation Failed', err.message || 'Failed to save college');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveApprovedCollege = (item) => {
    RNAlert.alert(
      'Remove College',
      `Are you sure you want to remove "${item.name}" from the approved college dropdown?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              if (item._id) {
                await api.deleteAdminCollege(item._id);
              }
              setApproved(prev => prev.filter(c => (c._id ? c._id !== item._id : c.name !== item.name)));
              RNAlert.alert('College Removed', `"${item.name}" was removed from the approved directory.`);
              fetchColleges();
            } catch (err) {
              RNAlert.alert('Error', err.message || 'Failed to remove college');
            }
          }
        }
      ]
    );
  };

  const handleCancelPendingRequest = (item) => {
    RNAlert.alert(
      'Cancel College Request',
      `Cancel and dismiss the custom request for "${item.name}"?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            try {
              if (item._id) {
                await api.deleteAdminCollege(item._id);
              }
              setPending(prev => prev.filter(p => (p._id ? p._id !== item._id : p.name !== item.name)));
              RNAlert.alert('Request Cancelled', `The request for "${item.name}" has been dismissed.`);
              fetchColleges();
            } catch (err) {
              RNAlert.alert('Error', err.message || 'Failed to cancel request');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AdminHeader
        badge="COLLEGE DIRECTORY"
        title="College Approvals"
        subtitle="Review user-added colleges & standardize names for campus matching"
        rightElement={
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenAddModal} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>+ Add College</Text>
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={{ color: colors.text3, marginTop: 12, fontSize: 13 }}>Loading college requests…</Text>
        </View>
      ) : (
        <FlatList
          style={styles.container}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2dd4a0" />}
          data={pending}
          keyExtractor={(item, index) => item._id || String(index)}
          ListHeaderComponent={
            <View style={{ marginBottom: 16 }}>
              <View style={styles.bannerBox}>
                <Text style={{ fontSize: 20 }}>🏫</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerTitle}>College Standardization System</Text>
                  <Text style={styles.bannerSub}>
                    When students type a custom college name, approve & standardize it here. All students from that college will be updated to the same standardized name so they can commute together.
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>
                PENDING USER REQUESTS ({pending.length})
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>✅</Text>
              <Text style={{ color: '#edf0f7', fontSize: 15, fontWeight: '700' }}>No Pending College Requests</Text>
              <Text style={{ color: colors.text3, fontSize: 12, textAlign: 'center', marginTop: 4, maxWidth: 280 }}>
                All user-submitted colleges have been approved and standardized.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.collegeName}>{item.name}</Text>
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>PENDING REVIEW</Text>
                    </View>
                  </View>
                  {item.requestedByName ? (
                    <Text style={styles.subDetail}>
                      👤 Added by: {item.requestedByName} ({item.requestedByEmail || 'User'})
                    </Text>
                  ) : null}
                  <Text style={styles.studentCount}>
                    🎓 {item.studentCount || 1} student(s) currently registered with this name
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.actionBtn, { flex: 2 }]}
                  onPress={() => handleOpenApproveModal(item)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnText}>⚡ Approve & Add to Dropdown →</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelActionBtn}
                  onPress={() => handleCancelPendingRequest(item)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelActionBtnText}>✕ Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListFooterComponent={
            approved.length > 0 ? (
              <View style={{ marginTop: 24 }}>
                <Text style={styles.sectionTitle}>APPROVED DIRECTORY ({approved.length})</Text>
                {approved.slice(0, 30).map((c, i) => (
                  <View key={c._id || i} style={styles.approvedRow}>
                    <Text style={{ color: '#2dd4a0', fontSize: 14 }}>✓</Text>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={{ color: '#edf0f7', fontSize: 13, fontWeight: '700' }}>{c.name}</Text>
                      <Text style={{ color: colors.text3, fontSize: 11 }}>📍 {c.city || 'Bengaluru'} ({c.short || '—'})</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.removeApprovedBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                      onPress={() => handleRemoveApprovedCollege(c)}
                      activeOpacity={0.7}
                    >
                      <SteelDustbin size={12} />
                      <Text style={styles.removeApprovedBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null
          }
        />
      )}

      {/* Standardize & Approve Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isAddMode ? '➕ Add College to Dropdown' : '⚡ Standardize & Approve'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 4 }}>
                <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              {isAddMode
                ? 'Enter the official college name. It will immediately appear in the registration dropdown for all students.'
                : 'Define the official standardized college name. All students who registered with this custom name will be automatically updated!'}
            </Text>

            <Text style={styles.inputLabel}>OFFICIAL STANDARDIZED NAME *</Text>
            <TextInput
              style={styles.input}
              value={stdName}
              onChangeText={setStdName}
              placeholder="e.g. RNS Institute of Technology (RNSIT)"
              placeholderTextColor={colors.text3}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>SHORT CODE</Text>
                <TextInput
                  style={styles.input}
                  value={stdShort}
                  onChangeText={setStdShort}
                  placeholder="e.g. RNSIT"
                  placeholderTextColor={colors.text3}
                  autoCapitalize="characters"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>CITY</Text>
                <TextInput
                  style={styles.input}
                  value={stdCity}
                  onChangeText={setStdCity}
                  placeholder="e.g. Bengaluru"
                  placeholderTextColor={colors.text3}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={submitting}
              >
                <Text style={{ color: '#edf0f7', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSaveCollege}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={{ color: '#000', fontWeight: '800' }}>
                    {isAddMode ? 'Add College ✓' : 'Approve & Update Students ✓'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  bannerBox: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  bannerTitle: {
    color: '#00E5FF',
    fontSize: 13,
    fontWeight: '800',
  },
  bannerSub: {
    color: '#8b96b0',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  sectionTitle: {
    color: '#8b96b0',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#0e121a',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#1c2638',
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  collegeName: {
    color: '#edf0f7',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  pendingBadge: {
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    borderWidth: 1,
    borderColor: '#f5a623',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingBadgeText: {
    color: '#f5a623',
    fontSize: 9.5,
    fontWeight: '800',
  },
  subDetail: {
    color: colors.text3,
    fontSize: 11,
    marginTop: 4,
  },
  studentCount: {
    color: '#2dd4a0',
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 4,
  },
  actionBtn: {
    backgroundColor: '#2dd4a0',
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#000000',
    fontSize: 12.5,
    fontWeight: '800',
  },
  cancelActionBtn: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelActionBtnText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '800',
  },
  removeApprovedBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  removeApprovedBtnText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#0e121a',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#1c2638',
    padding: 24,
    alignItems: 'center',
    marginVertical: 12,
  },
  approvedRow: {
    backgroundColor: '#0e121a',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#1c2638',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  addBtn: {
    backgroundColor: '#2dd4a0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  addBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#0e121a',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#26344d',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  modalDesc: {
    color: '#8b96b0',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
  inputLabel: {
    color: '#8b96b0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#162235',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#26344d',
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#162235',
    borderWidth: 1,
    borderColor: '#26344d',
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#2dd4a0',
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
});

export default AdminCollegesScreen;
