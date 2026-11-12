import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/ui";
import { colors, font } from "@/theme";

// Shown in place of the editor while the server is still writing the listing.
export function GeneratingCard({ step }: { step?: string | null }) {
  return (
    <Card style={styles.card}>
      <View style={styles.spinner}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
      <Text style={[font.h2, styles.title]}>Creating your listing</Text>
      <View style={styles.step}>
        <Text style={styles.stepText}>{step ?? "Working…"}</Text>
      </View>
      <Text style={[font.small, { textAlign: "center" }]}>
        This usually takes 15 to 40 seconds. You can leave this screen; the work
        continues on the server.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", paddingVertical: 44, gap: 10 },
  spinner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.accent50,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 19, marginTop: 6 },
  step: {
    backgroundColor: colors.info50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  stepText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.infoDark,
    textAlign: "center",
  },
});
