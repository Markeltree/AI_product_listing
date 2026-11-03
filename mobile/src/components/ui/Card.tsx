import React from 'react';
import {
  StyleSheet, Text, View, type StyleProp, type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, shadow, space } from '@/theme';
import { Row } from './Row';
import type { IconName } from './types';

export function Card({ children, style, soft = false }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; soft?: boolean }) {
  return <View style={[styles.card, soft && styles.soft, style]}>{children}</View>;
}

// Title row for a card, with an optional icon and something on the right (count, badge).
export function CardHeader({ title, subtitle, icon, right }: {
  title: string; subtitle?: string; icon?: IconName; right?: React.ReactNode;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ flex: 1, gap: 10 }}>
          {icon ? <View style={styles.icon}><Ionicons name={icon} size={17} color={colors.accentDark} /></View> : null}
          <Text style={[font.h2, { flexShrink: 1 }]}>{title}</Text>
        </Row>
        {right}
      </Row>
      {subtitle ? <Text style={font.small}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line,
    padding: space.lg + 2, gap: space.md + 2, ...shadow,
  },
  soft: { backgroundColor: colors.surface2, shadowOpacity: 0, elevation: 0 },
  icon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.accent50, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...font.overline, marginTop: space.xl, marginBottom: space.sm, marginLeft: 2 },
});
