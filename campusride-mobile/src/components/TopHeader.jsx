import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Alert as RNAlert, DeviceEventEmitter,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';

import { subscribeToNotifications, getSharedSocket } from '../hooks/useSocket';

function getHeaderEmoji(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('get a buddy') || t.includes('offer')) return '🚗';
  if (t.includes('search') || t.includes('find')) return '🔍';
  if (t.includes('walk') || t.includes('nadi')) return '🚶';
  if (t.includes('community') || t.includes('sitcom') || t.includes('lounge') || t.includes('perk') || t.includes('dunder') || t.includes('99th') || t.includes('caltech')) return '🛋️';
  if (t.includes('kyc') || t.includes('verification')) return '🛡️';
  if (t.includes('profile')) return '👤';
  if (t.includes('report') || t.includes('incident')) return '⚠️';
  if (t.includes('support') || t.includes('contact')) return '📞';
  if (t.includes('checklist')) return '🛡️';
  if (t.includes('rating')) return '⭐';
  if (t.includes('assistant') || t.includes('bot')) return '🤖';
  if (t.includes('notification')) return '🔔';
  if (t.includes('booking') || t.includes('request')) return '📋';
  return '🛵';
}

export default function TopHeader({ title = 'HOGO', subtitle = 'Find Your Buddy', showBack, highlightProfile = false }) {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const { isDark, colors: tc } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [unreadCount, setUnreadCount]   = useState(0);

  const isProvider = user?.role === 'provider' || user?.role === 'both';
  const isAdmin    = user?.role === 'admin';

  useEffect(() => {
    let mounted = true;
    const userId = user?._id || user?.userId;
    if (userId) {
      getSharedSocket(userId, user?.role);
    }

    const fetchUnread = () => {
      AsyncStorage.getItem('@read_notif_ids').then(raw => {
        let localRead = new Set();
        if (raw) {
          try { localRead = new Set(JSON.parse(raw)); } catch {}
        }
        api.getNotifications()
          .then(res => {
            if (!mounted) return;
            let unread = 0;
            const list = Array.isArray(res) ? res : res?.notifications || [];
            unread = list.filter(n => !n.readAt && !n.read && !n.isRead && !localRead.has(n._id || n.id)).length;
            setUnreadCount(unread);
          })
          .catch(() => {});
      }).catch(() => {});
    };

    fetchUnread();

    // Instant real-time socket badge update
    const unsubSocket = subscribeToNotifications((event) => {
      if (['new-notification', 'new-booking', 'booking-response', 'rider-arrived', 'booking-update'].includes(event)) {
        fetchUnread();
      }
    });

    // Device events to immediately reset or update badge when notifications are viewed/read
    const subRead = DeviceEventEmitter.addListener('NOTIFICATIONS_READ', () => {
      if (mounted) setUnreadCount(0);
    });
    const subCount = DeviceEventEmitter.addListener('NOTIFICATION_COUNT_CHANGED', (count) => {
      if (mounted) setUnreadCount(count);
    });

    // Navigation focus listener to update whenever screen appears
    const unsubFocus = navigation?.addListener ? navigation.addListener('focus', fetchUnread) : () => {};

    const interval = setInterval(fetchUnread, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
      unsubSocket();
      subRead.remove();
      subCount.remove();
      unsubFocus();
    };
  }, [user?._id, user?.userId, navigation]);

  const handleLogout = () => {
    setModalVisible(false);
    RNAlert.alert('Sign Out', 'Are you sure you want to sign out of HOGO?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const navTo = (screenName, params = {}) => {
    setModalVisible(false);
    navigation.navigate(screenName, params);
  };

  const initials = (user?.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const isDashboard = (title === 'HOGO' || title === 'Dashboard') && subtitle === 'Find Your Match';
  const canGoBack = showBack === false || isDashboard ? false : (showBack === true ? true : (navigation?.canGoBack ? navigation.canGoBack() : false));
  const emoji = getHeaderEmoji(title);

  return (
    <>
      <View style={[styles.header, { backgroundColor: isDark ? colors.surface : "#ffffff", borderBottomColor: isDark ? colors.border : "#e2e8f0" }]}>
        {/* Brand with Back Button */}
        <View style={styles.brandContainer}>
          {canGoBack && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Go back to previous screen"
            >
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.brandLogo}>{emoji}</Text>
          <View style={{ flexShrink: 1 }}>
            <Text style={[styles.brandTitle, { color: isDark ? '#edf0f7' : '#0f172a' }]} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={[styles.brandSub, { color: isDark ? '#8b96b0' : '#475569' }]} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>

        {/* Right Actions */}
        <View style={styles.rightActions}>
          {/* Notification Button */}
          <TouchableOpacity
            style={[
              styles.iconBtn,
              {
                backgroundColor: isDark ? colors.surface : '#f1f5f9',
                borderColor: isDark ? colors.border : '#cbd5e1',
              }
            ]}
            onPress={() => navTo('Notifications')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Notifications, ${unreadCount} unread`}
          >
            <Text style={{ fontSize: 20 }}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Profile Avatar Button */}
          <TouchableOpacity
            style={[styles.avatarBtn, highlightProfile && { borderColor: '#f5a623', borderWidth: 2.5, backgroundColor: 'rgba(245,166,35,0.25)', shadowColor: '#f5a623', shadowRadius: 10, shadowOpacity: 0.8, elevation: 8 }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open user menu"
          >
            <Text style={styles.avatarBtnText}>{initials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile Dropdown / Quick Access Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={[styles.dropdownCard, { backgroundColor: isDark ? "#101520" : "#ffffff", borderColor: isDark ? colors.border : "#cbd5e1" }]}>
            {/* User Header */}
            <View style={styles.dropdownUser}>
              <View style={styles.largeAvatar}>
                <Text style={styles.largeAvatarText}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.userName, { color: isDark ? colors.text : "#0f172a" }]} numberOfLines={1}>{user?.name || 'HOGO User'}</Text>
                <Text style={[styles.userEmail, { color: isDark ? colors.text3 : '#64748b' }]} numberOfLines={1}>{user?.email}</Text>
                {user?.college && <Text style={[styles.userCollege, { color: isDark ? colors.text2 : '#475569' }]} numberOfLines={1}>🏫 {user.college}</Text>}
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: isDark ? colors.border : '#e2e8f0' }]} />

            {/* Quick Access Menu Items */}
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <Text style={[styles.menuHeader, { color: isDark ? colors.text3 : '#64748b' }]}>QUICK ACCESS</Text>

              <MenuItem icon="👤" label="My Profile" onPress={() => navTo('Profile')} isDark={isDark} />
              <MenuItem icon="📋" label="My Bookings" onPress={() => navTo('MyBookings')} isDark={isDark} />
              {isProvider && (
                <MenuItem icon="📬" label="Ride Requests" onPress={() => navTo('ProviderBookings')} isDark={isDark} />
              )}
              <MenuItem icon="📍" label="Track Active Ride" onPress={() => navTo('LiveTracking')} isDark={isDark} />
              <MenuItem icon="🛡️" label="KYC Verification" onPress={() => navTo('KYC')} isDark={isDark} />
              <MenuItem icon="⚠️" label="Report Incident" onPress={() => navTo('IncidentReport')} isDark={isDark} />

              {isAdmin && (
                <MenuItem icon="🛡️" label="Admin Dashboard" onPress={() => navTo('AdminDashboard')} highlight isDark={isDark} />
              )}

              <MenuItem icon="📞" label="Contact Support" onPress={() => navTo('ContactSupport')} isDark={isDark} />

              <View style={[styles.divider, { backgroundColor: isDark ? colors.border : '#e2e8f0' }]} />

              <TouchableOpacity style={styles.logoutItem} onPress={handleLogout}>
                <Text style={{ fontSize: 18 }}>🚪</Text>
                <Text style={styles.logoutText}>Sign Out</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function MenuItem({ icon, label, onPress, highlight, isDark }) {
  const textColor = highlight ? colors.accent : (isDark ? '#edf0f7' : '#0f172a');
  const arrowColor = isDark ? '#4e566d' : '#94a3b8';
  return (
    <TouchableOpacity
      style={[styles.menuItem, highlight && styles.menuItemHighlight]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={[styles.menuLabel, { color: textColor }, highlight && { color: colors.accent, fontWeight: '700' }]}>
        {label}
      </Text>
      <Text style={[styles.menuArrow, { color: arrowColor }]}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
  backBtn: {
    paddingRight: 6,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  brandLogo: { fontSize: 24 },
  brandTitle: { color: colors.accent, fontSize: 18, fontWeight: '800' },
  brandSub: { color: colors.text3, fontSize: 11, fontWeight: '600' },

  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  badge: {
    position: 'absolute', top: -3, right: -3,
    backgroundColor: colors.red, minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: colors.bg,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  avatarBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accentDim, borderWidth: 1.5, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarBtnText: { color: colors.accent, fontSize: 15, fontWeight: '800' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 65,
    paddingRight: 14,
  },
  dropdownCard: {
    width: 290,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  dropdownUser: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  largeAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.accentDim, borderWidth: 1.5, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  largeAvatarText: { color: colors.accent, fontSize: 18, fontWeight: '800' },
  userName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  userEmail: { color: colors.text3, fontSize: 11 },
  userCollege: { color: colors.text2, fontSize: 11, marginTop: 2 },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  menuHeader: { color: colors.text3, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 9,
    paddingHorizontal: 8, borderRadius: radius.md,
  },
  menuItemHighlight: { backgroundColor: colors.accentDim },
  menuIcon: { fontSize: 17, marginRight: 10, width: 24, textAlign: 'center' },
  menuLabel: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
  menuArrow: { color: colors.text3, fontSize: 16, fontWeight: '700' },

  logoutItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    paddingHorizontal: 8, borderRadius: radius.md, marginTop: 2,
  },
  logoutText: { color: colors.red, fontSize: 14, fontWeight: '700', marginLeft: 10 },
});
