// Shared reusable components used across all screens
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ActivityIndicator,
  StyleSheet, Platform,
} from 'react-native';
import { colors, radius, spacing, commonStyles } from '../theme';

// ── Button ────────────────────────────────────────────
export function Btn({ label, onPress, variant = 'primary', loading = false, disabled = false, style, textStyle, icon }) {
  const isPrimary  = variant === 'primary';
  const isOutline  = variant === 'outline';
  const isGhost    = variant === 'ghost';
  const isDanger   = variant === 'danger';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        styles.btn,
        isPrimary && styles.btnPrimary,
        isOutline && styles.btnOutline,
        isGhost   && styles.btnGhost,
        isDanger  && styles.btnDanger,
        (disabled || loading) && styles.btnDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary || isDanger ? '#000' : colors.accent} size="small" />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon && <Text style={{ fontSize: 16 }}>{icon}</Text>}
          <Text style={[
            styles.btnText,
            isPrimary && styles.btnPrimaryText,
            isOutline && styles.btnOutlineText,
            isGhost   && styles.btnGhostText,
            isDanger  && styles.btnDangerText,
            textStyle,
          ]}>
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Input ─────────────────────────────────────────────
export function Input({ label, error, icon, rightIcon, style, containerStyle, ...props }) {
  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrap, error && { borderColor: colors.red }]}>
        {icon && <Text style={styles.inputIcon}>{icon}</Text>}
        <TextInput
          style={[styles.input, icon && { paddingLeft: 40 }, rightIcon && { paddingRight: 40 }, style]}
          placeholderTextColor={colors.text3}
          autoCapitalize="none"
          {...props}
        />
        {rightIcon && (
          <View style={styles.rightIcon}>{rightIcon}</View>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ── Card ──────────────────────────────────────────────
export function Card({ children, style, onPress }) {
  if (onPress) {
    return (
      <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

// ── Badge ─────────────────────────────────────────────
export function Badge({ label, color = colors.accent, style }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '55' }, style]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ── Alert ─────────────────────────────────────────────
export function Alert({ message, type = 'error' }) {
  if (!message) return null;
  const bg = type === 'success' ? colors.greenDim : type === 'warning' ? colors.accentDim : colors.redDim;
  const fg = type === 'success' ? colors.green    : type === 'warning' ? colors.accent    : colors.red;
  return (
    <View style={[styles.alert, { backgroundColor: bg, borderColor: fg + '44' }]}>
      <Text style={{ color: fg, fontSize: 13 }}>{message}</Text>
    </View>
  );
}

// ── SectionHeader ────────────────────────────────────
export function SectionHeader({ title, subtitle }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={{ color: colors.text2, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>}
    </View>
  );
}

// ── Divider ───────────────────────────────────────────
export function Divider({ label }) {
  if (!label) return <View style={styles.divider} />;
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerLabel}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

// ── EmptyState ────────────────────────────────────────
export function EmptyState({ icon, title, subtitle, action, actionLabel }) {
  return (
    <View style={styles.emptyState}>
      <Text style={{ fontSize: 52, marginBottom: 12 }}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
      {action && actionLabel && (
        <Btn label={actionLabel} onPress={action} style={{ marginTop: 20, minWidth: 160 }} />
      )}
    </View>
  );
}

// ── Toggle pill ───────────────────────────────────────
export function TogglePill({ options, value, onChange }) {
  return (
    <View style={styles.toggleRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={[styles.togglePill, value === opt.value && styles.togglePillActive]}
        >
          {opt.icon && <Text style={{ fontSize: 13, marginRight: 4 }}>{opt.icon}</Text>}
          <Text style={[styles.togglePillText, value === opt.value && styles.togglePillTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────
const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary:     { backgroundColor: colors.accent },
  btnOutline:     { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border2 },
  btnGhost:       { backgroundColor: 'transparent' },
  btnDanger:      { backgroundColor: colors.red },
  btnDisabled:    { opacity: 0.5 },
  btnText:        { fontSize: 15, fontWeight: '600' },
  btnPrimaryText: { color: '#000', fontWeight: '700' },
  btnOutlineText: { color: colors.text },
  btnGhostText:   { color: colors.text2 },
  btnDangerText:  { color: '#fff', fontWeight: '700' },

  label: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrap: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    fontSize: 15,
    zIndex: 1,
  },
  rightIcon: {
    position: 'absolute',
    right: 12,
  },
  input: {
    flex: 1,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 10,
    fontSize: 14,
  },
  errorText: {
    color: colors.red,
    fontSize: 12,
    marginTop: 4,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  badge: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: '700' },

  alert: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 12,
    marginBottom: spacing.sm,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerLabel: { color: colors.text3, fontSize: 12 },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: colors.text2,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 4,
    gap: 4,
  },
  togglePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  togglePillActive: { backgroundColor: colors.accent },
  togglePillText:   { color: colors.text2, fontSize: 13, fontWeight: '600' },
  togglePillTextActive: { color: '#000', fontWeight: '700' },
});
