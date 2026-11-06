import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow } from "@/theme";

// Horizontally scrolling filter chips. The selected chip is solid.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: 8 }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.chip, on && styles.chipOn]}
          >
            <Text style={[styles.chipText, on && { color: "#FFFFFF" }]}>
              {o.label}
            </Text>
            {o.count !== undefined ? (
              <View
                style={[
                  styles.count,
                  on && { backgroundColor: "rgba(255,255,255,0.2)" },
                ]}
              >
                <Text style={[styles.countText, on && { color: "#FFFFFF" }]}>
                  {o.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Two to four equal options in one track (like iOS segmented controls).
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.trackItem, on && styles.trackItemOn]}
          >
            <Text style={[styles.trackText, on && { color: colors.ink }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { borderColor: colors.ink, backgroundColor: colors.ink },
  chipText: { fontSize: 13.5, fontWeight: "600", color: colors.ink2 },
  count: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.surface3,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 11.5, color: colors.ink2, fontWeight: "700" },
  track: {
    flexDirection: "row",
    backgroundColor: colors.surface3,
    borderRadius: radius.md,
    padding: 4,
  },
  trackItem: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  trackItemOn: {
    backgroundColor: colors.surface,
    ...shadow,
    shadowOpacity: 0.08,
  },
  trackText: { fontSize: 14.5, fontWeight: "700", color: colors.muted },
});
