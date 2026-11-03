import React from 'react';
import {
  StyleSheet, Switch, Text, View,
} from 'react-native';
import { colors, font, space } from '@/theme';

// Label (and optional hint) with an on/off switch on the right.
export function SwitchRow({ label, hint, value, onChange }: {
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={font.small}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.line2, true: colors.accent }}
        thumbColor="#FFFFFF"
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 4 },
  label: { fontSize: 15, fontWeight: '600', color: colors.ink },
});
