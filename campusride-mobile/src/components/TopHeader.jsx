import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Alert as RNAlert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../theme';
import * as api from '../services/api';

export default function TopHeader({ title = 'HOGO', subtitle = 'Find Your Match' }) {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [unreadCount, setUnreadCount]   = useState(0);

  const isProvider = user?.role === 'provider' || user?.role === 'both';
  const isAdmin    = user?.role === 'admin';

  useEffect(() => {
    let mounted = true;
    api.getNotifications()
      .then(res => {
        if (!mounted) return;
        const list = Array.isArray(res) ? res : res?.notifications || [];
        const unread = list.filter(n => !n.read && !n.isRead).length;
        setUnreadCount(unread);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [modalVisible]);

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

  return (
    <>
      <View style={styles.header}>
        {/* Brand */}
        <View style={styles.brandContainer}>
          <Text style={styles.brandLogo}>⚡</Text>
          <View>
            <Text style={styles.brandTitle}>{title}</Text>
            {subtitle ? <Text style={styles.brandSub}>{subtitle}</Text> : null}
          </View>
        </View>

        {/* Right Actions */}
        <View style={styles.rightActions}>
          {/* Notification Button */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navTo('Notifications')}
            activeOpacity={0.7}
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
            style={styles.avatarBtn}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
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
          <View style={styles.dropdownCard}>
            {/* User Header */}
            <View style={styles.dropdownUser}>
              <View style={styles.largeAvatar}>
                <Text style={styles.largeAvatarText}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName} numberOfLines={1}>{user?.name || 'HOGO User'}</Text>
                <Text style={styles.userEmail} numberOfLines={1}>{user?.email}</Text>
                {user?.college && <Text style={styles.userCollege} numberOfLines={1}>🏫 {user.college}</Text>}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Quick Access Menu Items */}
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.menuHeader}>QUICK ACCESS</Text>

              <MenuItem icon="👤" label="My Profile" onPress={() => navTo('Profile')} />
              <MenuItem icon="📋" label="My Bookings" onPress={() => navTo('MyBookings')} />
              {isProvider && (
                <MenuItem icon="📬" label="Ride Requests" onPress={() => navTo('ProviderBookings')} />
              )}
              <MenuItem icon="📍" label="Track Active Ride" onPress={() => navTo('LiveTracking')} />
              <MenuItem icon="🛡️" label="KYC Verification" onPress={() => navTo('KYC')} />
              <MenuItem icon="⭐" label="Ratings & Reviews" onPress={() => navTo('Ratings')} />
              <MenuItem icon="⚠️" label="Report Incident" onPress={() => navTo('IncidentReport')} />

              {isAdmin && (
                <MenuItem icon="🛡️" label="Admin Dashboard" onPress={() => navTo('AdminDashboard')} highlight />
              )}

              <MenuItem icon="📞" label="Contact Support" onPress={() => navTo('ContactSupport')} />

              <View style={styles.divider} />

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

function MenuItem({ icon, label, onPress, highlight }) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, highlight && styles.menuItemHighlight]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={[styles.menuLabel, highlight && { color: colors.accent, fontWeight: '700' }]}>
        {label}
      </Text>
      <Text style={styles.menuArrow}>›</Text>
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
  brandContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandLogo: { fontSize: 24 },
  brandTitle: { color: colors.accent, fontSize: 20, fontWeight: '900', letterSpacing: 1 },
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
