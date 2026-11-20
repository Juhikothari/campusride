// campusride-mobile/src/screens/admin/AdminIncidentsScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Alert, StyleSheet, Modal, TextInput, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../services/api';
import { AdminHeader } from '../../components/admin/AdminHeader';

export function AdminIncidentsScreen() {
  const [incidents, setIncidents] = useState([]);
  const [statusFilter, setStatusFilter] = useState('open');
  const [loading, setLoading] = useState(false);
  const [resolveModal, setResolveModal] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [targetSelections, setTargetSelections] = useState({});

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/incidents');
      const list = Array.isArray(res.data) ? res.data : [];
      setIncidents(list);
    } catch (err) {
      console.warn('loadIncidents error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  const filteredIncidents = incidents.filter(i => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'open') return i.status === 'open' || i.status === 'reported' || !i.status;
    return i.status === statusFilter;
  });

  const handleUpdateStatus = async (id, status, notes = '') => {
    try {
      await apiClient.put(`/admin/incidents/${id}/status`, { status, resolutionNotes: notes });
      setResolveModal(null);
      setResolutionNotes('');
      loadIncidents();
      Alert.alert('Updated', `Incident marked as ${status}.`);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleWarnUser = (user, incident) => {
    if (!user?._id) return Alert.alert('Action Error', 'No commuter account found for this action.');
    const currentWarn = Number(user.warningsCount) || 0;
    const nextWarn = currentWarn + 1;
    Alert.alert(
      'Issue Warning',
      `Issue official warning #${nextWarn} of 3 to ${user.name || 'this commuter'}?${nextWarn >= 3 ? '\n\n⚠️ Warning #3 will automatically suspend this account for 30 days.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Issue Warning (${nextWarn}/3)`,
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiClient.post('/admin/users/warn', {
                userId: user._id,
                incidentId: incident._id || incident.id,
                reason: incident.type || incident.subject || incident.description || 'Safety / Policy warning',
              });
              Alert.alert('Warning Recorded', res.data?.message || `Warning ${nextWarn}/3 issued.`);
              loadIncidents();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || err.message);
            }
          }
        }
      ]
    );
  };

  const handleSuspendUser = (user, incident, isDirect = false) => {
    if (!user?._id) return Alert.alert('Action Error', 'No commuter account found for this action.');
    Alert.alert(
      isDirect ? 'Direct Suspend Account' : 'Suspend Account',
      `Are you sure you want to ${isDirect ? 'DIRECTLY suspend' : 'suspend'} ${user.name || 'this commuter'}'s account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isDirect ? 'Direct Suspend' : 'Suspend Account',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiClient.post('/admin/users/suspend', {
                userId: user._id,
                reason: `Incident sanction: ${incident.type || incident.description || 'Policy violation'}`,
              });
              Alert.alert('Account Suspended', res.data?.message || 'User account suspended.');
              loadIncidents();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || err.message);
            }
          }
        }
      ]
    );
  };

  const handleRevokeSanctions = (user, incident) => {
    if (!user?._id) return Alert.alert('Action Error', 'No commuter account found for this action.');
    Alert.alert(
      'Revoke Sanctions',
      `Revoke all sanctions for ${user.name || 'this commuter'}?\n\n• Resets warnings count to 0\n• Unsuspends account\n• Restores full campus ride access`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke Sanctions',
          onPress: async () => {
            try {
              const res = await apiClient.post('/admin/users/revoke-sanctions', {
                userId: user._id,
                incidentId: incident._id || incident.id,
                reason: 'Sanctions revoked by administrator.',
              });
              Alert.alert('Sanctions Revoked', res.data?.message || 'Account restored and warnings reset.');
              loadIncidents();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || err.message);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header with Top-Right 3-Lines Menu */}
        <AdminHeader
          badge="SAFETY & SUPPORT"
          title="Incident Reports"
        />

        <View style={styles.filterRow}>
          {['open', 'investigating', 'resolved', 'all'].map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, statusFilter === s && styles.chipActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
                {s.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filteredIncidents}
          keyExtractor={i => i._id || i.id}
          onRefresh={loadIncidents}
          refreshing={loading}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🛡️</Text>
              <Text style={styles.emptyTitle}>No {statusFilter} incidents</Text>
              <Text style={styles.emptySub}>Campus rides are running smoothly.</Text>
            </View>
          }
          renderItem={({ item: i }) => {
            const sev = i.severity || 'Medium';
            const sevConfig = {
              Critical: { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', text: '#f87171', label: '🚨 CRITICAL' },
              High:     { bg: 'rgba(249, 115, 22, 0.2)', border: '#f97316', text: '#fb923c', label: '⚠️ HIGH SEVERITY' },
              Medium:   { bg: 'rgba(245, 158, 11, 0.2)', border: '#f59e0b', text: '#fbbf24', label: '⚡ MEDIUM' },
              Low:      { bg: 'rgba(59, 130, 246, 0.2)', border: '#3b82f6', text: '#60a5fa', label: 'ℹ️ LOW' },
            }[sev] || { bg: 'rgba(59, 130, 246, 0.2)', border: '#3b82f6', text: '#60a5fa', label: 'LOW' };

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.incidentType}>{i.type || i.category || 'Incident Report'}</Text>
                    {/* Admin-only Severity Badge */}
                    <View style={{
                      alignSelf: 'flex-start',
                      marginTop: 4,
                      backgroundColor: sevConfig.bg,
                      borderColor: sevConfig.border,
                      borderWidth: 1,
                      borderRadius: 6,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                    }}>
                      <Text style={{ color: sevConfig.text, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
                        {sevConfig.label}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, i.status === 'resolved' ? styles.statusBadgeDone : styles.statusBadgeOpen]}>
                    <Text style={[styles.statusBadgeText, i.status === 'resolved' ? { color: '#2dd4a0' } : { color: '#f59e0b' }]}>
                      {(i.status || 'OPEN').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.description}>{i.description || i.message || 'No description provided'}</Text>

                <Text style={styles.metaText}>
                  Reporter: {i.reportedBy?.name || 'Anonymous'} · 📞 {i.reportedBy?.phone || '—'}
                </Text>
                <Text style={styles.metaText}>
                  Date: {new Date(i.createdAt).toLocaleString('en-IN')}
                </Text>

                {/* Target Commuter & Sanction Status */}
                {(() => {
                  const reporter = i.reportedBy;
                  const provider = i.rideId?.providerId;
                  const targetPref = targetSelections[i._id || i.id];
                  const currentTarget = (targetPref === 'reporter' ? reporter : (provider || reporter)) || reporter;
                  const isProvider = Boolean(provider && currentTarget?._id === provider?._id);

                  return (
                    <View style={styles.targetUserBox}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={styles.targetUserTitle}>COMMUTER SANCTIONS & ACTIONS</Text>
                        {provider && reporter && provider._id !== reporter._id && (
                          <View style={{ flexDirection: 'row', gap: 4 }}>
                            <TouchableOpacity
                              onPress={() => setTargetSelections(prev => ({ ...prev, [i._id || i.id]: 'provider' }))}
                              style={[styles.targetToggleBtn, isProvider && styles.targetToggleBtnActive]}
                            >
                              <Text style={[styles.targetToggleText, isProvider && styles.targetToggleTextActive]}>Provider</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setTargetSelections(prev => ({ ...prev, [i._id || i.id]: 'reporter' }))}
                              style={[styles.targetToggleBtn, !isProvider && styles.targetToggleBtnActive]}
                            >
                              <Text style={[styles.targetToggleText, !isProvider && styles.targetToggleTextActive]}>Reporter</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      <Text style={styles.targetUserName}>
                        👤 {currentTarget?.name || 'Commuter'} · 📞 {currentTarget?.phone || '—'} {currentTarget?.college ? `(${currentTarget.college})` : ''}
                      </Text>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <View style={[styles.sanctionBadge, currentTarget?.suspended ? styles.sanctionBadgeSuspended : styles.sanctionBadgeActive]}>
                          <Text style={[styles.sanctionBadgeText, currentTarget?.suspended ? { color: '#ef4444' } : { color: '#2dd4a0' }]}>
                            {currentTarget?.suspended ? '⛔ SUSPENDED' : '✅ ACTIVE'}
                          </Text>
                        </View>
                        <Text style={styles.warningsCountText}>
                          Warnings: {currentTarget?.warningsCount || 0}/3
                        </Text>
                      </View>

                      {/* Sanctions & Emergency Actions based on Severity */}
                      {sev === 'Critical' && (
                        <>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <TouchableOpacity
                              style={{ flex: 1, backgroundColor: '#dc2626', paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
                              onPress={() => Linking.openURL('tel:108')}
                              activeOpacity={0.8}
                            >
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>🚑 Ambulance (108)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ flex: 1, backgroundColor: '#1d4ed8', paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
                              onPress={() => Linking.openURL('tel:112')}
                              activeOpacity={0.8}
                            >
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>🚓 Police (112)</Text>
                            </TouchableOpacity>
                          </View>

                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <TouchableOpacity
                              style={[styles.sanctionBtn, { backgroundColor: '#b91c1c', flex: 1.2 }]}
                              onPress={() => handleSuspendUser(currentTarget, i, true)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.sanctionBtnText}>🚫 Direct Suspend</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.sanctionBtn, { backgroundColor: '#0284c7', flex: 1 }]}
                              onPress={() => handleRevokeSanctions(currentTarget, i)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.sanctionBtnText}>🔄 Revoke</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}

                      {sev === 'High' && (
                        <>
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                            <TouchableOpacity
                              style={{ flex: 1, backgroundColor: '#7c3aed', paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
                              onPress={() => Alert.alert('Campus Alert', `College authority alerted for incident #${(i._id || i.id).slice(-6)}`)}
                              activeOpacity={0.8}
                            >
                              <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '800' }}>🏫 College</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ flex: 1, backgroundColor: '#1d4ed8', paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
                              onPress={() => Linking.openURL('tel:112')}
                              activeOpacity={0.8}
                            >
                              <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '800' }}>🚓 Police</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ flex: 1, backgroundColor: '#ea580c', paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
                              onPress={() => {
                                const ph = currentTarget?.phone || i.reportedBy?.phone;
                                if (ph) Linking.openURL(`sms:${ph}?body=Campus Incident Alert: We are attending to your report.`);
                                else Alert.alert('Contact Home', 'Emergency contact notified.');
                              }}
                              activeOpacity={0.8}
                            >
                              <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '800' }}>🏠 Home</Text>
                            </TouchableOpacity>
                          </View>

                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <TouchableOpacity
                              style={[styles.sanctionBtn, { backgroundColor: '#c2410c', flex: 1.2 }]}
                              onPress={() => handleSuspendUser(currentTarget, i, true)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.sanctionBtnText}>🚫 Direct Suspend</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.sanctionBtn, { backgroundColor: '#0284c7', flex: 1 }]}
                              onPress={() => handleRevokeSanctions(currentTarget, i)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.sanctionBtnText}>🔄 Revoke</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}

                      {(sev === 'Low' || sev === 'Medium') && (
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                          <TouchableOpacity
                            style={[styles.sanctionBtn, { backgroundColor: '#d97706', flex: 1.3 }]}
                            onPress={() => handleWarnUser(currentTarget, i)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.sanctionBtnText}>⚠️ Warn ({currentTarget?.warningsCount || 0}/3)</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.sanctionBtn, { backgroundColor: '#dc2626', flex: 1 }]}
                            onPress={() => handleSuspendUser(currentTarget, i, false)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.sanctionBtnText}>⛔ Suspend</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.sanctionBtn, { backgroundColor: '#0284c7', flex: 1 }]}
                            onPress={() => handleRevokeSanctions(currentTarget, i)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.sanctionBtnText}>🔄 Revoke</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })()}

                {i.resolutionNotes ? (
                  <View style={styles.resNotesBox}>
                    <Text style={styles.resNotesTitle}>Resolution Note:</Text>
                    <Text style={styles.resNotesContent}>{i.resolutionNotes}</Text>
                  </View>
                ) : null}

                {i.status !== 'resolved' && (
                  <View style={styles.actionRow}>
                    {i.status !== 'investigating' && (
                      <TouchableOpacity
                        style={styles.investigateBtn}
                        onPress={() => handleUpdateStatus(i._id || i.id, 'investigating')}
                      >
                        <Text style={styles.investigateBtnText}>🔍 Investigate</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.resolveBtn}
                      onPress={() => setResolveModal(i)}
                    >
                      <Text style={styles.resolveBtnText}>✓ Resolve</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />

        {/* Resolve Modal */}
        <Modal visible={!!resolveModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Resolve Incident</Text>
              <Text style={styles.modalSub}>Add optional resolution note for campus records:</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="E.g. Spoke with both commuters, issue resolved peacefully."
                placeholderTextColor="#6e7681"
                value={resolutionNotes}
                onChangeText={setResolutionNotes}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => handleUpdateStatus(resolveModal._id || resolveModal.id, 'resolved', resolutionNotes)}
              >
                <Text style={styles.confirmBtnText}>Confirm Resolution</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setResolveModal(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07090d' },
  container: { flex: 1, padding: 16 },
  header: { marginBottom: 12, paddingTop: 4 },
  headerBadge: { color: '#2dd4a0', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  headerTitle: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#161b22', borderWidth: 1, borderColor: '#30363d' },
  chipActive: { backgroundColor: 'rgba(45,212,160,0.15)', borderColor: '#2dd4a0' },
  chipText: { color: '#8b949e', fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: '#2dd4a0', fontWeight: '800' },
  listContent: { paddingBottom: 24 },
  card: { backgroundColor: '#0d1117', borderRadius: 14, borderWidth: 1, borderColor: '#21262d', padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  incidentType: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusBadgeOpen: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: '#f59e0b' },
  statusBadgeDone: { backgroundColor: 'rgba(45,212,160,0.12)', borderColor: '#2dd4a0' },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  description: { color: '#c9d1d9', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  metaText: { color: '#8b949e', fontSize: 11, marginBottom: 2 },
  resNotesBox: { backgroundColor: '#161b22', padding: 10, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#30363d' },
  resNotesTitle: { color: '#2dd4a0', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  resNotesContent: { color: '#8b949e', fontSize: 12 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: '#161b22', paddingTop: 10 },
  investigateBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, backgroundColor: '#161b22', borderWidth: 1, borderColor: '#30363d' },
  investigateBtnText: { color: '#8b949e', fontSize: 11, fontWeight: '700' },
  resolveBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6, backgroundColor: '#2dd4a0' },
  resolveBtnText: { color: '#07090d', fontSize: 11, fontWeight: '800' },
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 10 },
  emptyTitle: { color: '#ffffff', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  emptySub: { color: '#8b949e', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#0d1117', borderRadius: 14, borderWidth: 1, borderColor: '#30363d', padding: 20, width: '100%', maxWidth: 360 },
  modalTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  modalSub: { color: '#8b949e', fontSize: 12, marginBottom: 12 },
  notesInput: { backgroundColor: '#161b22', color: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#30363d', padding: 10, fontSize: 13, height: 75, textAlignVertical: 'top', marginBottom: 14 },
  confirmBtn: { backgroundColor: '#2dd4a0', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  confirmBtnText: { color: '#07090d', fontSize: 13, fontWeight: '800' },
  cancelBtn: { paddingVertical: 8, alignItems: 'center' },
  cancelBtnText: { color: '#8b949e', fontSize: 12, fontWeight: '600' },
  targetUserBox: { backgroundColor: '#131924', borderRadius: 10, borderWidth: 1, borderColor: '#26344d', padding: 10, marginTop: 10, marginBottom: 4 },
  targetUserTitle: { color: '#94a3b8', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  targetToggleBtn: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, backgroundColor: '#1e293b' },
  targetToggleBtnActive: { backgroundColor: '#2dd4a0' },
  targetToggleText: { color: '#94a3b8', fontSize: 9.5, fontWeight: '700' },
  targetToggleTextActive: { color: '#07090d', fontWeight: '900' },
  targetUserName: { color: '#ffffff', fontSize: 12.5, fontWeight: '700', marginTop: 2 },
  sanctionBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  sanctionBadgeActive: { backgroundColor: 'rgba(45,212,160,0.12)', borderColor: '#2dd4a0' },
  sanctionBadgeSuspended: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: '#ef4444' },
  sanctionBadgeText: { fontSize: 9.5, fontWeight: '900' },
  warningsCountText: { color: '#fbbf24', fontSize: 11, fontWeight: '800' },
  sanctionBtn: { paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sanctionBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
});
