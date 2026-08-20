import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, StyleSheet, Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { Input, Btn, Alert, TogglePill } from '../components/UI';
import { colors, spacing, radius } from '../theme';

const CLOUD_NAME    = 'dhkui5t39';
const UPLOAD_PRESET = 'kyc_upload';

const ROLES = [
  { value: 'seeker',   label: 'Seeker',   icon: '🔍' },
  { value: 'provider', label: 'Provider', icon: '🚗' },
  { value: 'both',     label: 'Both',     icon: '↔' },
];

const GENDERS = [
  { value: 'male',             label: 'Male' },
  { value: 'female',           label: 'Female' },
  { value: 'other',            label: 'Other' },
  { value: 'prefer_not_to_say',label: 'Prefer not to say' },
];

async function uploadToCloudinary(uri, type = 'image') {
  const formData = new FormData();
  const filename = uri.split('/').pop();
  formData.append('file', { uri, name: filename, type: 'image/jpeg' });
  formData.append('upload_preset', UPLOAD_PRESET);
  const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST', body: formData,
  });
  const data = await res.json();
  if (!data.secure_url) throw new Error('Upload failed');
  return data.secure_url;
}

export default function RegisterScreen({ navigation }) {
  const { registerUser } = useAuth();
  const [step, setStep] = useState(1); // 1 = basic info, 2 = provider docs

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [college,  setCollege]  = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [usn,      setUsn]      = useState('');
  const [gender,   setGender]   = useState('prefer_not_to_say');
  const [role,     setRole]     = useState('both');
  const [emergency,setEmergency]= useState('');
  const [adminKey, setAdminKey] = useState('');
  const [vehicleNumber, setVehicleNum]  = useState('');
  const [vehicleName,   setVehicleName] = useState('');

  const [docs,     setDocs]     = useState({ aadhar: null, license: null, collegeId: null });
  const [uploading, setUploading] = useState(false);
  const [showPass,  setShowPass]  = useState(false);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);

  const isProvider = role === 'provider' || role === 'both';

  const pickImage = async (docType) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { RNAlert.alert('Permission needed', 'Please allow photo access to upload documents.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      setDocs(d => ({ ...d, [docType]: result.assets[0].uri }));
    }
  };

  const takePhoto = async (docType) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { RNAlert.alert('Permission needed', 'Please allow camera access.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      setDocs(d => ({ ...d, [docType]: result.assets[0].uri }));
    }
  };

  const showDocPicker = (docType) => {
    RNAlert.alert('Upload Document', 'Choose how to add this document', [
      { text: 'Camera',        onPress: () => takePhoto(docType) },
      { text: 'Photo Library', onPress: () => pickImage(docType) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const validateStep1 = () => {
    if (!name.trim())     return 'Name is required';
    if (!email.trim())    return 'Email is required';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Enter a valid email';
    if (!college.trim() && role !== 'admin') return 'College name is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password !== confirm) return 'Passwords do not match';
    if (!phone.trim())    return 'Phone number is required';
    if (!usn.trim())      return 'USN is required';
    if (!gender)          return 'Please select your gender';
    if (role === 'admin' && adminKey !== 'freewheel') return 'Invalid admin key';
    return null;
  };

  const handleNext = () => {
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError('');
    if (isProvider) { setStep(2); }
    else { submit({}); }
  };

  const submit = async (kycDocs = {}) => {
    setLoading(true);
    setError('');
    try {
      const uploadedDocs = {};
      if (isProvider) {
        setUploading(true);
        if (kycDocs.aadhar)   uploadedDocs.aadhar          = await uploadToCloudinary(kycDocs.aadhar);
        if (kycDocs.license)  uploadedDocs.drivingLicense  = await uploadToCloudinary(kycDocs.license);
        if (kycDocs.collegeId) uploadedDocs.collegeIdCard  = await uploadToCloudinary(kycDocs.collegeId);
        setUploading(false);
      }
      await registerUser({
        name: name.trim(), email: email.trim().toLowerCase(),
        phone: phone.trim(), college: college.trim(),
        password, role, usn: usn.trim(), gender,
        emergencyContact: emergency.trim(),
        ...(role === 'admin' && { adminKey }),
        ...(isProvider && {
          vehicleNumber:  vehicleNumber.toUpperCase(),
          vehicleName:    vehicleName.trim(),
          aadhar:         uploadedDocs.aadhar || null,
          drivingLicense: uploadedDocs.drivingLicense || null,
          collegeIdCard:  uploadedDocs.collegeIdCard || null,
        }),
      });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleSubmitWithDocs = () => submit(docs);

  // ── Step 1: Basic Info ────────────────────────────────────────
  if (step === 1) return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.text2, fontSize: 14 }}>← Back to Login</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Join HOGO</Text>
          <Text style={styles.subtitle}>Verified student rides for your campus</Text>

          <Alert message={error} />

          {/* Role */}
          <Text style={styles.sectionLabel}>I want to…</Text>
          <TogglePill options={ROLES} value={role} onChange={setRole} />

          {role === 'admin' && (
            <Input label="Admin Key" value={adminKey} onChangeText={setAdminKey} placeholder="freewheel" secureTextEntry containerStyle={{ marginTop: 16 }} />
          )}

          <View style={{ height: spacing.lg }} />

          <Input label="Full Name"     icon="👤" value={name}    onChangeText={setName}    placeholder="Your full name" autoCapitalize="words" />
          <Input label="College Email" icon="✉"  value={email}   onChangeText={setEmail}   placeholder="you@college.edu.in" keyboardType="email-address" />
          {role !== 'admin' && (
            <Input label="College Name" icon="🏫" value={college} onChangeText={setCollege} placeholder="e.g. RNS Institute of Technology" autoCapitalize="words" />
          )}
          <Input label="USN (University Seat Number)" icon="🎓" value={usn} onChangeText={setUsn} placeholder="e.g. 1RN21CS001" autoCapitalize="characters" />
          <Input label="Phone Number" icon="📱" value={phone} onChangeText={t => setPhone(t.replace(/\D/g, ''))} placeholder="10-digit number" keyboardType="phone-pad" maxLength={10} />
          <Input label="Emergency Contact" icon="🆘" value={emergency} onChangeText={setEmergency} placeholder="Emergency phone number" keyboardType="phone-pad" />

          {/* Gender */}
          <Text style={styles.sectionLabel}>Gender</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
            {GENDERS.map(g => (
              <TouchableOpacity
                key={g.value}
                onPress={() => setGender(g.value)}
                style={[styles.genderChip, gender === g.value && styles.genderChipActive]}
              >
                <Text style={[styles.genderChipText, gender === g.value && styles.genderChipTextActive]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Password" icon="🔒" value={password} onChangeText={setPassword}
            placeholder="Min. 6 characters" secureTextEntry={!showPass}
            rightIcon={
              <TouchableOpacity onPress={() => setShowPass(s => !s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 16 }}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            }
          />
          <Input label="Confirm Password" icon="🔒" value={confirm} onChangeText={setConfirm} placeholder="Repeat password" secureTextEntry />

          <Btn
            label={isProvider ? 'Next: Upload Documents →' : 'Create HOGO Account'}
            onPress={handleNext}
            loading={loading}
            style={{ marginTop: 8 }}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md }}>
            <Text style={{ color: colors.text2, fontSize: 14 }}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '700' }}>Sign In →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  // ── Step 2: Provider KYC Docs ─────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => setStep(1)} style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.text2, fontSize: 14 }}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Upload Documents</Text>
          <Text style={styles.subtitle}>As a provider on HOGO, we need to verify your credentials</Text>

          <Alert message={error} />

          <DocUploadRow label="Aadhar Card" icon="🪪" onUpload={() => showDocPicker('aadhar')}   uri={docs.aadhar}   />
          <DocUploadRow label="Driving License" icon="🚘" onUpload={() => showDocPicker('license')}  uri={docs.license}  />
          <DocUploadRow label="College ID Card" icon="🎓" onUpload={() => showDocPicker('collegeId')} uri={docs.collegeId} />

          <Input label="Vehicle Number (e.g. KA01AB1234)" icon="🔢" value={vehicleNumber} onChangeText={setVehicleNum} placeholder="KA01AB1234" autoCapitalize="characters" />
          <Input label="Vehicle Name (e.g. Honda City)"  icon="🚗" value={vehicleName}   onChangeText={setVehicleName} placeholder="e.g. Swift Dezire, Activa" autoCapitalize="words" />

          <Btn
            label={uploading ? 'Uploading…' : 'Complete HOGO Registration'}
            onPress={handleSubmitWithDocs}
            loading={loading || uploading}
            style={{ marginTop: 8 }}
          />
          <Text style={{ color: colors.text3, fontSize: 11, textAlign: 'center', marginTop: 10 }}>
            Documents are verified by college administrators within 24 hours
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DocUploadRow({ label, icon, onUpload, uri }) {
  return (
    <TouchableOpacity onPress={onUpload} style={[styles.docRow, uri && styles.docRowDone]}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: uri ? colors.green : colors.text3, fontSize: 12, marginTop: 2 }}>
          {uri ? '✓ Uploaded' : 'Tap to upload'}
        </Text>
      </View>
      <Text style={{ fontSize: 18, color: uri ? colors.green : colors.text3 }}>{uri ? '✓' : '+'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: spacing.lg, paddingBottom: 48 },
  title:    { color: colors.text,  fontSize: 26, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: colors.text2, fontSize: 14, marginBottom: spacing.lg },
  sectionLabel: {
    color: colors.text2, fontSize: 12, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 8, marginTop: 4,
  },
  genderChip: {
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  genderChipActive:     { borderColor: colors.accent, backgroundColor: colors.accentDim },
  genderChipText:       { color: colors.text2, fontSize: 13 },
  genderChipTextActive: { color: colors.accent, fontWeight: '700' },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  docRowDone: { borderColor: colors.green + '55', backgroundColor: colors.greenDim },
});
