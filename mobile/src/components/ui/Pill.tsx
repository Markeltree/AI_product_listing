import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';
import type { Tone } from './types';

export const TONE_COLORS: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surface3, fg: '#6B6B74' },
  accent: { bg: colors.accent50, fg: colors.accentDark },
  success: { bg: colors.ok50, fg: colors.okDark },
  warning: { bg: colors.warn50, fg: colors.warn },
  danger: { bg: colors.danger50, fg: colors.dangerDark },
  info: { bg: colors.info50, fg: colors.infoDark },
  dark: { bg: colors.ink, fg: '#FFFFFF' },
};

// Small rounded label: statuses ("Live", "Draft", "Ready"), counts and tags. `dot` adds a coloured dot.
export function Pill({ label, tone = 'neutral', dot = false, accessibilityLabel }: {
  label: string; tone?: Tone; dot?: boolean; accessibilityLabel?: string;
}) {
  const t = TONE_COLORS[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]} accessibilityLabel={accessibilityLabel}>
      {dot ? <View style={[styles.dot, { backgroundColor: tone === 'dark' ? '#4ADE80' : t.fg }]} /> : null}
      <Text style={[styles.text, { color: t.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 10, height: 26, borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontWeight: '700' },
});
