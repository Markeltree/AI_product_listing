import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "@/theme";

export function StepDots({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  return (
    <View
      style={styles.dots}
      accessibilityLabel={`Step ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i <= current && { backgroundColor: colors.accent },
            i === current && { width: 24 },
          ]}
        />
      ))}
    </View>
  );
}

// Numbered steps with labels, joined by lines. Finished steps show a check.
export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <View
      style={styles.stepper}
      accessibilityLabel={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}
    >
      {steps.map((label, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <React.Fragment key={label}>
            <View style={styles.item}>
              <View
                style={[styles.num, done && styles.numDone, on && styles.numOn]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : (
                  <Text style={[styles.numText, on && { color: "#FFFFFF" }]}>
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[styles.label, (on || done) && { color: colors.ink }]}
              >
                {label}
              </Text>
            </View>
            {i < steps.length - 1 ? (
              <View
                style={[
                  styles.line,
                  done && { backgroundColor: colors.accent },
                ]}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line2 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  item: { flexDirection: "row", alignItems: "center", gap: 8 },
  num: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.line2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  numOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  numDone: { backgroundColor: colors.ink, borderColor: colors.ink },
  numText: { fontSize: 12.5, fontWeight: "700", color: colors.muted },
  label: { fontSize: 13.5, fontWeight: "700", color: colors.muted },
  line: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.line,
    marginHorizontal: 8,
  },
});
