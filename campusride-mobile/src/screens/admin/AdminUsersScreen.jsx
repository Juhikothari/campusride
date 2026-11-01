// campusride-mobile/src/screens/admin/AdminUsersScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Alert, Modal, StyleSheet, ActivityIndicator, Image,
  ScrollView, Linking, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../services/api';
import { AdminHeader } from '../../components/admin/AdminHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function formatDate(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    const hours = String(dt.getHours()).padStart(2, '0');
    const mins = String(dt.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch {
    return String(d);
  }
}

export function AdminUsersScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [suspendModal, setSuspendModal] = useState(null);
  const [suspendDuration, setSuspendDuration] = useState('24'); // hours
  const [selectedUser, setSelectedUser] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null); // { title: '', uri: '' }

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
              if (selectedUser && (selectedUser._id === userId || selectedUser.id === userId)) {
                setSelectedUser(prev => prev ? { ...prev, isBlocked: !currentlyBlocked, blocked: !currentlyBlocked } : null);
              }
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
      if (selectedUser && (selectedUser._id === userId || selectedUser.id === userId)) {
        setSelectedUser(prev => prev ? { ...prev, suspendedUntil: new Date(Date.now() + hours * 3600000).toISOString() } : null);
      }
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
              if (selectedUser && (selectedUser._id === userId || selectedUser.id === userId)) {
                setSelectedUser(null);
              }
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

  const openDoc = (title, uri) => {
    if (!uri) return;
    setPreviewDoc({ title, uri });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header with Top-Right 3-Lines Menu */}
        <AdminHeader
          badge="COMMUNITY ACCESS"
          title="User Management"
        />

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
                <TouchableOpacity
                  style={styles.userInfo}
                  onPress={() => setSelectedUser(u)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                      <Text style={styles.userName}>{u.name}</Text>
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleBadgeText}>{u.role}</Text>
                      </View>
                    </View>
                    <Text style={styles.tapDetailHint}>Details ➔</Text>
                  </View>
                  <Text style={styles.userSub}>📞 {u.phone || 'No phone'} · 🎓 {u.collegeName || u.college || '—'}</Text>
                  <Text style={styles.userMeta}>
                    KYC: <Text style={{ color: u.kycStatus === 'approved' ? '#2dd4a0' : '#f59e0b', fontWeight: '700' }}>{u.kycStatus || 'not_submitted'}</Text>
                    {' · '}Rides: {u.totalRides ?? 0}
                    {u.usn ? ` · USN: ${u.usn}` : ''}
                    {blocked ? ' · 🚫 BLOCKED' : ''}
                    {isSuspended ? ` · ⏳ Suspended till ${new Date(u.suspendedUntil).toLocaleDateString('en-IN')}` : ''}
                  </Text>
                </TouchableOpacity>

                <View style={styles.userActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.viewDetailsBtn]}
                    onPress={() => setSelectedUser(u)}
                  >
                    <Text style={styles.viewDetailsBtnText}>👁️ View Details</Text>
                  </TouchableOpacity>

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

        {/* ════════ USER DETAILS & UPLOADED DOCS FULL MODAL ════════ */}
        <Modal visible={!!selectedUser} animationType="slide" transparent={false}>
          <SafeAreaView style={styles.detailSafe}>
            <View style={styles.detailHeaderBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailBadge}>COMMUTER ACCOUNT & UPLOADED DOCUMENTS</Text>
                <Text style={styles.detailTitle} numberOfLines={1}>{selectedUser?.name}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedUser(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={true}>
              {/* Profile Card */}
              <View style={styles.detailSectionCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  {selectedUser?.selfieUrl || selectedUser?.profilePhoto ? (
                    <TouchableOpacity onPress={() => openDoc('Profile Photo', selectedUser.selfieUrl || selectedUser.profilePhoto)}>
                      <Image
                        source={{ uri: selectedUser.selfieUrl || selectedUser.profilePhoto }}
                        style={styles.avatarImg}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarPlaceholderText}>
                        {(selectedUser?.name?.charAt(0) || 'U').toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailNameText}>{selectedUser?.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <View style={styles.roleBadgeLg}>
                        <Text style={styles.roleBadgeLgText}>{selectedUser?.role?.toUpperCase()}</Text>
                      </View>
                      <View style={[
                        styles.kycStatusBadge,
                        selectedUser?.kycStatus === 'approved' ? styles.kycApproved :
                        selectedUser?.kycStatus === 'rejected' ? styles.kycRejected : styles.kycPending
                      ]}>
                        <Text style={styles.kycBadgeText}>
                          KYC: {(selectedUser?.kycStatus || 'NOT SUBMITTED').toUpperCase()}
                        </Text>
                      </View>
                      {selectedUser?.isBlocked && (
                        <View style={styles.blockedBadge}>
                          <Text style={styles.blockedBadgeText}>BLOCKED</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Account details table */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>🎓 College / Campus:</Text>
                  <Text style={styles.detailValue}>{selectedUser?.collegeName || selectedUser?.college || '—'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>🪪 USN (Student ID):</Text>
                  <Text style={[styles.detailValue, { color: '#f5a623', fontWeight: '800' }]}>{selectedUser?.usn || 'STUDENT'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>📞 Mobile Number:</Text>
                  {selectedUser?.phone ? (
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${selectedUser.phone}`)}>
                      <Text style={[styles.detailValue, { color: '#2dd4a0', textDecorationLine: 'underline' }]}>
                        {selectedUser.phone} ↗
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.detailValue}>Not provided</Text>
                  )}
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>✉️ Email Address:</Text>
                  {selectedUser?.email ? (
                    <TouchableOpacity onPress={() => Linking.openURL(`mailto:${selectedUser.email}`)}>
                      <Text style={[styles.detailValue, { color: '#4fa3e0', textDecorationLine: 'underline' }]}>
                        {selectedUser.email} ↗
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.detailValue}>Not provided</Text>
                  )}
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>🚻 Gender:</Text>
                  <Text style={styles.detailValue}>{selectedUser?.gender || 'Prefer not to say'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>🚨 Emergency Contact:</Text>
                  {selectedUser?.emergencyContact ? (
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${selectedUser.emergencyContact}`)}>
                      <Text style={[styles.detailValue, { color: '#ef4444', fontWeight: '700', textDecorationLine: 'underline' }]}>
                        {selectedUser.emergencyContact} ↗
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.detailValue}>Not provided</Text>
                  )}
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>📅 Account Created:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedUser?.createdAt)}</Text>
                </View>
              </View>

              {/* Uploaded Documents Section */}
              <View style={styles.detailSectionCard}>
                <Text style={styles.sectionHeaderTitle}>📄 KYC DOCUMENTS UPLOADED</Text>
                <Text style={styles.sectionHeaderSub}>
                  Files uploaded by student during registration or verification:
                </Text>

                {/* 1. Profile Selfie */}
                <View style={styles.docItemCard}>
                  <View style={styles.docHeaderRow}>
                    <Text style={styles.docTitle}>📸 1. Front Camera Selfie / Profile Photo</Text>
                    <Text style={selectedUser?.selfieUrl || selectedUser?.profilePhoto ? styles.docUploadedText : styles.docMissingText}>
                      {selectedUser?.selfieUrl || selectedUser?.profilePhoto ? '✓ Uploaded' : '✕ Missing'}
                    </Text>
                  </View>
                  {selectedUser?.selfieUrl || selectedUser?.profilePhoto ? (
                    <TouchableOpacity
                      onPress={() => openDoc('Front Selfie', selectedUser.selfieUrl || selectedUser.profilePhoto)}
                      style={styles.docImgWrap}
                      activeOpacity={0.85}
                    >
                      <Image
                        source={{ uri: selectedUser.selfieUrl || selectedUser.profilePhoto }}
                        style={styles.docThumbnail}
                        resizeMode="cover"
                      />
                      <View style={styles.docOverlayBtn}>
                        <Text style={styles.docOverlayText}>🔍 View Full Size</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.noDocDesc}>No selfie photo uploaded</Text>
                  )}
                </View>

                {/* 2. College ID Card */}
                <View style={styles.docItemCard}>
                  <View style={styles.docHeaderRow}>
                    <Text style={styles.docTitle}>🎓 2. College Student ID Card</Text>
                    <Text style={selectedUser?.collegeIdUrl ? styles.docUploadedText : styles.docMissingText}>
                      {selectedUser?.collegeIdUrl ? '✓ Uploaded' : '✕ Missing'}
                    </Text>
                  </View>
                  {selectedUser?.collegeIdUrl ? (
                    <TouchableOpacity
                      onPress={() => openDoc('College ID Card', selectedUser.collegeIdUrl)}
                      style={styles.docImgWrap}
                      activeOpacity={0.85}
                    >
                      <Image
                        source={{ uri: selectedUser.collegeIdUrl }}
                        style={styles.docThumbnail}
                        resizeMode="cover"
                      />
                      <View style={styles.docOverlayBtn}>
                        <Text style={styles.docOverlayText}>🔍 View Full Size</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.noDocDesc}>No college ID card uploaded</Text>
                  )}
                </View>

                {/* 3. Aadhaar Card */}
                <View style={styles.docItemCard}>
                  <View style={styles.docHeaderRow}>
                    <Text style={styles.docTitle}>🪪 3. Government Aadhaar Document</Text>
                    <Text style={selectedUser?.aadhaarUrl ? styles.docUploadedText : styles.docMissingText}>
                      {selectedUser?.aadhaarUrl ? '✓ Uploaded' : '✕ Missing'}
                    </Text>
                  </View>
                  {selectedUser?.aadhaarUrl ? (
                    <TouchableOpacity
                      onPress={() => openDoc('Aadhaar Document', selectedUser.aadhaarUrl)}
                      style={styles.docImgWrap}
                      activeOpacity={0.85}
                    >
                      <Image
                        source={{ uri: selectedUser.aadhaarUrl }}
                        style={styles.docThumbnail}
                        resizeMode="cover"
                      />
                      <View style={styles.docOverlayBtn}>
                        <Text style={styles.docOverlayText}>🔍 View Full Size</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.noDocDesc}>No Aadhaar document uploaded</Text>
                  )}
                </View>

                {/* 4. Driving License */}
                <View style={styles.docItemCard}>
                  <View style={styles.docHeaderRow}>
                    <Text style={styles.docTitle}>🪪 4. Driving License (Driver / Provider)</Text>
                    <Text style={selectedUser?.drivingLicenseUrl ? styles.docUploadedText : styles.docMissingText}>
                      {selectedUser?.drivingLicenseUrl ? '✓ Uploaded' : '✕ Not Uploaded'}
                    </Text>
                  </View>
                  {selectedUser?.drivingLicenseUrl ? (
                    <TouchableOpacity
                      onPress={() => openDoc('Driving License', selectedUser.drivingLicenseUrl)}
                      style={styles.docImgWrap}
                      activeOpacity={0.85}
                    >
                      <Image
                        source={{ uri: selectedUser.drivingLicenseUrl }}
                        style={styles.docThumbnail}
                        resizeMode="cover"
                      />
                      <View style={styles.docOverlayBtn}>
                        <Text style={styles.docOverlayText}>🔍 View Full Size</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.noDocDesc}>
                      {selectedUser?.role === 'seeker' ? 'Not required for Passenger accounts' : 'No driving license uploaded'}
                    </Text>
                  )}
                </View>

                {/* 5. Vehicle Photo */}
                {selectedUser?.vehiclePhotoUrl ? (
                  <View style={styles.docItemCard}>
                    <View style={styles.docHeaderRow}>
                      <Text style={styles.docTitle}>🚗 5. Vehicle Photo</Text>
                      <Text style={styles.docUploadedText}>✓ Uploaded</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => openDoc('Vehicle Photo', selectedUser.vehiclePhotoUrl)}
                      style={styles.docImgWrap}
                      activeOpacity={0.85}
                    >
                      <Image
                        source={{ uri: selectedUser.vehiclePhotoUrl }}
                        style={styles.docThumbnail}
                        resizeMode="cover"
                      />
                      <View style={styles.docOverlayBtn}>
                        <Text style={styles.docOverlayText}>🔍 View Full Size</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>

              {/* Registered Vehicles Section */}
              <View style={styles.detailSectionCard}>
                <Text style={styles.sectionHeaderTitle}>🚗 REGISTERED VEHICLES</Text>
                {selectedUser?.vehicleNumber || (selectedUser?.vehicles && selectedUser.vehicles.length > 0) ? (
                  <View style={{ gap: 8, marginTop: 8 }}>
                    {(selectedUser.vehicles && selectedUser.vehicles.length > 0
                      ? selectedUser.vehicles
                      : [{
                          vehicleNumber: selectedUser.vehicleNumber,
                          vehicleName: selectedUser.vehicleName,
                          vehicleType: selectedUser.vehicleType,
                          status: selectedUser.vehicleStatus,
                        }]
                    ).map((v, idx) => (
                      <View key={idx} style={styles.vehCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.vehName}>{v.vehicleName || 'Vehicle'} · {(v.vehicleType || 'car').toUpperCase()}</Text>
                          <Text style={styles.vehPlate}>{v.vehicleNumber || 'No plate'}</Text>
                        </View>
                        <View style={[
                          styles.vehStatusBadge,
                          v.status === 'approved' ? styles.vehStatusApproved : styles.vehStatusPending
                        ]}>
                          <Text style={styles.vehStatusText}>
                            {(v.status || 'pending').toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noDocDesc}>No vehicle registered for this commuter.</Text>
                )}
              </View>

              {/* Actions Footer inside Modal */}
              <View style={{ gap: 10, marginTop: 6, marginBottom: 40 }}>
                <TouchableOpacity
                  style={[styles.bigActionBtn, selectedUser?.isBlocked ? styles.unblockBtnLg : styles.blockBtnLg]}
                  onPress={() => handleBlock(selectedUser?._id || selectedUser?.id, selectedUser?.isBlocked)}
                >
                  <Text style={styles.bigActionBtnText}>
                    {selectedUser?.isBlocked ? '✓ Unblock Commuter Account' : '🚫 Block Commuter Account'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.bigActionBtn, styles.suspendBtnLg]}
                  onPress={() => {
                    const u = selectedUser;
                    setSuspendModal(u);
                  }}
                >
                  <Text style={[styles.bigActionBtnText, { color: '#f59e0b' }]}>
                    ⏳ Timed Account Suspension
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.bigActionBtn, styles.deleteBtnLg]}
                  onPress={() => handleDelete(selectedUser?._id || selectedUser?.id, selectedUser?.name)}
                >
                  <Text style={[styles.bigActionBtnText, { color: '#ef4444' }]}>
                    🗑️ Permanently Delete Account
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeModalBottomBtn}
                  onPress={() => setSelectedUser(null)}
                >
                  <Text style={styles.closeModalBottomText}>Close Details</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* ════════ FULL SCREEN DOCUMENT VIEWER MODAL ════════ */}
        <Modal visible={!!previewDoc} transparent animationType="fade">
          <View style={styles.previewBackdrop}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewTitle} numberOfLines={1}>{previewDoc?.title || 'Document Preview'}</Text>
                <TouchableOpacity
                  onPress={() => setPreviewDoc(null)}
                  style={styles.previewCloseBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.previewCloseText}>✕ Close</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.previewBody}>
                {previewDoc?.uri ? (
                  <Image
                    source={{ uri: previewDoc.uri }}
                    style={styles.fullPreviewImg}
                    resizeMode="contain"
                  />
                ) : null}
              </View>
            </SafeAreaView>
          </View>
        </Modal>

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
  tapDetailHint: {
    color: '#2dd4a0',
    fontSize: 11,
    fontWeight: '700',
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  viewDetailsBtn: {
    borderColor: '#2dd4a0',
    backgroundColor: 'rgba(45,212,160,0.12)',
  },
  viewDetailsBtnText: {
    color: '#2dd4a0',
    fontSize: 11,
    fontWeight: '800',
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
    color: '#000000',
    fontWeight: '800',
    fontSize: 14,
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelText: {
    color: '#8b949e',
    fontWeight: '600',
    fontSize: 13,
  },

  /* ════════ User Details Modal Styles ════════ */
  detailSafe: {
    flex: 1,
    backgroundColor: '#07090d',
  },
  detailHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    backgroundColor: '#0d1117',
  },
  detailBadge: {
    color: '#2dd4a0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  detailTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  detailScroll: {
    padding: 16,
  },
  detailSectionCard: {
    backgroundColor: '#0d1117',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#21262d',
    padding: 16,
    marginBottom: 16,
  },
  avatarImg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#2dd4a0',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#161b22',
    borderWidth: 1.5,
    borderColor: '#30363d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    color: '#2dd4a0',
    fontSize: 24,
    fontWeight: '800',
  },
  detailNameText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  roleBadgeLg: {
    backgroundColor: '#161b22',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  roleBadgeLgText: {
    color: '#edf0f7',
    fontSize: 11,
    fontWeight: '800',
  },
  kycStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  kycApproved: {
    backgroundColor: 'rgba(45,212,160,0.15)',
    borderColor: '#2dd4a0',
  },
  kycPending: {
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderColor: '#f5a623',
  },
  kycRejected: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: '#ef4444',
  },
  kycBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  blockedBadge: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderColor: '#ef4444',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  blockedBadgeText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '900',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#161b22',
  },
  detailLabel: {
    color: '#8b949e',
    fontSize: 13,
    fontWeight: '600',
  },
  detailValue: {
    color: '#edf0f7',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  sectionHeaderTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionHeaderSub: {
    color: '#6e7681',
    fontSize: 12,
    marginBottom: 12,
  },
  docItemCard: {
    backgroundColor: '#161b22',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#21262d',
    padding: 12,
    marginBottom: 10,
  },
  docHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  docTitle: {
    color: '#edf0f7',
    fontSize: 13,
    fontWeight: '700',
  },
  docUploadedText: {
    color: '#2dd4a0',
    fontSize: 11,
    fontWeight: '800',
  },
  docMissingText: {
    color: '#6e7681',
    fontSize: 11,
    fontWeight: '600',
  },
  docImgWrap: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#07090d',
    marginTop: 4,
  },
  docThumbnail: {
    width: '100%',
    height: '100%',
  },
  docOverlayBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2dd4a0',
  },
  docOverlayText: {
    color: '#2dd4a0',
    fontSize: 11,
    fontWeight: '800',
  },
  noDocDesc: {
    color: '#6e7681',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  vehCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#21262d',
  },
  vehName: {
    color: '#edf0f7',
    fontSize: 13,
    fontWeight: '700',
  },
  vehPlate: {
    color: '#f5a623',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  vehStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  vehStatusApproved: {
    backgroundColor: 'rgba(45,212,160,0.15)',
    borderColor: '#2dd4a0',
  },
  vehStatusPending: {
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderColor: '#f5a623',
  },
  vehStatusText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  bigActionBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  blockBtnLg: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: '#ef4444',
  },
  unblockBtnLg: {
    backgroundColor: 'rgba(45,212,160,0.15)',
    borderColor: '#2dd4a0',
  },
  suspendBtnLg: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: '#f59e0b',
  },
  deleteBtnLg: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: '#ef4444',
  },
  bigActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  closeModalBottomBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#30363d',
    marginTop: 4,
  },
  closeModalBottomText: {
    color: '#8b949e',
    fontSize: 13,
    fontWeight: '700',
  },

  /* ════════ Full Screen Image Viewer Modal ════════ */
  previewBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(13,17,23,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  previewTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    marginRight: 12,
  },
  previewCloseBtn: {
    backgroundColor: '#161b22',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  previewCloseText: {
    color: '#2dd4a0',
    fontSize: 13,
    fontWeight: '800',
  },
  previewBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  fullPreviewImg: {
    width: '100%',
    height: '100%',
  },
});
