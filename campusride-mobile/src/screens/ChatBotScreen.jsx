// campusride-mobile/src/screens/ChatBotScreen.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, StyleSheet,
  ActivityIndicator, Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';

const SUGGESTIONS = [
  '🚗 How do I post or schedule a ride?',
  '🛡️ What documents are needed for KYC?',
  '💰 How are fares & payments handled?',
  '📍 Check my active ride or bookings',
  '👩 How do women-only rides work?',
  '🆘 How does SOS safety work?',
];

function cleanBotText(text) {
  if (!text) return '';
  return String(text).replace(/\*\*/g, '').replace(/^\*\s/gm, '• ').replace(/\*/g, '').trim();
}

// Accurate word-boundary offline safety net ONLY for urgent active emergency phrases
// when network/AI backend cannot be reached immediately (never matches "white" via "hit").
function isOfflineActiveEmergency(query) {
  const t = String(query || '').trim();
  if (!t) return false;
  const infoOnly = /^\s*(how\s+(does|do|to)|what\s+(is|are)|tell\s+me\s+about|explain)\b/i.test(t);
  if (infoOnly) return false;
  return (
    /\b(i|we|my\s+(?:driver|rider|cab|bike|car))\s+(?:just\s+)?(?:had|met\s+with|got\s+into|in)\s+(?:an?\s+)?(?:accident|crash|collision)\b/i.test(t) ||
    /\b(?:got|was|am|i'm)\s+(?:badly\s+)?(?:hit|injured|hurt|bleeding)\b/i.test(t) ||
    /\b(?:harass(?:ed|ing)?|stalk(?:ed|ing)?|threaten(?:ed|ing)?|molest(?:ed|ing)?|unsafe|unwanted)\b/i.test(t) ||
    /\bhelp\s+me\b(?:\s+please|\s+now|\s+quick|\s*!|$)/i.test(t) ||
    /\b(?:send|call)\s+(?:an?\s+)?(?:ambulance|police)\s*(?:now|immediately)?\b/i.test(t)
  );
}

const OFFLINE_EMERGENCY_GUIDANCE =
  '• Call 112 immediately (Police / Emergency) using the Dial 112 button below.\n' +
  '• Move to a well-lit public place or campus gate.\n' +
  '• Tap the red SOS button on Live Tracking to send live GPS alerts.';

export default function ChatBotScreen({ navigation }) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const makeWelcomeMsg = () => ({
    id: 'welcome',
    role: 'assistant',
    content: `Hi ${user?.name ? user.name.split(' ')[0] : 'there'}! Ask me anything about HOGO rides, KYC, routes, bookings, or safety.`,
  });

  const [messages, setMessages] = useState([makeWelcomeMsg()]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 90);
    return () => clearTimeout(t);
  }, [messages, loading]);

  const submitConversation = async (conversationForApi, failedMsgIndex = null) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);

    try {
      const apiMessages = conversationForApi
        .filter(m => !m.isError && (m.role === 'user' || m.role === 'assistant'))
        .map(m => ({ role: m.role, content: m.content }));

      const res = await api.sendChatbotMessage(apiMessages);
      if (res?.reply) {
        const botMsg = {
          id: `bot_${Date.now()}`,
          role: 'assistant',
          content: cleanBotText(res.reply),
          mode: res?.metadata?.mode || 'ai',
          showDial112: Boolean(res?.metadata?.showDial112 || res?.metadata?.mode === 'emergency'),
        };
        setMessages(prev => {
          const base = failedMsgIndex !== null ? prev.filter((_, i) => i !== failedMsgIndex) : prev;
          return [...base, botMsg];
        });
      } else {
        throw new Error('HOGO AI returned an empty response. Please retry.');
      }
    } catch (e) {
      const lastUserText = [...conversationForApi].reverse().find(m => m.role === 'user')?.content || '';
      if (isOfflineActiveEmergency(lastUserText)) {
        const emergencyMsg = {
          id: `emg_${Date.now()}`,
          role: 'assistant',
          content: OFFLINE_EMERGENCY_GUIDANCE,
          mode: 'emergency',
          showDial112: true,
        };
        setMessages(prev => {
          const base = failedMsgIndex !== null ? prev.filter((_, i) => i !== failedMsgIndex) : prev;
          return [...base, emergencyMsg];
        });
        return;
      }

      const friendlyErr = e?.message && !e.message.includes('JSON')
        ? e.message
        : 'Unable to reach HOGO AI right now. Check your connection and tap Retry.';

      const errBubble = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        isError: true,
        retryPayload: conversationForApi,
        content: friendlyErr,
      };
      setMessages(prev => {
        const base = failedMsgIndex !== null ? prev.filter((_, i) => i !== failedMsgIndex) : prev;
        return [...base, errBubble];
      });
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleSend = async (textToSend) => {
    const text = (textToSend ?? input).trim();
    if (!text || loading || inFlightRef.current) return;

    const userMsg = { id: `usr_${Date.now()}`, role: 'user', content: text };
    const cleanHistory = messages.filter(m => !m.isError);
    const updated = [...cleanHistory, userMsg];

    setMessages(updated);
    if (!textToSend) setInput('');

    await submitConversation(updated);
  };

  const handleRetry = async (errMsg, errIdx) => {
    if (!errMsg?.retryPayload || loading || inFlightRef.current) return;
    await submitConversation(errMsg.retryPayload, errIdx);
  };

  const handleClear = () => {
    if (loading || inFlightRef.current) return;
    setMessages([
      {
        id: `reset_${Date.now()}`,
        role: 'assistant',
        content: 'Conversation cleared. How can I help you with HOGO?',
      }
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]} edges={['top', 'bottom']}>
      {/* Unified clean header */}
      <View style={[styles.botHeader, { backgroundColor: isDark ? colors.surface : '#ffffff', borderBottomColor: isDark ? colors.border : '#e2e8f0' }]}>
        <View style={styles.botInfo}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.backBtnText, { color: isDark ? '#ffffff' : '#0f172a' }]}>←</Text>
          </TouchableOpacity>
          <View style={[styles.botAvatar, { backgroundColor: isDark ? colors.accentDim : 'rgba(245,166,35,0.15)' }]}>
            <MaterialCommunityIcons name="robot-happy-outline" size={22} color={colors.accent} />
            <View style={styles.onlineDot} />
          </View>
          <View>
            <Text style={[styles.botTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>HOGO AI Assistant</Text>
            <Text style={[styles.botStatus, { color: isDark ? '#8b96b0' : '#475569' }]}>Context-Aware Campus Helper</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleClear}
          disabled={loading}
          style={[styles.clearBtn, { backgroundColor: isDark ? colors.surface2 : '#f1f5f9', borderColor: isDark ? colors.border : '#cbd5e1', opacity: loading ? 0.5 : 1 }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.clearBtnText, { color: isDark ? colors.text3 : '#475569' }]}>Clear Chat</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: isDark ? colors.bg : '#f8fafc' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 25}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.messagesContainer, { paddingBottom: 24 }]}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {messages.map((m, idx) => {
            const isUser = m.role === 'user';
            const isEmergency = m.mode === 'emergency';
            return (
              <View
                key={m.id || idx}
                style={[
                  styles.msgRow,
                  isUser ? styles.msgRowUser : styles.msgRowAssistant
                ]}
              >
                {!isUser && (
                  <View style={[styles.bubbleAvatar, { backgroundColor: isEmergency ? 'rgba(239,68,68,0.18)' : (isDark ? colors.surface2 : '#e2e8f0') }]}>
                    <MaterialCommunityIcons
                      name={m.isError ? 'alert-circle-outline' : 'robot-happy-outline'}
                      size={14}
                      color={m.isError || isEmergency ? '#ef4444' : colors.accent}
                    />
                  </View>
                )}
                <View
                  style={[
                    styles.bubble,
                    isUser
                      ? styles.bubbleUser
                      : m.isError
                        ? [styles.bubbleAssistant, { backgroundColor: isDark ? '#1e1418' : '#fef2f2', borderColor: '#ef4444' }]
                        : isEmergency
                          ? [styles.bubbleAssistant, { backgroundColor: isDark ? '#1e1418' : '#fff5f5', borderColor: '#ef4444', borderWidth: 1.5 }]
                          : [styles.bubbleAssistant, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#e2e8f0' }]
                  ]}
                >
                  <Text
                    selectable
                    style={[
                      styles.msgText,
                      isUser
                        ? styles.msgTextUser
                        : [styles.msgTextAssistant, { color: m.isError ? '#ef4444' : (isDark ? colors.text : '#0f172a') }]
                    ]}
                  >
                    {m.content}
                  </Text>

                  {(isEmergency || m.showDial112) && (
                    <TouchableOpacity
                      style={{
                        marginTop: 10,
                        backgroundColor: '#ef4444',
                        borderRadius: radius.md,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      onPress={() => Linking.openURL('tel:112').catch(() => {})}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Dial 112 emergency helpline"
                    >
                      <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '900' }}>
                        📞 Dial 112 (Emergency)
                      </Text>
                    </TouchableOpacity>
                  )}

                  {m.isError && (
                    <TouchableOpacity
                      style={styles.retryBtn}
                      onPress={() => handleRetry(m, idx)}
                      disabled={loading}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.retryBtnText}>↻ Retry Request</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          {loading && (
            <View style={[styles.msgRow, styles.msgRowAssistant]}>
              <View style={[styles.bubbleAvatar, { backgroundColor: isDark ? colors.surface2 : '#e2e8f0' }]}>
                <MaterialCommunityIcons name="robot-happy-outline" size={14} color={colors.accent} />
              </View>
              <View style={[styles.bubble, styles.bubbleAssistant, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#e2e8f0' }, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
                <ActivityIndicator color={colors.accent} size="small" />
                <Text style={{ color: isDark ? colors.text3 : '#64748b', fontSize: 12 }}>HOGO AI is thinking…</Text>
              </View>
            </View>
          )}

          {messages.length < 3 && !loading && (
            <View style={styles.suggestionsWrap}>
              <Text style={[styles.suggestionsHeader, { color: isDark ? colors.text3 : '#475569' }]}>TRY ASKING</Text>
              <View style={styles.chipsRow}>
                {SUGGESTIONS.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.chip, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.accent + '44' : '#cbd5e1' }]}
                    onPress={() => handleSend(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, { color: isDark ? colors.text2 : '#475569' }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputContainer, { backgroundColor: isDark ? colors.surface : '#ffffff', borderTopColor: isDark ? colors.border : '#e2e8f0', paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            style={[styles.input, { backgroundColor: isDark ? colors.surface2 : '#f1f5f9', color: isDark ? colors.text : '#0f172a', borderColor: isDark ? colors.border : '#cbd5e1' }]}
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything about HOGO..."
            placeholderTextColor={isDark ? colors.text3 : '#64748b'}
            multiline
            maxLength={1000}
            editable={!loading}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              {
                backgroundColor: (!input.trim() || loading)
                  ? (isDark ? 'rgba(245, 166, 35, 0.25)' : '#e2e8f0')
                  : colors.accent,
              }
            ]}
            onPress={() => handleSend()}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
          >
            <Text style={[styles.sendBtnText, { color: (!input.trim() || loading) ? (isDark ? '#64748b' : '#94a3b8') : '#000000' }]}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  botHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    marginRight: 8,
    paddingVertical: 2,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  botInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  botAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.accentDim,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  onlineDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.green,
    position: 'absolute', bottom: 1, right: 1,
    borderWidth: 1.5, borderColor: colors.surface,
  },
  botTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  botStatus: { color: colors.text3, fontSize: 11 },
  clearBtn: {
    backgroundColor: colors.surface2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearBtnText: { color: colors.text3, fontSize: 11, fontWeight: '600' },

  messagesContainer: { padding: spacing.md, paddingBottom: 24 },
  msgRow: { flexDirection: 'row', marginBottom: 14, maxWidth: '88%' },
  msgRowUser: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  msgRowAssistant: { alignSelf: 'flex-start', alignItems: 'flex-start', gap: 8 },

  bubbleAvatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: 2,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 2,
    flexShrink: 1,
  },
  msgText: { fontSize: 13.5, lineHeight: 20 },
  msgTextUser: { color: '#000', fontWeight: '600' },
  msgTextAssistant: { color: colors.text },
  retryBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  retryBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },

  suggestionsWrap: { marginTop: 12, marginBottom: 8 },
  suggestionsHeader: {
    color: colors.text3, fontSize: 10, fontWeight: '800',
    letterSpacing: 1, marginBottom: 8,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent + '44',
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { color: colors.text2, fontSize: 12, fontWeight: '500' },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 96,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: { color: '#000', fontSize: 16, fontWeight: '900', marginLeft: 2 },
});
