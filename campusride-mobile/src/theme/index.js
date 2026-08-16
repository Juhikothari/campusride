// Design tokens — mirrors the web app CSS variables exactly
export const colors = {
  bg:         '#07090d',
  bg2:        '#0c0f17',
  surface:    '#101520',
  surface2:   '#161c2a',
  surface3:   '#1d2438',
  border:     '#212840',
  border2:    '#2c3454',

  accent:     '#f5a623',
  accentDim:  'rgba(245,166,35,0.10)',
  accentGlow: 'rgba(245,166,35,0.25)',
  accent2:    '#e8552e',
  green:      '#2dd4a0',
  greenDim:   'rgba(45,212,160,0.10)',
  blue:       '#4fa3e0',
  red:        '#e05555',
  redDim:     'rgba(224,85,85,0.10)',
  pink:       '#e91e8c',

  text:       '#edf0f7',
  text2:      '#8b96b0',
  text3:      '#4e566d',
};

export const radius = {
  sm:  8,
  md:  10,
  lg:  16,
  xl:  22,
  full: 999,
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const typography = {
  display: {
    fontFamily: 'System',
    fontWeight: '800',
  },
  heading: {
    fontFamily: 'System',
    fontWeight: '700',
  },
  body: {
    fontFamily: 'System',
    fontWeight: '400',
  },
};

// Common shared styles
export const commonStyles = {
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  input: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  btn: {
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.accent,
  },
  btnPrimaryText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border2,
  },
  btnOutlineText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  label: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  muted: {
    color: colors.text2,
    fontSize: 13,
  },
  errorText: {
    color: colors.red,
    fontSize: 13,
    marginTop: 4,
  },
};
