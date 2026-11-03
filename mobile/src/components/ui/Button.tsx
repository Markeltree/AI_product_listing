import React from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, glow, radius, space } from '@/theme';
import type { IconName } from './types';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';

const TONES: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.accent, fg: '#FFFFFF', border: colors.accent },
  secondary: { bg: colors.surface, fg: colors.ink, border: colors.line2 },
  ghost: { bg: 'transparent', fg: colors.ink2, border: 'transparent' },
  danger: { bg: colors.danger50, fg: colors.dangerDark, border: colors.danger50 },
  dark: { bg: colors.ink, fg: '#FFFFFF', border: colors.ink },
};

export function Button({
  title, onPress, variant = 'primary', loading = false, disabled = false, icon, style, full = false,
}: {
  title: string; onPress: () => void; variant?: ButtonVariant; loading?: boolean; disabled?: boolean;
  icon?: IconName; style?: StyleProp<ViewStyle>; full?: boolean;
}) {
  const isDisabled = disabled || loading;
  const tone = TONES[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: tone.bg, borderColor: tone.border },
        variant === 'primary' && !isDisabled && glow,
        full && { alignSelf: 'stretch' },
        isDisabled && { opacity: 0.45 },
        pressed && !isDisabled && { transform: [{ scale: 0.98 }], opacity: 0.88 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={tone.fg} /> : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={tone.fg} /> : null}
          <Text style={[styles.text, { color: tone.fg }]} numberOfLines={1}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 50, paddingHorizontal: space.lg + 2, borderRadius: radius.md, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  text: { fontSize: 15.5, fontWeight: '700', letterSpacing: -0.1, flexShrink: 1 },
});
