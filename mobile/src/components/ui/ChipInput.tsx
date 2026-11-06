import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, radius } from "@/theme";
import { inputStyles } from "./inputStyles";

// Tag and keyword input. Return, comma or leaving the field adds a chip. Tap a chip to remove it.
export function ChipInput({
  values,
  onChange,
  placeholder,
  maxCount,
  maxLength,
  label,
  hint,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  maxCount?: number;
  maxLength?: number;
  label: string;
  hint?: string;
}) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const add = (raw: string) => {
    const parts = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const next = [...values];
    for (const p of parts) {
      if (maxCount && next.length >= maxCount) break;
      if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    if (next.length !== values.length) onChange(next);
    setDraft("");
  };
  return (
    <View style={{ gap: 7 }}>
      <View style={inputStyles.labelRow}>
        <Text style={font.label}>{label}</Text>
        {maxCount ? (
          <Text
            style={[
              inputStyles.counter,
              values.length > maxCount && { color: colors.danger },
            ]}
          >
            {values.length}/{maxCount}
          </Text>
        ) : null}
      </View>
      <View style={[styles.box, focused && inputStyles.focused]}>
        {values.map((v, i) => (
          <Pressable
            key={`${v}-${i}`}
            onPress={() => onChange(values.filter((_, j) => j !== i))}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${v}`}
            style={[
              styles.chip,
              maxLength !== undefined && v.length > maxLength
                ? styles.chipLong
                : undefined,
            ]}
          >
            <Text style={styles.chipText} numberOfLines={1}>
              {v}
            </Text>
            <Ionicons name="close" size={13} color={colors.accentDark} />
          </Pressable>
        ))}
        <TextInput
          value={draft}
          onChangeText={(t) => {
            if (/[,\n]/.test(t)) add(t);
            else setDraft(t);
          }}
          onSubmitEditing={() => add(draft)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (draft.trim()) add(draft);
          }}
          placeholder={values.length ? "" : placeholder}
          placeholderTextColor={colors.placeholder}
          returnKeyType="done"
          blurOnSubmit={false}
          style={styles.input}
          accessibilityLabel={`${label} input`}
        />
      </View>
      {hint ? <Text style={font.small}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    alignItems: "center",
    minHeight: 50,
    padding: 9,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 30,
    paddingLeft: 12,
    paddingRight: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.accent50,
    borderWidth: 1,
    borderColor: colors.accent100,
  },
  chipLong: { backgroundColor: colors.warn50, borderColor: "#F0D28A" },
  chipText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.accentDark,
    maxWidth: 220,
  },
  input: {
    flexGrow: 1,
    minWidth: 120,
    height: 32,
    fontSize: 15,
    color: colors.ink,
    paddingHorizontal: 4,
  },
});
