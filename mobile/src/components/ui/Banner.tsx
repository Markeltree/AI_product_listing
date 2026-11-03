import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '@/theme';

export type BannerTone = 'info' | 'warn' | 'error' | 'success';

const TONES = {
  info: { bg: colors.info50, fg: colors.infoDark, border: '#D6E3FD', icon: 'information-circle' as const },
  warn: { bg: colors.warn50, fg: colors.warn, border: '#F6E2B3', icon: 'alert-circle' as const },
  error: { bg: colors.danger50, fg: colors.dangerDark, border: '#F8D3CE', icon: 'close-circle' as const },
  success: { bg: colors.ok50, fg: colors.okDark, border: '#CBEBDB', icon: 'checkmark-circle' as const },
};

// Inline message box with an optional title and a link-style action.
export function Banner({ tone, title, text, action }: {
  tone: BannerTone; title?: string; text: string;
  action?: { label: string; onPress: () => void };
}) {
  const t = TONES[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg, borderColor: t.border }]} accessibilityRole="alert">
      <Ionicons name={t.icon} size={19} color={t.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 4 }}>
        {title ? <Text style={[styles.title, { color: t.fg }]}>{title}</Text> : null}
        <Text style={[styles.text, { color: t.fg }]}>{text}</Text>
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="link" hitSlop={6}>
            <Text style={[styles.title, { color: t.fg, textDecorationLine: 'underline' }]}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1 },
  title: { fontWeight: '700', fontSize: 14 },
  text: { fontSize: 14, lineHeight: 20 },
});
