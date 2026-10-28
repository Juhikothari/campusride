import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';

const SUGGESTIONS = [
  '🚗 How do I change my vehicle?',
  '🔍 How does ride matching work?',
  '🛡️ How does KYC verification work?',
  '👩 How do women-only rides work?',
  '🆘 How does SOS emergency work?',
  '📍 How do I track my ride?',
];

function getLocalAnswer(query, user) {
  const q = (query || '').toLowerCase().trim();

  // 1. Ride History & Past Trips
  if (q.includes('history') || q.includes('past ride') || q.includes('past booking') || q.includes('previous ride') || q.includes('completed ride') || q.includes('old ride') || q.includes('my trips')) {
    return "📜 Accessing Ride History:\n• Top Menu (☰) > 'My Bookings': Tap the 'History / Completed' tab to view all completed, past, or cancelled rides.\n• Profile Screen: Navigate to 'My Profile' and tap 'Ride History' to inspect your full trip receipts, dates, route logs, and matched buddy USNs.\n• Note: Active ongoing trips are shown separately on your Dashboard active trip card.";
  }

  // 2. Cancellation Policy & How to Cancel
  if (q.includes('cancel') || q.includes('cancellation') || q.includes('refund') || q.includes('withdraw') || q.includes('delete ride')) {
    return "❌ Ride Cancellation Policy:\n• How to cancel: Open your active ride from the Dashboard or Live Tracking screen, scroll down and tap 'Cancel Ride' (for drivers) or 'Cancel Booking' (for passengers).\n• Free campus cancellation: You can cancel anytime before departure. Matched peers will receive an instant notification so they can arrange alternative transit.\n• No cancellation fees or penalties apply on campus.";
  }

  // 3. Pre-Ride Safety Checklist
  if (q.includes('checklist') || q.includes('safety check') || q.includes('pre-ride') || q.includes('verification check')) {
    return "📋 Pre-Ride Safety Checklist:\n• Both driver and passenger verify a 4-point safety checklist before departure (driver photo, vehicle plate, USN, and route confirmation).\n• The checklist unlocks once the driver reaches the pickup spot and the request is accepted.\n• Once all checks are verified, the driver taps Start Ride and live destination navigation activates.";
  }

  // 4. Walk Together (Nadi) Companion
  if (q.includes('walk') || q.includes('nadi') || q.includes('walking') || q.includes('companion') || q.includes('foot') || q.includes('pedestrian')) {
    return "🚶 Walk Together (Nadi):\n• Tap 'Walk Together' on the Dashboard.\n• Enter your campus pickup and destination points, choose departure time, and tap 'Post Walk Request'.\n• Walk posts stay active for 24 hours. Classmates can tap 'Join Walk', and you will be notified when a buddy joins!";
  }

  // 5. Community & Student Chat
  if (q.includes('chat') || q.includes('community') || q.includes('post') || q.includes('lounge') || q.includes('comment') || q.includes('reply') || q.includes('message')) {
    return "💬 Campus Community & Student Chat:\n• Go to the 'Community' tab on the bottom bar to see campus posts and join college discussions.\n• Switch to 'Campus Chat' to message peers across your institution in real-time.\n• You can post transit alerts, questions, tips, and choose to post with your student USN or anonymously.";
  }

  // 6. Pricing, Fare & Cost Splitting
  if (q.includes('price') || q.includes('fare') || q.includes('cost') || q.includes('petrol') || q.includes('payment') || q.includes('pay') || q.includes('money') || q.includes('rupee') || q.includes('split')) {
    return "💰 Estimated Fare & Cost Sharing:\n• Estimated fare is calculated automatically based on route distance to help students split petrol costs fairly.\n• No surge pricing or hidden app commissions — you split actual travel costs directly with your verified college buddy.\n• You can review the estimated fare before booking.";
  }

  // 7. Arrival & Pickup
  if (q.includes('reach') || q.includes('arrived') || q.includes('pickup') || q.includes('meeting') || q.includes('spot') || q.includes('where is driver')) {
    return "📍 Pickup & Buddy Arrival:\n• As the driver approaches your pickup point, live GPS telemetry displays their ETA.\n• When the driver taps 'I Have Reached Seeker Location', you will receive an instant notification: 'Your buddy has arrived at pickup location!'.\n• Meet at the designated spot and complete your pre-ride checklist to begin.";
  }

  // 8. Vehicle Policy & Changing Vehicle
  if (q.includes('vehicle') || q.includes('car') || q.includes('bike') || q.includes('plate') || q.includes('rc') || q.includes('edit vehicle') || q.includes('change vehicle') || q.includes('add vehicle')) {
    return "🚗 Vehicle Policy & Adding Vehicles:\n• You can register a new vehicle anytime in My Profile > 'Add Vehicle'. It will be reviewed by admin within 24 hours.\n• For campus safety and verification integrity, already approved vehicle numbers cannot be altered directly by users.\n• To update an existing vehicle number or plate, tap 'Contact Support' with your RC copy and student ID.";
  }

  // 9. Offering a Ride
  if (q.includes('offer') || q.includes('create ride') || q.includes('post ride') || q.includes('driver') || q.includes('provide ride')) {
    return "🚗 How to Offer a Ride:\n1. Switch to the 'Offer Ride' tab on the dashboard.\n2. Enter your pickup & drop locations.\n3. Choose your vehicle and departure time.\n4. If you are female, you can optionally toggle 'Women Only'.\n5. Tap 'Post Ride'! Students from your college heading along your route can then request seats.";
  }

  // 10. Search & Match Rides
  if (q.includes('search') || q.includes('find') || q.includes('match') || q.includes('book') || q.includes('seeker')) {
    return "🔍 Search Your Buddy:\n1. Tap 'Search Your Buddy' on the Dashboard.\n2. Enter your pickup and drop areas (or use GPS auto-detect).\n3. Tap 'Search Your Buddy' to view available verified rides from classmates along your route.\n4. Tap 'Book This Ride' to send a request to the provider.";
  }

  // 11. KYC Verification & Documents
  if (q.includes('kyc') || q.includes('verify') || q.includes('document') || q.includes('aadhar') || q.includes('license') || q.includes('usn') || q.includes('selfie')) {
    return "🛡️ KYC Verification:\n• Ensures 100% verified campus safety. Every student submits College ID, Aadhar card, live front-camera selfie, and USN.\n• Drivers also upload Driving License and vehicle RC details.\n• You can complete or check verification anytime from Top Menu (☰) > KYC Verification. Admins review submissions within 24–48 hours.";
  }

  // 12. Women-Only Rides
  if (q.includes('women') || q.includes('female') || q.includes('ladies') || q.includes('gender')) {
    return "👩 Women-Only Rides Feature:\n• Female providers can toggle 'Women Only' when offering a ride.\n• Only verified female students can view and book these rides for enhanced comfort and peace of mind.";
  }

  // 13. SOS Emergency Protocol
  if (q.includes('sos') || q.includes('emergency') || q.includes('help') || q.includes('panic') || q.includes('police')) {
    return "🆘 SOS Emergency Protocol:\n• During any active ride, a prominent red SOS Emergency button is available on the Live Tracking screen.\n• Tapping it immediately alerts campus safety, dials emergency contacts, and broadcasts your live GPS coordinates.";
  }

  // 14. Live GPS Tracking
  if (q.includes('track') || q.includes('live tracking') || q.includes('gps') || q.includes('map') || q.includes('location')) {
    return "📍 Live GPS Tracking:\n• Once your ride starts, an Active Ride banner appears on your dashboard.\n• Tap it to open live map tracking with route polyline, driver location, ETA, and emergency controls.";
  }

  // 15. Support, Incident Reporting & Glitches
  if (q.includes('support') || q.includes('incident') || q.includes('report') || q.includes('admin') || q.includes('glitch') || q.includes('bug') || q.includes('problem') || q.includes('issue')) {
    return "🛠️ Support & Incident Reporting:\n• Report an incident or safety concern: Tap Top Menu (☰) > 'Report Incident'. Admins investigate all reports promptly.\n• For general support or bug reports, tap Top Menu (☰) > 'Contact Support'.\n• For live ride emergencies, use the SOS button.";
  }

  // 16. Dark & Light Theme
  if (q.includes('theme') || q.includes('dark') || q.includes('light') || q.includes('mode')) {
    return "🌓 Dark & Light Mode:\n• You can easily switch between Dark and Light mode using the toggle button located directly on your Dashboard greeting hero card (next to your name)!\n• It instantly adapts all screens, maps, and menus to your preferred appearance.";
  }

  // 17. Intelligent Generalized Fallback with Comprehensive Guides
  return `🤖 Hi ${user?.name ? user.name.split(' ')[0] : 'there'}! I am RideBot, your HOGO assistant. Here is how I can help:\n\n` +
    `• 📜 **Ride History**: View completed trips in Menu (☰) > My Bookings > History or Profile.\n` +
    `• 🔍 **Search Your Buddy**: Match with peers heading your way in Search Your Buddy.\n` +
    `• 🚗 **Offer a Ride**: Share seats with verified classmates in Offer Ride.\n` +
    `• 🚶 **Walk Together**: Join or post walking groups across campus.\n` +
    `• ❌ **Cancellations**: Cancel trips easily from the Dashboard before departure.\n` +
    `• 🛡️ **KYC & Verification**: Check verification status in Menu (☰) > KYC.\n` +
    `• 🆘 **SOS Emergency**: 24/7 emergency coordinates & contact broadcast.\n\n` +
    `Feel free to ask me anything specific about your campus commute!`;
}

export default function ChatBotScreen({ navigation }) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
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
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]} edges={['top']}>
      {/* Unified clean header */}
      <View style={styles.botHeader}>
        <View style={styles.botInfo}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
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
              <View style={[styles.bubble, styles.bubbleAssistant, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#e2e8f0' }, { flexDirection: 'row', gap: 6, alignItems: 'center' }]}>
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

        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            style={[styles.input, { backgroundColor: isDark ? colors.surface2 : '#f1f5f9', color: isDark ? colors.text : '#0f172a', borderColor: isDark ? colors.border : '#cbd5e1' }]}
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
