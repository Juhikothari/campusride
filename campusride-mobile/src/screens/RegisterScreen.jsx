import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, StyleSheet, Modal, TextInput, FlatList,
  Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { Input, Btn, Alert, TogglePill } from '../components/UI';
import { colors, spacing, radius } from '../theme';
import { INDIAN_COLLEGES } from '../data/colleges';

const CLOUD_NAME    = 'dhkui5t39';
const UPLOAD_PRESET = 'kyc_upload';

const ROLES = [
  { value: 'seeker',   label: 'Seeker',   icon: '🔍' },
  { value: 'provider', label: 'Provider', icon: '🚗' },
  { value: 'both',     label: 'Both',     icon: '↔' },
];

const GENDERS = [
  { value: 'male',              label: 'Male',              symbol: '♂' },
  { value: 'female',            label: 'Female',            symbol: '♀' },
  { value: 'other',             label: 'Other',             symbol: '⚧' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say', symbol: '—' },
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
  const [step, setStep] = useState(1); // 1 = basic info, 2 = provider docs & vehicles

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

  // College Dropdown Modal state
  const [showCollegeModal, setShowCollegeModal] = useState(false);
  const [collegeSearch,    setCollegeSearch]    = useState('');

  const [vehicles, setVehicles] = useState([
    { vehicleNumber: '', vehicleName: '', vehicleType: 'car' }
  ]);

  const [docs,      setDocs]      = useState({ aadhar: null, license: null, collegeId: null });
  const [uploading, setUploading] = useState(false);
  const [showPass,  setShowPass]  = useState(false);
  const [showConf,  setShowConf]  = useState(false);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);

  const isProvider = role === 'provider' || role === 'both';

  // Filtered colleges
  const filteredColleges = useMemo(() => {
    if (!collegeSearch.trim()) return INDIAN_COLLEGES;
    const q = collegeSearch.toLowerCase();
    return INDIAN_COLLEGES.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.short.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q)
    );
  }, [collegeSearch]);

  const addVehicleRow = () => {
    setVehicles(prev => [...prev, { vehicleNumber: '', vehicleName: '', vehicleType: 'car' }]);
  };

  const removeVehicleRow = (idx) => {
    if (vehicles.length <= 1) return;
    setVehicles(prev => prev.filter((_, i) => i !== idx));
  };

  const updateVehicleField = (idx, field, value) => {
    setVehicles(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

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
    if (!name.trim())     return 'Full name is required';
    if (!phone.trim())    return 'Phone number is required';
    if (!email.trim())    return 'College email is required';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Enter a valid college email';
    if (!college.trim() && role !== 'admin') return 'College / University is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password !== confirm) return 'Passwords do not match';
    if (!gender)          return 'Please select your gender';
    if (role === 'admin' && adminKey !== 'freewheel') return 'Invalid admin key';
    return null;
  };

  const handleNext = () => {
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError('');
    submit({});
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

      const validVehicles = vehicles
        .filter(v => v.vehicleNumber && v.vehicleNumber.trim())
        .map(v => ({
          vehicleNumber: v.vehicleNumber.trim().toUpperCase(),
          vehicleName:   v.vehicleName.trim() || 'Vehicle',
          vehicleType:   v.vehicleType || 'car',
        }));

      const primaryVehicle = validVehicles[0] || {};

      await registerUser({
        name: name.trim(), email: email.trim().toLowerCase(),
        phone: phone.trim(), college: college.trim(),
        password, role, usn: usn.trim() || 'STUDENT', gender,
        emergencyContact: emergency.trim(),
        ...(role === 'admin' && { adminKey }),
        ...(isProvider && {
          vehicleNumber:  primaryVehicle.vehicleNumber || null,
          vehicleName:    primaryVehicle.vehicleName || null,
          vehicles:       validVehicles,
          aadhar:         uploadedDocs.aadhar || null,
          drivingLicense: uploadedDocs.drivingLicense || null,
          collegeIdCard:  uploadedDocs.collegeIdCard || null,
        }),
      });

      if (validVehicles.length > 0) {
        AsyncStorage.setItem('@user_registered_vehicles_list', JSON.stringify(validVehicles)).catch(() => {});
      }
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleSubmitWithDocs = () => submit(docs);
  const handleSkipDocs = () => submit({});

  // ── Step 1: Basic Info (Pixel-perfect matching Image 1) ──────
  if (step === 1) return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 14 }}>
            <Text style={{ color: colors.text2, fontSize: 14 }}>← Back to Login</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join thousands of campus commuters</Text>

          <Alert message={error} />

          {/* Row 1: Full Name & Phone */}
          <View style={styles.twoColRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>FULL NAME *</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Arjun Sharma"
                placeholderTextColor={colors.text3}
                autoCapitalize="words"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>PHONE *</Text>
              <TextInput
                style={styles.textInput}
                value={phone}
                onChangeText={t => setPhone(t.replace(/\D/g, ''))}
                placeholder="+91 9876543210"
                placeholderTextColor={colors.text3}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
          </View>

          {/* Row 2: College Email */}
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>COLLEGE EMAIL *</Text>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="you@college.edu"
              placeholderTextColor={colors.text3}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Row 3: College / University Dropdown & Emergency Contact */}
          <View style={styles.twoColRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>COLLEGE / UNIVERSITY *</Text>
              <TouchableOpacity
                style={[styles.textInput, styles.dropdownInput]}
                onPress={() => setShowCollegeModal(true)}
                activeOpacity={0.8}
              >
                <Text style={college ? styles.dropdownTextActive : styles.dropdownTextPlaceholder} numberOfLines={1}>
                  {college || 'Search your college or ...'}
                </Text>
                <Text style={{ color: colors.text3, fontSize: 12 }}>▼</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>EMERGENCY CONTACT</Text>
              <TextInput
                style={styles.textInput}
                value={emergency}
                onChangeText={t => setEmergency(t.replace(/\D/g, ''))}
                placeholder="+91 9876543211"
                placeholderTextColor={colors.text3}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Row 4: Gender Selection Grid */}
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>GENDER <Text style={{ color: colors.accent, fontSize: 10 }}>(USED FOR SAFETY MATCHING)</Text></Text>
            <View style={styles.genderGrid}>
              {GENDERS.map(g => (
                <TouchableOpacity
                  key={g.value}
                  onPress={() => setGender(g.value)}
                  style={[styles.genderBox, gender === g.value && styles.genderBoxActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.genderSymbol, gender === g.value && styles.genderSymbolActive]}>{g.symbol}</Text>
                  <Text style={[styles.genderLabel, gender === g.value && styles.genderLabelActive]} numberOfLines={1}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Row 5: Password */}
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>PASSWORD *</Text>
            <View style={styles.passInputWrapper}>
              <Text style={{ fontSize: 14, marginRight: 8 }}>🔒</Text>
              <TextInput
                style={styles.passInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 6 characters"
                placeholderTextColor={colors.text3}
                secureTextEntry={!showPass}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPass(s => !s)}
                style={styles.passToggleBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={{ fontSize: 13 }}>{showPass ? '🙈' : '👁️'}</Text>
                <Text style={styles.passToggleBtnText}>{showPass ? 'HIDE' : 'SHOW'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Row 6: Confirm Password */}
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>CONFIRM PASSWORD *</Text>
            <View style={styles.passInputWrapper}>
              <Text style={{ fontSize: 14, marginRight: 8 }}>🔒</Text>
              <TextInput
                style={styles.passInput}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Re-enter password"
                placeholderTextColor={colors.text3}
                secureTextEntry={!showConf}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowConf(s => !s)}
                style={styles.passToggleBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={{ fontSize: 13 }}>{showConf ? '🙈' : '👁️'}</Text>
                <Text style={styles.passToggleBtnText}>{showConf ? 'HIDE' : 'SHOW'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Btn
            label="Create account"
            onPress={handleNext}
            loading={loading}
            style={{ marginTop: spacing.md }}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md, marginBottom: 20 }}>
            <Text style={{ color: colors.text2, fontSize: 14 }}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '700' }}>Sign In →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* College Dropdown Search Modal */}
      <Modal visible={showCollegeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.collegeModalBox}>
            <View style={styles.collegeModalHeader}>
              <Text style={styles.collegeModalTitle}>🏫 Select Your College</Text>
              <TouchableOpacity onPress={() => setShowCollegeModal(false)}>
                <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>✕ Close</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.collegeSearchInput}
              value={collegeSearch}
              onChangeText={setCollegeSearch}
              placeholder="🔍 Search college name, short code or city..."
              placeholderTextColor={colors.text3}
              autoFocus
            />

            <FlatList
              data={filteredColleges}
              keyExtractor={(item, index) => item.name + index}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.collegeItem, college === item.name && styles.collegeItemActive]}
                  onPress={() => {
                    setCollege(item.name);
                    setShowCollegeModal(false);
                    setCollegeSearch('');
                  }}
                >
                  <Text style={[styles.collegeItemName, college === item.name && { color: colors.accent }]}>
                    {item.name}
                  </Text>
                  <Text style={styles.collegeItemCity}>📍 {item.city} ({item.short})</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ color: colors.text2, fontSize: 13, marginBottom: 8 }}>College not in list?</Text>
                  <TouchableOpacity
                    style={styles.customCollegeBtn}
                    onPress={() => {
                      setCollege(collegeSearch.trim());
                      setShowCollegeModal(false);
                    }}
                  >
                    <Text style={styles.customCollegeText}>Use "{collegeSearch.trim()}"</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  // ── Step 2: Provider Vehicles & KYC Docs ──────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => setStep(1)} style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.text2, fontSize: 14 }}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Vehicle & Documents</Text>
          <Text style={styles.subtitle}>Add your vehicle(s) and documents. You can also add or update them later while offering a ride.</Text>

          <Alert message={error} />

          {/* Verification documents */}
          <Text style={styles.label}>VERIFICATION DOCUMENTS (OPTIONAL)</Text>
          <DocUploadRow label="Aadhar Card" icon="🪪" onUpload={() => showDocPicker('aadhar')}   uri={docs.aadhar}   />
          <DocUploadRow label="Driving License" icon="🚘" onUpload={() => showDocPicker('license')}  uri={docs.license}  />
          <DocUploadRow label="College ID Card" icon="🎓" onUpload={() => showDocPicker('collegeId')} uri={docs.collegeId} />

          {/* Multi-vehicle section */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 8 }}>
            <Text style={styles.label}>VEHICLE DETAILS ({vehicles.length})</Text>
            <TouchableOpacity onPress={addVehicleRow} style={styles.addVehicleBtn}>
              <Text style={styles.addVehicleText}>+ Add Vehicle</Text>
            </TouchableOpacity>
          </View>

          {vehicles.map((v, i) => (
            <View key={i} style={styles.vehicleCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>🚗 VEHICLE #{i + 1}</Text>
                {vehicles.length > 1 && (
                  <TouchableOpacity onPress={() => removeVehicleRow(i)}>
                    <Text style={{ color: colors.red, fontSize: 12, fontWeight: '600' }}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Input
                label="Vehicle Number (e.g. KA01AB1234)"
                icon="🔢"
                value={v.vehicleNumber}
                onChangeText={t => updateVehicleField(i, 'vehicleNumber', t.toUpperCase())}
                placeholder="KA01AB1234"
                autoCapitalize="characters"
              />
              <Input
                label="Vehicle Name (e.g. Jupiter, Swift Dezire)"
                icon="🚗"
                value={v.vehicleName}
                onChangeText={t => updateVehicleField(i, 'vehicleName', t)}
                placeholder="e.g. Jupiter, Swift Dezire, Activa"
                autoCapitalize="words"
              />
            </View>
          ))}

          <Btn
            label={uploading ? 'Uploading…' : 'Complete Registration'}
            onPress={handleSubmitWithDocs}
            loading={loading || uploading}
            style={{ marginTop: 8 }}
          />

          <TouchableOpacity onPress={handleSkipDocs} style={styles.skipBtn} disabled={loading || uploading}>
            <Text style={styles.skipBtnText}>Skip for now & Add while offering ride →</Text>
          </TouchableOpacity>

          <Text style={{ color: colors.text3, fontSize: 11, textAlign: 'center', marginTop: 14 }}>
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
  title:    { color: colors.text,  fontSize: 28, fontWeight: '900', marginBottom: 4 },
  subtitle: { color: colors.text2, fontSize: 14, marginBottom: spacing.lg },

  label: {
    color: colors.text2,
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },

  twoColRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },

  fieldBlock: {
    marginBottom: 12,
  },

  textInput: {
    backgroundColor: '#161b24',
    borderWidth: 1.5,
    borderColor: '#262d3d',
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
  },

  dropdownInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownTextPlaceholder: { color: colors.text3, fontSize: 13, flex: 1 },
  dropdownTextActive: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 },

  genderGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  genderBox: {
    flex: 1,
    backgroundColor: '#161b24',
    borderWidth: 1.5,
    borderColor: '#262d3d',
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderBoxActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(245,166,35,0.08)',
  },
  genderSymbol: { fontSize: 16, color: colors.text2, marginBottom: 4 },
  genderSymbolActive: { color: colors.accent },
  genderLabel: { color: colors.text2, fontSize: 11, fontWeight: '600' },
  genderLabelActive: { color: colors.accent, fontWeight: '800' },

  passInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b24',
    borderWidth: 1.5,
    borderColor: '#262d3d',
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  passInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  passToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 6,
  },
  passToggleBtnText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  collegeModalBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  collegeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  collegeModalTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  collegeSearchInput: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    marginBottom: 12,
  },
  collegeItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  collegeItemActive: {
    backgroundColor: colors.accentDim,
    borderRadius: radius.md,
    paddingHorizontal: 8,
  },
  collegeItemName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  collegeItemCity: { color: colors.text3, fontSize: 12, marginTop: 2 },
  customCollegeBtn: {
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  customCollegeText: { color: colors.accent, fontSize: 13, fontWeight: '700' },

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
  addVehicleBtn: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  addVehicleText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  vehicleCard: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 12,
  },
  skipBtn: {
    marginTop: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
