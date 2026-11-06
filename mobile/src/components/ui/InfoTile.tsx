import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, font, radius } from "@/theme";

// Soft box with something on the left (a logo or icon), a title and a subtitle, and an optional right side.
export function InfoTile({
  leading,
  title,
  subtitle,
  right,
}: {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string | null;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.tile}>
      {leading}
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={font.small}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: { fontWeight: "600", color: colors.ink },
});
