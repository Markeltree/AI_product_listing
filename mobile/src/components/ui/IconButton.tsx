import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import type { IconName } from './types';

// Small square icon button for row actions (move, delete, open).
export function IconButton({ icon, onPress, label, color = colors.ink2, disabled = false, tone = 'plain', size = 36 }: {
  icon: IconName; onPress: () => void; label: string; color?: string; disabled?: boolean;
  tone?: 'plain' | 'soft' | 'danger'; size?: number;
}) {
  const bg = { plain: 'transparent', soft: colors.surface3, danger: colors.danger50 }[tone];
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.btn,
        { width: size, height: size, backgroundColor: bg },
        disabled && { opacity: 0.3 },
        pressed && !disabled && { opacity: 0.6 },
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={tone === 'danger' ? colors.danger : color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
