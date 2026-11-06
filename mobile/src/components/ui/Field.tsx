import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font } from "@/theme";
import { inputStyles } from "./inputStyles";
import { Row } from "./Row";

// Labelled text input with an optional character counter, hint, warning or error.
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  multiline,
  keyboardType,
  maxLength,
  counter,
  secureTextEntry,
  autoCapitalize = "sentences",
  autoComplete,
  onSubmitEditing,
  editable = true,
  warning,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  error?: string;
  warning?: string;
  hint?: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "email-address" | "decimal-pad";
  maxLength?: number;
  counter?: { length: number; max: number };
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words";
  autoComplete?: "email" | "password" | "name" | "off";
  onSubmitEditing?: () => void;
  editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const over = counter && counter.length > counter.max;
  return (
    <View style={{ gap: 7 }}>
      <View style={inputStyles.labelRow}>
        <Text style={font.label}>{label}</Text>
        {counter ? (
          <Text style={[inputStyles.counter, over && { color: colors.danger }]}>
            {counter.length}/{counter.max}
          </Text>
        ) : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={!secureTextEntry}
        onSubmitEditing={onSubmitEditing}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        style={[
          inputStyles.input,
          multiline && styles.multiline,
          focused && inputStyles.focused,
          !editable && {
            backgroundColor: colors.surface3,
            color: colors.muted,
          },
          error && {
            borderColor: colors.danger,
            backgroundColor: colors.surface,
          },
          warning && !error && { borderColor: "#E8B04C" },
        ]}
      />
      {error ? (
        <Row style={{ gap: 5 }}>
          <Ionicons name="alert-circle" size={14} color={colors.danger} />
          <Text
            style={[inputStyles.errorText, { flex: 1 }]}
            accessibilityLiveRegion="polite"
          >
            {error}
          </Text>
        </Row>
      ) : warning ? (
        <Text style={[inputStyles.errorText, { color: colors.warn }]}>
          {warning}
        </Text>
      ) : hint ? (
        <Text style={font.small}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  multiline: { minHeight: 120, textAlignVertical: "top", lineHeight: 22 },
});
