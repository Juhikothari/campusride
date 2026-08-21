import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import TopHeader from '../components/TopHeader';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';

const SUGGESTIONS = [
  '🚗 How do I offer a ride?',
  '🔍 How does ride matching work?',
  '🛡️ How does KYC verification work?',
  '👩 How do women-only rides work?',
  '🆘 How does SOS emergency work?',
  '📍 How do I track my ride?',
];

function getLocalAnswer(query, user) {
  const q = query.toLowerCase();
  if (q.includes('offer') || q.includes('create ride') || q.includes('post ride')) {
    return "To offer a ride:\n1. Switch to the Offer Ride tab.\n2. Enter your pickup & drop locations.\n3. Choose your vehicle and departure time.\n4. If you are female, you can optionally toggle Women Only.\n5. Tap Post Ride! Students from your college can then view and request seats.";
  }
  if (q.includes('search') || q.includes('find') || q.includes('match') || q.includes('book')) {
    return "To search and match with rides:\n1. Go to Search Your Match.\n2. Enter your pickup and drop areas (or use GPS auto-detect).\n3. Tap Find My Route to see distance & travel time.\n4. Tap Search Rides to view available verified rides from your college mates!\n5. Tap Book Seat to send a request.";
  }
  if (q.includes('kyc') || q.includes('verify') || q.includes('document')) {
    return "KYC Verification ensures campus safety:\n• Providers must submit College ID, Driving License, and Vehicle info.\n• You can complete KYC anytime from Top Menu > KYC Verification.\n• Once approved by campus admins, you can immediately post rides.";
  }
  if (q.includes('women') || q.includes('female') || q.includes('safety')) {
    return "Women-Only Rides Feature:\n• Female providers can enable the Women Only option when offering a ride.\n• Only verified female students can see and book these rides for enhanced safety and comfort.";
  }
  if (q.includes('sos') || q.includes('emergency') || q.includes('help')) {
    return "SOS Emergency Protocol:\n• During any active ride, a prominent red SOS Emergency button is available.\n• Tapping it immediately alerts campus safety, contacts, and broadcasts emergency coordinates.";
  }
  if (q.includes('track') || q.includes('live tracking') || q.includes('gps')) {
    return "Live Tracking:\n• Once your ride starts, an Active Ride Banner appears on your dashboard.\n• Tap it to open live map tracking with route polyline, driver location, and emergency controls.";
  }
  return `Hi ${user?.name || 'there'}! I am RideBot, your HOGO campus assistant. You can ask me anything about finding campus rides, KYC verification, offering rides, safety protocols, or route previews!`;
}

export default function ChatBotScreen({ navigation }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello ${user?.name ? user.name.split(' ')[0] : 'there'}! 👋 I am RideBot, your AI assistant for HOGO.\n\nHow can I help with your campus commute today?`,
    }
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const res = await api.sendChatbotMessage(updated);
      if (res?.reply) {
        setMessages([...updated, { role: 'assistant', content: res.reply }]);
      } else {
        throw new Error('Empty response');
      }
    } catch (e) {
      const fallbackReply = getLocalAnswer(text, user);
      setMessages([...updated, { role: 'assistant', content: fallbackReply }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Conversation reset. How can I help you with HOGO?',
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopHeader title="HOGO" subtitle="Find Your Match" />

      <View style={styles.botHeader}>
        <View style={styles.botInfo}>
          <View style={styles.botAvatar}>
            <Text style={{ fontSize: 20 }}>🤖</Text>
            <View style={styles.onlineDot} />
          </View>
          <View>
            <Text style={styles.botTitle}>HOGO AI Assistant</Text>
            <Text style={styles.botStatus}>Online • Campus Commute Helper</Text>
          </View>
        </View>

        <TouchableOpacity onPress={handleClear} style={styles.clearBtn} activeOpacity={0.7}>
          <Text style={styles.clearBtnText}>Clear Chat</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m, idx) => {
            const isUser = m.role === 'user';
            return (
              <View
                key={idx}
                style={[
                  styles.msgRow,
                  isUser ? styles.msgRowUser : styles.msgRowAssistant
                ]}
              >
                {!isUser && (
                  <View style={styles.bubbleAvatar}>
                    <Text style={{ fontSize: 13 }}>🤖</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.bubble,
                    isUser ? styles.bubbleUser : styles.bubbleAssistant
                  ]}
                >
                  <Text style={[styles.msgText, isUser ? styles.msgTextUser : styles.msgTextAssistant]}>
                    {m.content}
                  </Text>
                </View>
              </View>
            );
          })}

          {loading && (
            <View style={[styles.msgRow, styles.msgRowAssistant]}>
              <View style={styles.bubbleAvatar}>
                <Text style={{ fontSize: 13 }}>🤖</Text>
              </View>
              <View style={[styles.bubble, styles.bubbleAssistant, { flexDirection: 'row', gap: 6, alignItems: 'center' }]}>
                <ActivityIndicator color={colors.accent} size="small" />
                <Text style={{ color: colors.text3, fontSize: 12 }}>RideBot is thinking…</Text>
              </View>
            </View>
          )}

          {messages.length < 3 && !loading && (
            <View style={styles.suggestionsWrap}>
              <Text style={styles.suggestionsHeader}>QUICK QUESTIONS</Text>
              <View style={styles.chipsRow}>
                {SUGGESTIONS.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.chip}
                    onPress={() => handleSend(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.chipText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about rides, KYC, routes..."
            placeholderTextColor={colors.text3}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
          >
            <Text style={styles.sendBtnText}>➤</Text>
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
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  msgRow: { flexDirection: 'row', marginBottom: 14, maxWidth: '85%' },
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
  msgText: { fontSize: 13.5, lineHeight: 19 },
  msgTextUser: { color: '#000', fontWeight: '600' },
  msgTextAssistant: { color: colors.text },

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
    maxHeight: 90,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#000', fontSize: 16, fontWeight: '900', marginLeft: 2 },
});
