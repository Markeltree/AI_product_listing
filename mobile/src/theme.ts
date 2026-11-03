// Design tokens: warm orange accent, light grey background, white cards, near-black text.

export const colors = {
  bg: '#F4F4F6',          // cool light grey page background
  surface: '#FFFFFF',
  surface2: '#F8F8FA',
  surface3: '#EFEFF2',
  ink: '#141416',         // near-black text and dark round buttons
  ink2: '#45454D',
  muted: '#8A8A94',
  placeholder: '#B4B4BC',
  line: '#ECECF0',
  line2: '#DCDCE2',
  accent: '#FF7A1A',      // brand orange
  accentDark: '#E2600A',
  accent50: '#FFF2E8',
  accent100: '#FFE0C7',
  hero: '#FF8A2B',        // orange header background
  heroDeep: '#FF6A0D',    // darker orange for the header's decorative shapes
  ok: '#178A5A',
  okDark: '#136B47',
  ok50: '#E6F6EE',
  warn: '#9A5B00',
  warn50: '#FFF6E3',
  danger: '#D13B2C',
  dangerDark: '#A8322A',
  danger50: '#FDEDEB',
  info: '#2563EB',
  infoDark: '#1D4ED8',
  info50: '#EDF3FF',
};

export const radius = { xs: 8, sm: 12, md: 16, lg: 22, xl: 28, pill: 999 };
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
  shadowColor: '#1A1A24',
  shadowOpacity: 0.07,
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

// Space the floating tab bar takes at the bottom of tab screens (bar + gap), so content can scroll clear of it.
export const TAB_BAR_SPACE = 104;
