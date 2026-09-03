import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, radius } from '../theme';

export default function FloatingChatBot() {
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => navigation.navigate('ChatBot')}
      activeOpacity={0.85}
    >
      <View style={styles.iconCircle}>
        <Text style={{ fontSize: 24 }}>🤖</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>HOGO AI</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#121722',
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
  },
  badgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
