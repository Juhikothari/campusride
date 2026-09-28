// campusride-mobile/src/components/admin/AdminHeader.jsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TouchableWithoutFeedback, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { key: 'Dashboard',   label: 'Dashboard',           icon: '📊', route: 'Dashboard' },
  { key: 'KYC',         label: 'KYC Verifications',   icon: '🪪', route: 'KYC' },
  { key: 'Users',       label: 'User Directory',      icon: '👥', route: 'Users' },
  { key: 'Rides',       label: 'Ride Operations',     icon: '🚗', route: 'Rides' },
  { key: 'Incidents',   label: 'Safety & Incidents',  icon: '🚨', route: 'Incidents' },
  { key: 'Broadcast',   label: 'Campus Broadcast',    icon: '📢', route: 'More', subScreen: 'Broadcast' },
  { key: 'AuditLogs',   label: 'Audit & System Logs', icon: '📜', route: 'More', subScreen: 'AuditLogs' },
  { key: 'MoreHome',    label: 'Tools & Settings',    icon: '⚙️', route: 'More', subScreen: 'MoreHome' },
];

export function AdminHeader({ title, badge = 'CAMPUS OPERATIONS', subtitle, rightElement }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigation = useNavigation();
  const currentRoute = useRoute();
  const { logout, user } = useAuth();

  const handleNavigate = (item) => {
    setMenuOpen(false);
    if (item.subScreen) {
      navigation.navigate(item.route, { screen: item.subScreen });
    } else {
      navigation.navigate(item.route);
    }
  };

  const handleSignOut = () => {
    setMenuOpen(false);
    logout();
  };

  return (
    <View style={styles.headerContainer}>
      <View style={styles.leftCol}>
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>

      <View style={styles.rightCol}>
        {rightElement}
        <TouchableOpacity
          style={styles.hamburgerBtn}
          onPress={() => setMenuOpen(true)}
          activeOpacity={0.7}
          accessibilityLabel="Open Admin Navigation Menu"
        >
          <View style={styles.line} />
          <View style={styles.line} />
          <View style={styles.line} />
        </TouchableOpacity>
      </View>

      {/* Admin Quick-Nav Modal Menu */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.drawerCard}>
                <View style={styles.drawerHeader}>
                  <View>
                    <Text style={styles.drawerBadge}>HOGO ADMIN MENU</Text>
                    <Text style={styles.drawerTitle}>Control Center</Text>
                    <Text style={styles.drawerUser} numberOfLines={1}>
                      {user?.name || 'Administrator'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setMenuOpen(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.navDivider} />

                <View style={styles.navList}>
                  {NAV_ITEMS.map((item) => {
                    const isActive = currentRoute?.name === item.route;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[styles.navRow, isActive && styles.navRowActive]}
                        onPress={() => handleNavigate(item)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.navIcon}>{item.icon}</Text>
                        <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                          {item.label}
                        </Text>
                        {isActive && <Text style={styles.activePill}>ACTIVE</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.navDivider} />

                <TouchableOpacity
                  style={styles.signOutRow}
                  onPress={handleSignOut}
                  activeOpacity={0.75}
                >
                  <Text style={styles.signOutIcon}>🚪</Text>
                  <Text style={styles.signOutText}>Exit Admin / Sign Out</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    backgroundColor: '#07090d',
  },
  leftCol: {
    flex: 1,
    paddingRight: 8,
  },
  badge: {
    color: '#2dd4a0',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    color: '#f0f6fc',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sub: {
    color: '#8b949e',
    fontSize: 11,
    marginTop: 2,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hamburgerBtn: {
    width: 42,
    height: 42,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  line: {
    width: '100%',
    height: 2.5,
    backgroundColor: '#2dd4a0',
    borderRadius: 2,
    marginVertical: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 56 : 28,
    paddingRight: 12,
  },
  drawerCard: {
    width: 270,
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  drawerBadge: {
    color: '#2dd4a0',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  drawerTitle: {
    color: '#f0f6fc',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  drawerUser: {
    color: '#8b949e',
    fontSize: 11,
    marginTop: 2,
    maxWidth: 180,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#161b22',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  closeBtnText: {
    color: '#8b949e',
    fontSize: 13,
    fontWeight: '700',
  },
  navDivider: {
    height: 1,
    backgroundColor: '#21262d',
    marginVertical: 10,
  },
  navList: {
    gap: 4,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  navRowActive: {
    backgroundColor: 'rgba(45, 212, 160, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 160, 0.25)',
  },
  navIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  navLabel: {
    color: '#c9d1d9',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  navLabelActive: {
    color: '#2dd4a0',
    fontWeight: '700',
  },
  activePill: {
    color: '#2dd4a0',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    backgroundColor: 'rgba(45, 212, 160, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 82, 82, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.2)',
  },
  signOutIcon: {
    fontSize: 15,
    marginRight: 10,
  },
  signOutText: {
    color: '#ff5252',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default AdminHeader;
