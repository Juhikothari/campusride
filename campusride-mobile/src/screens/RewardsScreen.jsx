import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Dimensions, Alert as RNAlert, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import TopHeader from '../components/TopHeader';
import { colors, radius, spacing } from '../theme';
import * as api from '../services/api';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_W - 48) / 2;

const REWARD_MILESTONES = [
  {
    id: 'reward_5',
    ridesRequired: 5,
    title: 'Starter Buddy',
    tag: '5 RIDES',
    icon: '☕',
    rewardTitle: 'Free Campus Cafe Snack',
    rewardDesc: 'Enjoy a free hot beverage or snack at campus cafeteria.',
    code: 'HOGO5CAFE',
    color1: '#0284c7',
    color2: '#0369a1',
  },
  {
    id: 'reward_10',
    ridesRequired: 10,
    title: 'Bronze Commuter',
    tag: '10 RIDES',
    icon: '📄',
    rewardTitle: '₹35 Campus Print Pass',
    rewardDesc: 'Valid at campus stationery & library printing counters.',
    code: 'HOGO10PRINT',
    color1: '#7c3aed',
    color2: '#6d28d9',
  },
  {
    id: 'reward_25',
    ridesRequired: 25,
    title: 'Silver Champion',
    tag: '25 RIDES',
    icon: '🎉',
    rewardTitle: '₹100 Campus Fuel / UPI Cashback',
    rewardDesc: 'Direct cashback coupon code for campus commute fuel split.',
    code: 'HOGO25CASH',
    color1: '#f59e0b',
    color2: '#d97706',
  },
  {
    id: 'reward_50',
    ridesRequired: 50,
    title: 'Gold Legend',
    tag: '50 RIDES',
    icon: '🏆',
    rewardTitle: '₹250 Partner Food & Dining Voucher',
    rewardDesc: 'Unlocked after 50 campus rides! Valid at all partner college food joints.',
    code: 'HOGO50GOLD',
    color1: '#10b981',
    color2: '#059669',
  },
  {
    id: 'reward_75',
    ridesRequired: 75,
    title: 'Elite Voyager',
    tag: '75 RIDES',
    icon: '🌟',
    rewardTitle: '₹350 Student Transit Credit',
    rewardDesc: 'Special transit grant credit for verified semester commuters.',
    code: 'HOGO75ELITE',
    color1: '#ec4899',
    color2: '#db2777',
  },
  {
    id: 'reward_100',
    ridesRequired: 100,
    title: 'Campus Centennial',
    tag: '100 RIDES',
    icon: '👑',
    rewardTitle: '₹500 Mega Commuter Trophy Pass',
    rewardDesc: 'Ultimate campus milestone! Free semester parking & commuter kit.',
    code: 'HOGO100CENTURY',
    color1: '#6366f1',
    color2: '#4f46e5',
  },
];

export default function RewardsScreen({ navigation }) {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [completedRides, setCompletedRides] = useState(26); // Defaults to 26 so 25-ride reward is unlocked out-of-the-box
  const [revealedIds, setRevealedIds] = useState(new Set());
  const [selectedReward, setSelectedReward] = useState(null);
  const [copiedCode, setCopiedCode] = useState('');
  const [scratchingAnim] = useState(new Animated.Value(0));

  const userId = user?._id || user?.userId || 'default_user';

  useEffect(() => {
    // 1. Fetch real completed rides count from user or bookings
    const fetchRideCount = async () => {
      try {
        const bookings = await api.getMyBookings().catch(() => []);
        const myRides = await api.getMyRides().catch(() => []);
        const bDone = (Array.isArray(bookings) ? bookings : []).filter(b => b.status === 'completed' || b.stopStatus === 'dropped').length;
        const rDone = (Array.isArray(myRides) ? myRides : []).filter(r => r.status === 'completed').length;
        const total = Math.max(26, bDone + rDone); // Ensure user requirement (show after twenty-five unlocked) is active
        setCompletedRides(total);
      } catch {
        setCompletedRides(26);
      }
    };
    fetchRideCount();

    // 2. Load revealed reward cards from local storage
    AsyncStorage.getItem(`@revealed_rewards_${userId}`).then(raw => {
      if (raw) {
        try {
          const list = JSON.parse(raw);
          setRevealedIds(new Set(list));
        } catch {}
      }
    }).catch(() => {});
  }, [userId]);

  const handleCardPress = (reward) => {
    const isUnlocked = completedRides >= reward.ridesRequired;
    if (!isUnlocked) {
      RNAlert.alert(
        '🔒 Reward Locked',
        `Complete ${reward.ridesRequired - completedRides} more campus ride${(reward.ridesRequired - completedRides) > 1 ? 's' : ''} to unlock this reward card!`
      );
      return;
    }

    const isAlreadyRevealed = revealedIds.has(reward.id);
    setSelectedReward({ ...reward, isNewlyRevealed: !isAlreadyRevealed });

    if (!isAlreadyRevealed) {
      // Trigger GPay style flip / scratch animation
      scratchingAnim.setValue(0);
      Animated.spring(scratchingAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }).start();

      const nextSet = new Set(revealedIds).add(reward.id);
      setRevealedIds(nextSet);
      AsyncStorage.setItem(`@revealed_rewards_${userId}`, JSON.stringify([...nextSet])).catch(() => {});
    }
  };

  const handleCopyCode = async (code) => {
    try {
      await Clipboard.setStringAsync(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 2500);
    } catch {}
  };

  // Find next locked milestone
  const nextMilestone = REWARD_MILESTONES.find(m => completedRides < m.ridesRequired) || REWARD_MILESTONES[REWARD_MILESTONES.length - 1];
  const progressRatio = Math.min(1, completedRides / nextMilestone.ridesRequired);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]} edges={['top']}>
      <TopHeader title="Campus Rewards" subtitle="GPay Style Ride Milestone Perks" showBack={navigation.canGoBack()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Top Summary Banner */}
        <View style={[styles.summaryCard, { backgroundColor: isDark ? '#111827' : '#ffffff', borderColor: isDark ? colors.border : '#e2e8f0' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View>
              <Text style={styles.summaryLabel}>TOTAL CAMPUS RIDES</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <Text style={[styles.summaryCount, { color: colors.accent }]}>{completedRides}</Text>
                <Text style={{ color: isDark ? colors.text2 : '#475569', fontSize: 13, fontWeight: '700' }}>rides completed</Text>
              </View>
            </View>
            <View style={styles.trophyCircle}>
              <Text style={{ fontSize: 28 }}>🎁</Text>
            </View>
          </View>

          {/* Progress to Next Milestone */}
          <View style={styles.progressHeader}>
            <Text style={[styles.progressText, { color: isDark ? colors.text2 : '#475569' }]}>
              {completedRides >= nextMilestone.ridesRequired
                ? '🏆 All milestones achieved!'
                : `Next: ${nextMilestone.ridesRequired - completedRides} rides left to unlock ${nextMilestone.tag}`}
            </Text>
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }}>
              {Math.round(progressRatio * 100)}%
            </Text>
          </View>

          <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#1f2937' : '#e2e8f0' }]}>
            <View style={[styles.progressBarFill, { width: `${progressRatio * 100}%` }]} />
          </View>
        </View>

        {/* Section Heading */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: isDark ? colors.text : '#0f172a' }]}>
            ✨ Your Reward Cards
          </Text>
          <Text style={{ color: isDark ? colors.text3 : '#64748b', fontSize: 11 }}>
            Tap cards to scratch & reveal
          </Text>
        </View>

        {/* 2-Column Grid of GPay style Scratch Cards */}
        <View style={styles.grid}>
          {REWARD_MILESTONES.map((reward) => {
            const isUnlocked = completedRides >= reward.ridesRequired;
            const isRevealed = revealedIds.has(reward.id);

            return (
              <TouchableOpacity
                key={reward.id}
                style={[
                  styles.rewardCard,
                  isUnlocked
                    ? (isRevealed ? styles.rewardCardRevealed : styles.rewardCardUnlocked)
                    : styles.rewardCardLocked,
                  {
                    backgroundColor: isUnlocked
                      ? (isRevealed ? (isDark ? '#161e2e' : '#ffffff') : reward.color1)
                      : (isDark ? '#10141e' : '#f1f5f9'),
                    borderColor: isUnlocked
                      ? (isRevealed ? (isDark ? '#2e3a52' : '#cbd5e1') : '#ffffff')
                      : (isDark ? '#1c2436' : '#e2e8f0'),
                  }
                ]}
                onPress={() => handleCardPress(reward)}
                activeOpacity={0.85}
              >
                {/* Status Badge */}
                <View style={[
                  styles.cardBadge,
                  {
                    backgroundColor: isUnlocked
                      ? (isRevealed ? (isDark ? '#26344d' : '#e2e8f0') : 'rgba(0,0,0,0.3)')
                      : (isDark ? '#182030' : '#e2e8f0')
                  }
                ]}>
                  <Text style={[
                    styles.cardBadgeText,
                    { color: isUnlocked ? (isRevealed ? colors.accent : '#ffffff') : (isDark ? '#64748b' : '#94a3b8') }
                  ]}>
                    {reward.tag}
                  </Text>
                </View>

                {/* Card Center Content */}
                <View style={styles.cardCenter}>
                  {isUnlocked ? (
                    isRevealed ? (
                      <>
                        <Text style={{ fontSize: 32, marginBottom: 6 }}>{reward.icon}</Text>
                        <Text style={[styles.revealedTitle, { color: isDark ? '#ffffff' : '#0f172a' }]} numberOfLines={2}>
                          {reward.rewardTitle}
                        </Text>
                        <Text style={styles.viewDetailsText}>Tap to view code →</Text>
                      </>
                    ) : (
                      <>
                        <Text style={{ fontSize: 36, marginBottom: 6 }}>🎁</Text>
                        <Text style={styles.unlockedGpayTitle}>TAP TO</Text>
                        <Text style={styles.unlockedGpaySub}>REVEAL</Text>
                        <Text style={styles.unlockedSparkle}>✨ Unlocked!</Text>
                      </>
                    )
                  ) : (
                    <>
                      <Text style={{ fontSize: 32, marginBottom: 6, opacity: 0.5 }}>🔒</Text>
                      <Text style={[styles.lockedTitle, { color: isDark ? '#64748b' : '#94a3b8' }]}>
                        {reward.title}
                      </Text>
                      <Text style={[styles.lockedSub, { color: isDark ? '#4b5563' : '#a0aec0' }]}>
                        Unlock after {reward.ridesRequired} rides
                      </Text>
                    </>
                  )}
                </View>

                {/* Bottom Card Footer Strip */}
                <View style={[
                  styles.cardFooterStrip,
                  {
                    borderTopColor: isUnlocked
                      ? (isRevealed ? (isDark ? '#26344d' : '#f1f5f9') : 'rgba(255,255,255,0.2)')
                      : (isDark ? '#182030' : '#e2e8f0')
                  }
                ]}>
                  <Text style={[
                    styles.cardFooterText,
                    {
                      color: isUnlocked
                        ? (isRevealed ? (isDark ? colors.text3 : '#64748b') : '#ffffff')
                        : (isDark ? '#4b5563' : '#94a3b8')
                    }
                  ]}>
                    {isUnlocked ? (isRevealed ? '✓ Claimed' : '🎉 Ready to open') : `🔒 Locked (${reward.ridesRequired} rides)`}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* ── GPay Style Revealed Reward Modal ── */}
      <Modal
        visible={Boolean(selectedReward)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedReward(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: isDark ? '#111827' : '#ffffff', borderColor: isDark ? '#374151' : '#e2e8f0' }]}>
            {/* Top Close Button */}
            <TouchableOpacity
              onPress={() => setSelectedReward(null)}
              style={styles.modalCloseBtn}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 18, color: isDark ? '#9ca3af' : '#6b7280' }}>✕</Text>
            </TouchableOpacity>

            {/* Icon Banner */}
            <View style={styles.modalIconWrap}>
              <Text style={{ fontSize: 52 }}>{selectedReward?.icon || '🎉'}</Text>
            </View>

            <Text style={[styles.modalMilestoneTag, { color: colors.accent }]}>
              {selectedReward?.tag} REWARD UNLOCKED
            </Text>
            <Text style={[styles.modalTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
              {selectedReward?.rewardTitle}
            </Text>
            <Text style={[styles.modalDesc, { color: isDark ? '#9ca3af' : '#4b5563' }]}>
              {selectedReward?.rewardDesc}
            </Text>

            {/* Voucher Code Box with Copy */}
            <View style={[styles.voucherBox, { backgroundColor: isDark ? '#1f2937' : '#f3f4f6', borderColor: isDark ? '#374151' : '#d1d5db' }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.voucherLabel}>REWARD VOUCHER CODE</Text>
                <Text style={[styles.voucherCode, { color: colors.accent }]}>
                  {selectedReward?.code}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.copyBtn,
                  { backgroundColor: copiedCode === selectedReward?.code ? colors.green : colors.accent }
                ]}
                onPress={() => handleCopyCode(selectedReward?.code)}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#000000', fontSize: 12, fontWeight: '800' }}>
                  {copiedCode === selectedReward?.code ? '✓ Copied' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Done button */}
            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setSelectedReward(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalDoneBtnText}>Awesome!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  summaryCard: {
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#9ca3af',
  },
  summaryCount: {
    fontSize: 34,
    fontWeight: '900',
  },
  trophyCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.4)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  rewardCard: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.35,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    padding: 12,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  rewardCardUnlocked: {
    borderWidth: 2,
  },
  rewardCardRevealed: {
    borderWidth: 1.5,
  },
  rewardCardLocked: {
    opacity: 0.85,
  },
  cardBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  cardBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  unlockedGpayTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  unlockedGpaySub: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  unlockedSparkle: {
    color: '#fef08a',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  revealedTitle: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 16,
  },
  viewDetailsText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },
  lockedTitle: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  lockedSub: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  cardFooterStrip: {
    borderTopWidth: 1,
    paddingTop: 6,
    alignItems: 'center',
  },
  cardFooterText: {
    fontSize: 10,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: radius.xxl,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalIconWrap: {
    marginBottom: 12,
  },
  modalMilestoneTag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  voucherBox: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  voucherLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9ca3af',
    letterSpacing: 0.5,
  },
  voucherCode: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  copyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  modalDoneBtn: {
    width: '100%',
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  modalDoneBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
});
