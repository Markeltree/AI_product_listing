// Design tokens. Same brand colors as the web app so both feel like one product.

export const colors = {
  bg: '#F7F5F2',
  surface: '#FFFFFF',
  surface2: '#FAF8F5',
  surface3: '#F1EDE7',
  ink: '#17140F',
  ink2: '#4A453E',
  muted: '#8B847A',
  placeholder: '#B3ACA1',
  line: '#ECE7E0',
  line2: '#DDD6CC',
  accent: '#E4572E',
  accentDark: '#C2441E',
  accent50: '#FFF2EC',
  accent100: '#FFE2D6',
  ok: '#178A5A',
  okDark: '#136B47',
  ok50: '#E8F6EF',
  warn: '#9A5B00',
  warn50: '#FFF6E3',
  danger: '#C93A2B',
  dangerDark: '#A8322A',
  danger50: '#FDEDEB',
  info: '#2563EB',
  infoDark: '#1D4ED8',
  info50: '#EDF3FF',
};

export const radius = { xs: 8, sm: 12, md: 14, lg: 20, xl: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const font = {
  display: { fontSize: 30, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.8 },
  title: { fontSize: 28, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.6 },
  h2: { fontSize: 17, fontWeight: '700' as const, color: colors.ink, letterSpacing: -0.2 },
  body: { fontSize: 15, color: colors.ink2, lineHeight: 22 },
  small: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.ink2 },
  overline: { fontSize: 11.5, fontWeight: '700' as const, color: colors.muted, letterSpacing: 0.9, textTransform: 'uppercase' as const },
};

// Soft shadow for cards; Android uses elevation instead.
export const shadow = {
  shadowColor: '#2B2118',
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};

// Warm glow under primary buttons.
export const glow = {
  shadowColor: colors.accent,
  shadowOpacity: 0.28,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
};
