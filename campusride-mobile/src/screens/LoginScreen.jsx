import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Input, Btn, Alert } from '../components/UI';
import { colors, spacing, radius } from '../theme';

export default function LoginScreen({ navigation }) {
  const { loginUser } = useAuth();
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);

  const submit = async () => {
    setError('');
    if (!email.trim() || !password) { setError('Please fill in all fields'); return; }
    setLoading(true);
    try {
      await loginUser(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.badgeWrap}>
              <Text style={styles.logoBadge}>⚡</Text>
            </View>
            <Text style={styles.logo}>
              HO<Text style={{ color: colors.accent }}>GO</Text>
            </Text>
            <Text style={styles.tagline}>Find Your Match</Text>
          </View>

          {/* Form card */}
          <View style={styles.card}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your HOGO account</Text>

            <Alert message={error} />

            <Input
              label="College Email"
              icon="✉"
              value={email}
              onChangeText={setEmail}
              placeholder="you@college.edu.in"
              keyboardType="email-address"
              autoCapitalize="none"
              containerStyle={{ marginTop: spacing.md }}
            />

            <Input
              label="Password"
              icon="🔒"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry={!showPass}
              rightIcon={
                <TouchableOpacity onPress={() => setShowPass(s => !s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontSize: 16 }}>{showPass ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              }
            />

            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={{ alignSelf: 'flex-end', marginTop: -8, marginBottom: spacing.md }}>
              <Text style={styles.forgotLink}>Forgot password?</Text>
            </TouchableOpacity>

            <Btn label="Sign In to HOGO →" onPress={submit} loading={loading} />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <Text style={{ color: colors.text2, fontSize: 14 }}>New to HOGO? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '700' }}>Create account →</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: 28 },
  badgeWrap: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: colors.accentDim, borderWidth: 1.5, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  logoBadge: { fontSize: 24 },
  logo: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 2,
  },
  tagline: {
    color: colors.text2,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  title:    { color: colors.text,  fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: colors.text2, fontSize: 14, marginBottom: spacing.lg },
  forgotLink: { color: colors.accent, fontSize: 13 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md, gap: 10 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: colors.border },
  dividerLabel: { color: colors.text3, fontSize: 13 },
});
