import React, { useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, space } from '@/theme';
import { inputStyles } from './inputStyles';

// Dropdown that opens a bottom sheet. Works the same on iOS, Android and web.
export function Select({ label, value, options, onChange, placeholder = 'Choose', hint, error }: {
  label: string; value: string | null | undefined; options: { value: string; label: string }[];
  onChange: (v: string) => void; placeholder?: string; hint?: string; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label;
  return (
    <View style={{ gap: 7 }}>
      <Text style={font.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="combobox"
        accessibilityLabel={label}
        style={[inputStyles.input, styles.box, open && inputStyles.focused, error && { borderColor: colors.danger }]}
      >
        <Text style={[styles.value, !current && { color: colors.placeholder }]} numberOfLines={1}>
          {current ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={17} color={colors.muted} />
      </Pressable>
      {error ? <Text style={inputStyles.errorText}>{error}</Text> : hint ? <Text style={font.small}>{hint}</Text> : null}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={[font.h2, { marginBottom: space.sm }]}>{label}</Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {options.map((o) => {
              const on = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => { onChange(o.value); setOpen(false); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [styles.option, on && { backgroundColor: colors.accent50 }, pressed && { backgroundColor: colors.surface3 }]}
                >
                  <Text style={[styles.optionText, on && styles.optionTextOn]}>{o.label}</Text>
                  {on ? <Ionicons name="checkmark-circle" size={21} color={colors.accent} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { fontSize: 15, color: colors.ink, flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(20,20,22,0.45)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: space.lg + 2, paddingBottom: space.xxl },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.line2, marginBottom: space.lg },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginBottom: 2 },
  optionText: { flex: 1, fontSize: 16, color: colors.ink, fontWeight: '400' },
  optionTextOn: { color: colors.accentDark, fontWeight: '600' },
});
