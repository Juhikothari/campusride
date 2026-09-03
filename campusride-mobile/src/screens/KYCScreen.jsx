import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Input, Btn, Alert } from '../components/UI';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';

const CLOUD_NAME    = 'dhkui5t39';
const UPLOAD_PRESET = 'kyc_upload';

async function uploadToCloudinary(uri) {
  const formData = new FormData();
  formData.append('file', { uri, name: uri.split('/').pop(), type: 'image/jpeg' });
  formData.append('upload_preset', UPLOAD_PRESET);
  const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
  const data = await res.json();
  if (!data.secure_url) throw new Error('Upload failed');
  return data.secure_url;
}

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
  const [docs,        setDocs]        = useState({ aadhar: null, collegeId: null, license: null });
  const [vehicleNum,  setVehicleNum]  = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleType, setVehicleType] = useState('car');

  useEffect(() => {
    api.getKycStatus()
      .then(status => {
        const isReal = ['pending', 'approved', 'rejected'].includes(status.kycStatus) && status.documents;
        if (isReal) { setKycStatus(status); setSubmitted(true); }
        else setKycStatus(status);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
    if (!docs.aadhar || !docs.collegeId) { setError('Aadhar and College ID are required'); return; }
    setUploading(true); setError('');
    try {
      const uploadedDocs = {};
      uploadedDocs.aadhar       = await uploadToCloudinary(docs.aadhar);
      uploadedDocs.collegeIdCard = await uploadToCloudinary(docs.collegeId);
      if (docs.license) uploadedDocs.drivingLicense = await uploadToCloudinary(docs.license);
      const vCleanNum = vehicleNum.trim() ? vehicleNum.trim().toUpperCase() : null;
      const vCleanName = vehicleName.trim() || null;
      await api.submitKyc({
        aadharUrl:         uploadedDocs.aadhar,
        collegeIdCardUrl:  uploadedDocs.collegeIdCard,
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
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.text2, fontSize: 14 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>KYC Verification</Text>

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
          {(docs_.aadhar || docs_.collegeIdCard || docs_.drivingLicense) && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>SUBMITTED DOCUMENTS</Text>
              {docs_.aadhar       && <DocRow label="Aadhar Card"      icon="🪪" submitted />}
              {docs_.collegeIdCard && <DocRow label="College ID"       icon="🎓" submitted />}
              {docs_.drivingLicense && <DocRow label="Driving License"  icon="🚘" submitted />}
              {docs_.vehicleNumber && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ color: colors.text3, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 }}>VEHICLE NUMBER</Text>
                  <Text style={{ color: colors.accent, fontSize: 22, fontWeight: '900', letterSpacing: 3 }}>{docs_.vehicleNumber}</Text>
                </View>
              )}
            </View>
          )}

          {st === 'rejected' && (
            <Btn label="Resubmit KYC" onPress={() => { setSubmitted(false); setDocs({ aadhar: null, collegeId: null, license: null }); }} style={{ marginTop: 8 }} />
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Upload form
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.text2, fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>KYC Verification</Text>
        <Text style={styles.subtitle}>Submit your documents to get verified. Required to offer rides.</Text>

        <Alert message={error} />

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>REQUIRED DOCUMENTS</Text>
          <DocRow label="Aadhar Card"  icon="🪪" onUpload={() => pickDoc('aadhar')}   uri={docs.aadhar}   required />
          <DocRow label="College ID"   icon="🎓" onUpload={() => pickDoc('collegeId')} uri={docs.collegeId} required />
          <DocRow label="Driving License" icon="🚘" onUpload={() => pickDoc('license')}  uri={docs.license}  />
          <Text style={{ color: colors.text3, fontSize: 11, marginTop: 4 }}>* Required fields</Text>
        </View>

        {isProvider && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>VEHICLE DETAILS (PROVIDER)</Text>
            <Input label="Vehicle Number" value={vehicleNum} onChangeText={setVehicleNum} placeholder="e.g. KA01AB1234" autoCapitalize="characters" />
            <Input label="Vehicle Name"   value={vehicleName} onChangeText={setVehicleName} placeholder="e.g. Honda City, Activa" autoCapitalize="words" />

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
        )}

        <Btn
          label={uploading ? 'Uploading & Submitting…' : 'Submit for Verification'}
          onPress={submit}
          loading={uploading}
        />
        <Text style={{ color: colors.text3, fontSize: 11, textAlign: 'center', marginTop: 10 }}>
          Documents are reviewed within 24–48 hours
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function DocRow({ label, icon, onUpload, uri, submitted, required }) {
  return (
    <TouchableOpacity
      onPress={onUpload}
      disabled={submitted}
      style={[styles.docRow, (uri || submitted) && styles.docRowDone]}
    >
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
          {label}{required && !submitted ? ' *' : ''}
        </Text>
        <Text style={{ color: (uri || submitted) ? colors.green : colors.text3, fontSize: 12, marginTop: 2 }}>
          {submitted ? '✓ Submitted' : uri ? '✓ Uploaded — tap to change' : 'Tap to upload'}
        </Text>
      </View>
      {!submitted && <Text style={{ fontSize: 18, color: uri ? colors.green : colors.text3 }}>{uri ? '✓' : '+'}</Text>}
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
    borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10,
  },
  docRowDone: { borderColor: colors.green + '55', backgroundColor: colors.greenDim },
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
});
