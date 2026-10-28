import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert as RNAlert, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TopHeader from '../components/TopHeader';
import { Input, Btn, Alert } from '../components/UI';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';
import { uploadToCloudinaryWithRetry } from '../services/cloudinary';

const KYC_COLOR = {
  approved:      colors.green,
  pending:       colors.accent,
  rejected:      colors.red,
  not_submitted: colors.text3,
  not_required:  colors.text3,
};

export default function KYCScreen({ navigation }) {
  const { user } = useAuth();
  const isProvider = user?.role === 'provider' || user?.role === 'both';

  const [kycStatus,   setKycStatus]   = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [uploading,   setUploading]   = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [error,       setError]       = useState('');
  const [docs,        setDocs]        = useState({ aadhar: null, collegeId: null, license: null, selfie: null });
  const [vehicleNum,  setVehicleNum]  = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleType, setVehicleType] = useState('car');
  const [previewDoc,  setPreviewDoc]  = useState({ title: '', uri: '' });
  const [previewVisible, setPreviewVisible] = useState(false);

  const openDocPreview = (title, uri) => {
    if (!uri) return;
    setPreviewDoc({ title, uri });
    setPreviewVisible(true);
  };

  const renderDocPreviewModal = () => (
    <Modal
      visible={previewVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setPreviewVisible(false)}
    >
      <View style={styles.previewOverlay}>
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.previewBadge}>KYC DOCUMENT PREVIEW</Text>
              <Text style={styles.previewTitle} numberOfLines={1}>{previewDoc.title || 'Document'}</Text>
            </View>
            <TouchableOpacity onPress={() => setPreviewVisible(false)} style={styles.previewCloseBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.previewCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.previewImageWrapper}>
            {previewDoc.uri ? (
              <Image source={{ uri: previewDoc.uri }} style={styles.previewImage} resizeMode="contain" />
            ) : (
              <Text style={{ color: colors.text3 }}>No preview available</Text>
            )}
          </View>
          <View style={styles.previewFooter}>
            <Text style={styles.previewFooterText}>🔒 Stored securely for student identity verification</Text>
            <TouchableOpacity onPress={() => setPreviewVisible(false)} style={styles.previewDoneBtn}>
              <Text style={styles.previewDoneBtnText}>Close Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  useEffect(() => {
    // Populate docs if already uploaded in registration
    const uDocs = user?.kycDocuments || {};
    if (uDocs.aadhar || uDocs.collegeIdCard || uDocs.drivingLicense || uDocs.selfie || user?.selfieUrl) {
      setDocs(d => ({
        aadhar: d.aadhar || uDocs.aadhar || null,
        collegeId: d.collegeId || uDocs.collegeIdCard || null,
        license: d.license || uDocs.drivingLicense || null,
        selfie: d.selfie || uDocs.selfie || user?.selfieUrl || null,
      }));
    }

    api.getKycStatus()
      .then(status => {
        const docObj = status?.documents || {};
        setDocs(d => ({
          aadhar: d.aadhar || docObj.aadhar || null,
          collegeId: d.collegeId || docObj.collegeIdCard || null,
          license: d.license || docObj.drivingLicense || null,
          selfie: d.selfie || docObj.selfie || null,
        }));
        if (status.vehicleNumber) setVehicleNum(status.vehicleNumber);
        if (status.vehicleName) setVehicleName(status.vehicleName);
        if (status.vehicleType) setVehicleType(status.vehicleType);

        const isReal = ['pending', 'approved', 'rejected'].includes(status.kycStatus) && (docObj.aadhar || docObj.collegeIdCard);
        if (isReal) { setKycStatus(status); setSubmitted(true); }
        else setKycStatus(status);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const captureSelfie = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        RNAlert.alert('Permission Denied', 'Camera permission is required to capture your live verification selfie.');
        return;
      }
      const r = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        cameraType: ImagePicker.CameraType?.front || 'front',
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!r.canceled && r.assets?.[0]?.uri) {
        setDocs(d => ({ ...d, selfie: r.assets[0].uri }));
      }
    } catch (err) {
      RNAlert.alert('Camera Error', 'Could not launch camera: ' + err.message);
    }
  };

  const pickDoc = (docType) => {
    RNAlert.alert('Upload Document', 'Choose source', [
      {
        text: 'Camera', onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return;
          const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
          if (!r.canceled) setDocs(d => ({ ...d, [docType]: r.assets[0].uri }));
        },
      },
      {
        text: 'Photo Library', onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return;
          const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
          if (!r.canceled) setDocs(d => ({ ...d, [docType]: r.assets[0].uri }));
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submit = async () => {
    if (!docs.aadhar || !docs.collegeId) {
      setError('Aadhar Card and College ID are required');
      return;
    }
    if (!docs.selfie) {
      setError('Live selfie verification is mandatory. Please capture your selfie.');
      return;
    }
    setUploading(true); setError('');
    try {
      const uploadedDocs = {};
      uploadedDocs.aadhar       = await uploadToCloudinaryWithRetry(docs.aadhar);
      uploadedDocs.collegeIdCard = await uploadToCloudinaryWithRetry(docs.collegeId);
      uploadedDocs.selfie       = await uploadToCloudinaryWithRetry(docs.selfie);
      if (docs.license) uploadedDocs.drivingLicense = await uploadToCloudinaryWithRetry(docs.license);
      const vCleanNum = vehicleNum.trim() ? vehicleNum.trim().toUpperCase() : null;
      const vCleanName = vehicleName.trim() || null;
      await api.submitKyc({
        aadharUrl:         uploadedDocs.aadhar,
        collegeIdCardUrl:  uploadedDocs.collegeIdCard,
        selfieUrl:         uploadedDocs.selfie,
        drivingLicenseUrl: uploadedDocs.drivingLicense || null,
        vehicleNumber:     vCleanNum,
        vehicleName:       vCleanName,
        vehicleType:       vehicleType || 'car',
      });
      if (vCleanNum) {
        const vItem = {
          vehicleNumber: vCleanNum,
          vehicleName: vCleanName || 'Vehicle',
          vehicleType: vehicleType || 'car',
          status: 'pending',
        };
        const existingListStr = await AsyncStorage.getItem('@user_registered_vehicles_list').catch(() => null);
        const list = existingListStr ? JSON.parse(existingListStr) : [];
        const updated = [vItem, ...list.filter(x => x.vehicleNumber !== vItem.vehicleNumber)];
        await AsyncStorage.setItem('@user_registered_vehicles_list', JSON.stringify(updated)).catch(() => {});
      }
      setSubmitted(true);
      setKycStatus({ kycStatus: 'pending' });
    } catch (e) {
      setError(e.message || 'Submission failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
    </SafeAreaView>
  );

  // Already submitted — show status
  if (submitted) {
    const st     = kycStatus?.kycStatus || 'pending';
    const stColor = KYC_COLOR[st] || colors.text3;
    const stEmoji = { approved: '✅', pending: '⏳', rejected: '❌' }[st] || '📋';
    const docs_   = kycStatus?.documents || {};

    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]} edges={['top']}>
        <TopHeader title="KYC Verification" subtitle="Student & Vehicle Verification" showBack={true} />
        <ScrollView contentContainerStyle={styles.scroll}>

          <View style={[styles.statusCard, { borderColor: stColor + '55', backgroundColor: stColor + '10' }]}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>{stEmoji}</Text>
            <Text style={{ color: stColor, fontSize: 20, fontWeight: '800', marginBottom: 6, textTransform: 'capitalize' }}>{st.replace(/_/g, ' ')}</Text>
            <Text style={{ color: colors.text2, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
              {st === 'approved' ? 'Your identity has been verified. You can now offer rides.' :
               st === 'pending'  ? 'Your documents are under review. Usually takes 24–48 hours.' :
               st === 'rejected' ? `Rejected: ${kycStatus?.remarks || 'Documents unclear or invalid. Please resubmit.'}`
               : 'KYC not submitted yet.'}
            </Text>
          </View>

          {/* Doc previews */}
          {(docs_.aadhar || docs_.collegeIdCard || docs_.drivingLicense || docs_.selfie) && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>SUBMITTED DOCUMENTS</Text>
              {docs_.selfie       && <DocRow label="Live Selfie Photo" icon="📸" uri={docs_.selfie || docs.selfie} submitted onView={() => openDocPreview('Live Selfie Photo', docs_.selfie || docs.selfie)} />}
              {docs_.aadhar       && <DocRow label="Aadhar Card"      icon="🪪" uri={docs_.aadhar || docs.aadhar} submitted onView={() => openDocPreview('Aadhar Card', docs_.aadhar || docs.aadhar)} />}
              {docs_.collegeIdCard && <DocRow label="College ID"       icon="🎓" uri={docs_.collegeIdCard || docs.collegeId} submitted onView={() => openDocPreview('College ID Card', docs_.collegeIdCard || docs.collegeId)} />}
              {docs_.drivingLicense && <DocRow label="Driving License"  icon="🚘" uri={docs_.drivingLicense || docs.license} submitted onView={() => openDocPreview('Driving License', docs_.drivingLicense || docs.license)} />}
            </View>
          )}

          {st === 'rejected' && (
            <Btn label="Resubmit KYC" onPress={() => { setSubmitted(false); setDocs({ aadhar: null, collegeId: null, license: null, selfie: null }); }} style={{ marginTop: 8 }} />
          )}
        </ScrollView>
      {renderDocPreviewModal()}
        {renderDocPreviewModal()}
      </SafeAreaView>
    );
  }

  // Upload form
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopHeader title="KYC Verification" subtitle="Student & Vehicle Verification" showBack={true} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>Submit your documents to get verified. Required to offer rides.</Text>

        <Alert message={error} />

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>REQUIRED DOCUMENTS</Text>
          <DocRow label="Live Selfie Photo" icon="📸" onUpload={captureSelfie}            uri={docs.selfie}   onView={() => openDocPreview('Live Selfie Photo', docs.selfie)} required />
          <DocRow label="Aadhar Card"       icon="🪪" onUpload={() => pickDoc('aadhar')}   uri={docs.aadhar}   onView={() => openDocPreview('Aadhar Card', docs.aadhar)} required />
          <DocRow label="College ID"        icon="🎓" onUpload={() => pickDoc('collegeId')} uri={docs.collegeId} onView={() => openDocPreview('College ID Card', docs.collegeId)} required />
          <DocRow label="Driving License"   icon="🚘" onUpload={() => pickDoc('license')}  uri={docs.license}  onView={() => openDocPreview('Driving License', docs.license)} />
          <Text style={{ color: colors.text3, fontSize: 11, marginTop: 4 }}>* Required fields</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>VEHICLE TYPE (FOR PROVIDERS)</Text>
          <Input label="Vehicle Name / Model" value={vehicleName} onChangeText={setVehicleName} placeholder="e.g. Honda City, Activa, Nexon" autoCapitalize="words" />

            <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 8, marginBottom: 8 }}>
              VEHICLE TYPE
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[
                { type: 'motorcycle', label: '🏍️ Bike' },
                { type: 'car',        label: '🚗 Car' },
                { type: 'suv',        label: '🚙 SUV' },
                { type: 'xuv',        label: '🛻 XUV' },
              ].map(v => (
                <TouchableOpacity
                  key={v.type}
                  onPress={() => setVehicleType(v.type)}
                  style={[
                    styles.vTypeChip,
                    vehicleType === v.type && styles.vTypeChipActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.vTypeChipText,
                    vehicleType === v.type && styles.vTypeChipTextActive,
                  ]}>
                    {v.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

        <Btn
          label={uploading ? 'Uploading & Submitting…' : 'Submit for Verification'}
          onPress={submit}
          loading={uploading}
        />
        <Text style={{ color: colors.text3, fontSize: 11, textAlign: 'center', marginTop: 10 }}>
          Documents are reviewed within 24–48 hours
        </Text>
      </ScrollView>
      {renderDocPreviewModal()}
    </SafeAreaView>
  );
}

function DocRow({ label, icon, onUpload, uri, submitted, required, onView }) {
  const isAdded = Boolean(uri || submitted);

  return (
    <TouchableOpacity
      onPress={() => { if (uri && onView) onView(); else if (onUpload) onUpload(); }}

      style={[styles.docRow, { backgroundColor: isDark ? colors.surface2 : '#ffffff', borderColor: isDark ? colors.border : '#cbd5e1' }, isAdded && styles.docRowDone]}
      activeOpacity={0.75}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.docThumbnail} resizeMode="cover" />
      ) : (
        <View style={styles.docIconBox}>
          <Text style={{ fontSize: 20 }}>{icon}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
            {label}{required && !submitted ? ' *' : ''}
          </Text>
          {isAdded && (
            <View style={styles.addedBadge}>
              <Text style={styles.addedBadgeText}>✓ Added</Text>
            </View>
          )}
        </View>
        <Text style={{ color: isAdded ? colors.green : colors.text3, fontSize: 12, marginTop: 3 }}>
          {submitted ? '✓ Uploaded on record • Tap to view' : uri ? '✓ Document attached • Tap to view' : 'Tap to capture / upload'}
        </Text>
      </View>
      {(uri || !submitted) && (
        <Text style={{ fontSize: 13, color: uri ? colors.green : colors.accent, fontWeight: '800' }}>
          {uri ? '👁️ View' : '+'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.bg },
  scroll:     { padding: spacing.md, paddingBottom: 48 },
  title:      { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 6 },
  subtitle:   { color: colors.text2, fontSize: 13, marginBottom: spacing.md },
  sectionLabel: { color: colors.text3, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md,
  },
  statusCard: {
    borderRadius: radius.xl, borderWidth: 1, padding: 28,
    alignItems: 'center', marginBottom: spacing.md,
  },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface2, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 10,
  },
  docRowDone: { borderColor: colors.green + '55', backgroundColor: 'rgba(45,212,160,0.06)' },
  docThumbnail: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: '#000',
    borderWidth: 1.5,
    borderColor: colors.green,
  },
  docIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addedBadge: {
    backgroundColor: 'rgba(0,230,118,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.green + '44',
  },
  addedBadgeText: {
    color: colors.green,
    fontSize: 10,
    fontWeight: '800',
  },
  vTypeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  vTypeChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  vTypeChipText: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '700',
  },
  vTypeChipTextActive: {
    color: colors.accent,
    fontWeight: '800',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  previewContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0f1624',
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.accent,
    padding: 16,
    maxHeight: '90%',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c2638',
    marginBottom: 12,
  },
  previewBadge: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  previewTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  previewCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCloseBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  previewImageWrapper: {
    width: '100%',
    height: 320,
    backgroundColor: '#060a12',
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1c2638',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1c2638',
    gap: 10,
  },
  previewFooterText: {
    color: colors.text3,
    fontSize: 11,
    textAlign: 'center',
  },
  previewDoneBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  previewDoneBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
});
