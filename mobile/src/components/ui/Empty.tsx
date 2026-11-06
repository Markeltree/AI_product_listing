import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, space } from "@/theme";
import type { IconName } from "./types";

// Empty state: icon, title, short text and an optional action.
export function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconOuter}>
        <View style={styles.icon}>
          <Ionicons name={icon} size={28} color={colors.accent} />
        </View>
      </View>
      <Text style={[font.h2, styles.title]}>{title}</Text>
      <Text style={[font.body, styles.text]}>{text}</Text>
      {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 48,
    paddingHorizontal: space.lg,
  },
  iconOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  icon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent100,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { textAlign: "center", fontSize: 18 },
  text: { textAlign: "center", maxWidth: 300, color: colors.muted },
});
