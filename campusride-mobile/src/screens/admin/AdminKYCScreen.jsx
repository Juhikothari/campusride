// campusride-mobile/src/screens/admin/AdminKYCScreen.jsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, Modal, ScrollView, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../services/api';

export function AdminKYCScreen() {
  const [submissions, setSubmissions] = useState([]);
  const [filter, setFilter] = useState('pending'); // 'pending' | 'approved' | 'rejected'
  const [selected, setSelected] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadKyc();
  }, [filter]);

  const loadKyc = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/admin/kyc?status=${filter}`);
      setSubmissions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.warn('loadKyc error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    Alert.alert('Approve KYC', 'Confirm KYC approval for this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        style: 'default',
        onPress: async () => {
          try {
            await apiClient.post('/admin/kyc/approve', { userId });
            setSelected(null);
            loadKyc();
            Alert.alert('Success', 'KYC approved and verified.');
          } catch (err) {
            Alert.alert('Error', err.message || 'Approval failed');
          }
        }
      }
    ]);
  };

  const handleReject = async (userId, reason) => {
    if (!reason.trim()) {
      Alert.alert('Reason Required', 'Please provide or select a rejection reason.');
      return;
    }
    try {
      await apiClient.post('/admin/kyc/reject', { userId, reason });
      setSelected(null);
      setRejectionReason('');
      loadKyc();
      Alert.alert('Rejected', 'KYC marked as rejected and student notified.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Rejection failed');
    }
  };

  const handleRevoke = async (userId) => {
    Alert.alert('Revoke KYC', 'This will remove KYC approval. User cannot offer rides.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.post('/admin/kyc/revoke', { userId });
            loadKyc();
            Alert.alert('Revoked', 'KYC approval revoked.');
          } catch (err) {
            Alert.alert('Error', err.message || 'Revocation failed');
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerBadge}>IDENTITY & SAFETY</Text>
          <Text style={styles.headerTitle}>KYC Management</Text>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {['pending', 'approved', 'rejected'].map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.filterTab, filter === s && styles.filterTabActive]}
              onPress={() => setFilter(s)}
            >
              <Text style={[styles.filterText, filter === s && styles.filterTextActive]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={submissions}
          keyExtractor={i => i.id || i.userId}
          refreshing={loading}
          onRefresh={loadKyc}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🪪</Text>
              <Text style={styles.emptyTitle}>No {filter} KYC submissions</Text>
              <Text style={styles.emptySub}>All student verification queues are up to date.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                {item.selfieUrl ? (
                  <Image source={{ uri: item.selfieUrl }} style={styles.selfie} />
                ) : (
                  <View style={[styles.selfie, styles.selfiePlaceholder]}>
                    <Text style={{ fontSize: 20 }}>👤</Text>
                  </View>
                )}
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardSub}>🏫 {item.collegeName}</Text>
                  <Text style={styles.cardSub}>📞 {item.phone || 'No phone'}</Text>
                  <Text style={styles.cardDate}>
                    Submitted: {new Date(item.submittedAt).toLocaleDateString('en-IN')}
                  </Text>
                  {item.rejectionReason ? (
                    <Text style={styles.reasonText}>Reason: {item.rejectionReason}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() => setSelected(item)}
                >
                  <Text style={styles.viewBtnText}>🔍 View Docs</Text>
                </TouchableOpacity>

                {item.status === 'pending' && (
                  <View style={styles.pendingActions}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApprove(item.userId)}
                    >
                      <Text style={styles.btnText}>✓ Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => {
                        setSelected(item);
                        setRejectionReason('');
                      }}
                    >
                      <Text style={styles.btnText}>✗ Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {item.status === 'approved' && (
                  <TouchableOpacity
                    style={styles.revokeBtn}
                    onPress={() => handleRevoke(item.userId)}
                  >
                    <Text style={styles.revokeBtnText}>Revoke KYC</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />

        {/* Document Viewer + Reject Modal */}
        <Modal visible={!!selected} animationType="slide" transparent={false}>
          <SafeAreaView style={styles.modalSafe}>
            <ScrollView style={styles.modal} contentContainerStyle={styles.modalScroll}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{selected?.name}</Text>
                  <Text style={styles.modalSub}>{selected?.collegeName} · {selected?.phone}</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeIconBtn}
                  onPress={() => { setSelected(null); setRejectionReason(''); }}
                >
                  <Text style={styles.closeIconText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Documents */}
              <Text style={styles.docLabel}>Profile Selfie (Front-Camera)</Text>
              {selected?.selfieUrl ? (
                <Image source={{ uri: selected?.selfieUrl }} style={styles.docImage} resizeMode="contain" />
              ) : (
                <Text style={styles.noDocText}>No selfie uploaded</Text>
              )}

              <Text style={styles.docLabel}>College ID Card</Text>
              {selected?.collegeIdUrl ? (
                <Image source={{ uri: selected?.collegeIdUrl }} style={styles.docImage} resizeMode="contain" />
              ) : (
                <Text style={styles.noDocText}>No college ID card uploaded</Text>
              )}

              <Text style={styles.docLabel}>Aadhaar Card</Text>
              {selected?.aadhaarUrl ? (
                <Image source={{ uri: selected?.aadhaarUrl }} style={styles.docImage} resizeMode="contain" />
              ) : (
                <Text style={styles.noDocText}>No Aadhaar document uploaded</Text>
              )}

              {selected?.drivingLicenseUrl ? (
                <>
                  <Text style={styles.docLabel}>Driving License</Text>
                  <Image source={{ uri: selected?.drivingLicenseUrl }} style={styles.docImage} resizeMode="contain" />
                </>
              ) : null}

              {selected?.vehicleNumber ? (
                <View style={styles.vehicleBox}>
                  <Text style={styles.vehicleTitle}>🚗 Vehicle Information</Text>
                  <Text style={styles.vehicleText}>Number: {selected?.vehicleNumber}</Text>
                  <Text style={styles.vehicleText}>Name: {selected?.vehicleName} ({selected?.vehicleType || 'Car'})</Text>
                </View>
              ) : null}

              {selected?.status === 'pending' && (
                <View style={styles.decisionBlock}>
                  <Text style={styles.docLabel}>Rejection Presets (if rejecting)</Text>
                  {[
                    'Aadhaar image unclear',
                    'College ID expired',
                    'Selfie does not match ID',
                    'Documents belong to different person',
                  ].map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.preset, rejectionReason === r && styles.presetActive]}
                      onPress={() => setRejectionReason(r)}
                    >
                      <Text style={[styles.presetText, rejectionReason === r && styles.presetTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}

                  <TextInput
                    style={styles.customReasonInput}
                    placeholder="Or type custom rejection reason..."
                    placeholderTextColor="#6e7681"
                    value={rejectionReason}
                    onChangeText={setRejectionReason}
                  />

                  <View style={styles.modalActionRow}>
                    <TouchableOpacity
                      style={styles.modalApproveBtn}
                      onPress={() => handleApprove(selected.userId)}
                    >
                      <Text style={styles.btnText}>✓ Approve KYC</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalRejectBtn}
                      onPress={() => handleReject(selected.userId, rejectionReason)}
                    >
                      <Text style={styles.btnText}>✗ Reject KYC</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => { setSelected(null); setRejectionReason(''); }}
              >
                <Text style={styles.closeBtnText}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
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
    marginBottom: 14,
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    backgroundColor: '#161b22',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: 'rgba(45,212,160,0.15)',
    borderColor: '#2dd4a0',
  },
  filterText: {
    color: '#8b949e',
    fontSize: 13,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#2dd4a0',
    fontWeight: '800',
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#0d1117',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#21262d',
    padding: 14,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
  },
  selfie: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#2dd4a0',
  },
  selfiePlaceholder: {
    backgroundColor: '#161b22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  cardSub: {
    color: '#8b949e',
    fontSize: 12,
    marginBottom: 2,
  },
  cardDate: {
    color: '#6e7681',
    fontSize: 11,
    marginTop: 4,
  },
  reasonText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#161b22',
    gap: 8,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  viewBtn: {
    backgroundColor: '#161b22',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  viewBtnText: {
    color: '#c9d1d9',
    fontSize: 12,
    fontWeight: '700',
  },
  approveBtn: {
    backgroundColor: '#2dd4a0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  rejectBtn: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  revokeBtn: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  revokeBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  btnText: {
    color: '#07090d',
    fontSize: 12,
    fontWeight: '800',
  },
  modalSafe: {
    flex: 1,
    backgroundColor: '#07090d',
  },
  modal: {
    flex: 1,
    padding: 16,
  },
  modalScroll: {
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  modalSub: {
    color: '#8b949e',
    fontSize: 12,
    marginTop: 2,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161b22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  docLabel: {
    color: '#2dd4a0',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  docImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#0d1117',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  noDocText: {
    color: '#6e7681',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  vehicleBox: {
    backgroundColor: '#161b22',
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  vehicleTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  vehicleText: {
    color: '#8b949e',
    fontSize: 13,
    marginTop: 2,
  },
  decisionBlock: {
    marginTop: 20,
    backgroundColor: '#0d1117',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#21262d',
  },
  preset: {
    backgroundColor: '#161b22',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    marginBottom: 6,
  },
  presetActive: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  presetText: {
    color: '#c9d1d9',
    fontSize: 12,
  },
  presetTextActive: {
    color: '#ef4444',
    fontWeight: '700',
  },
  customReasonInput: {
    backgroundColor: '#161b22',
    color: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    padding: 10,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 12,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalApproveBtn: {
    flex: 1,
    backgroundColor: '#2dd4a0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalRejectBtn: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeBtn: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySub: {
    color: '#8b949e',
    fontSize: 12,
  },
});
