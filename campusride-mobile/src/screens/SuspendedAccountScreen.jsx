// campusride-mobile/src/screens/SuspendedAccountScreen.jsx
// Full lockout screen shown whenever an account is suspended or blocked.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert as RNAlert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Btn } from '../components/UI';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';

export default function SuspendedAccountScreen() {
  const { user, accountRestriction, logout } = useAuth();
  const { isDark } = useTheme();
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);

  const isBlocked = accountRestriction?.status === 'blocked';
  const title = isBlocked ? 'Account Blocked' : 'Account Suspended';
  const icon = isBlocked ? '🚫' : '⛔';
  const reason = accountRestriction?.reason || (isBlocked
    ? 'This account has been blocked by campus administrators.'
    : 'Your account is currently suspended from HOGO.');

  const openSupport = () => {
    setSubject(isBlocked ? 'Account Blocked Appeal' : 'Account Suspension Review');
    setSentOk(false);
    setSupportModalVisible(true);
  };

  const handleSendSupport = async () => {
    if (!subject.trim() || !message.trim()) {
      RNAlert.alert('Required', 'Please enter both a subject and a message.');
      return;
    }
    setSending(true);
    try {
      const token = await api.getToken();
      const res = await fetch(`${api.API_BASE}/api/auth/contact-support`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fromName: user?.name || 'HOGO User',
          fromEmail: user?.email || 'unknown',
          college: user?.college || '',
          role: user?.role || '',
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Unable to send support message');
      }
      setSentOk(true);
      setMessage('');
    } catch (e) {
      RNAlert.alert('Support Error', e.message || 'Failed to contact support.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]}>
      <View style={styles.center}>
        <View style={[styles.card, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? 'rgba(239,68,68,0.4)' : '#fca5a5' }]}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>{icon}</Text>
          </View>

          <Text style={[styles.title, { color: '#ef4444' }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: isDark ? colors.text2 : '#475569' }]}>
            {reason}
          </Text>

          <Text style={[styles.lockNote, { color: isDark ? colors.text3 : '#64748b' }]}>
            Access to rides, bookings, community chat, notifications actions, and all HOGO features is disabled while your account is {isBlocked ? 'blocked' : 'suspended'}.
          </Text>

          <Btn
            label="📞 Contact Support"
            onPress={openSupport}
            variant="outline"
            style={{ width: '100%', marginTop: spacing.md }}
          />
          <Btn
            label="Sign Out"
            onPress={logout}
            variant="danger"
            style={{ width: '100%', marginTop: spacing.sm }}
          />
        </View>
      </View>

      <Modal
        visible={supportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSupportModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalCard, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#cbd5e1' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.modalTitle, { color: isDark ? colors.text : '#0f172a' }]}>📞 Contact Support</Text>
              <TouchableOpacity onPress={() => setSupportModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ color: isDark ? colors.text3 : '#64748b', fontSize: 18, fontWeight: '800' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {sentOk ? (
              <View style={{ paddingVertical: 14 }}>
                <Text style={{ color: '#2dd4a0', fontSize: 14, fontWeight: '700', marginBottom: 8 }}>
                  ✓ Your message has been sent to HOGO Support.
                </Text>
                <Btn label="Close" onPress={() => setSupportModalVisible(false)} />
              </View>
            ) : (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? colors.surface2 : '#f8fafc', borderColor: isDark ? colors.border : '#cbd5e1', color: isDark ? '#ffffff' : '#0f172a' }]}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Subject"
                  placeholderTextColor={colors.text3}
                />
                <TextInput
                  style={[styles.input, { height: 110, textAlignVertical: 'top', backgroundColor: isDark ? colors.surface2 : '#f8fafc', borderColor: isDark ? colors.border : '#cbd5e1', color: isDark ? '#ffffff' : '#0f172a' }]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Explain your concern or request an account review..."
                  placeholderTextColor={colors.text3}
                  multiline
                  maxLength={1000}
                />
                <Btn
                  label={sending ? 'Sending...' : '📩 Send Message'}
                  onPress={handleSendSupport}
                  loading={sending}
                />
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239,68,68,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  icon: { fontSize: 34 },
  title: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  lockNote: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.xl,
    borderWidth: 1.2,
    padding: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    marginBottom: 12,
  },
});
