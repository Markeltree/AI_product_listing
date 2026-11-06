import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, font, space } from "@/theme";

// Label on the left, value on the right; for summaries and account details.
export function KeyValueRow({
  label,
  value,
  selectable = false,
}: {
  label: string;
  value: string;
  selectable?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[font.small, { fontSize: 14 }]}>{label}</Text>
      <Text style={styles.value} selectable={selectable}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: space.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  value: {
    flex: 1,
    textAlign: "right",
    fontSize: 14.5,
    fontWeight: "600",
    color: colors.ink,
  },
});
