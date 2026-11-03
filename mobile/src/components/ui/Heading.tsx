import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, space } from '@/theme';

// Page title. `eyebrow` is a small line above the title (for example the user's name).
export function Heading({ title, subtitle, right, eyebrow }: {
  title: string; subtitle?: string; right?: React.ReactNode; eyebrow?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: space.sm }}>
        {eyebrow ? <Text style={[font.overline, { marginBottom: 6 }]}>{eyebrow}</Text> : null}
        <Text style={font.title} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={[font.body, styles.subtitle]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.lg + 4 },
  subtitle: { marginTop: 6, color: colors.muted, fontSize: 14.5, lineHeight: 20 },
});
