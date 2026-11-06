import React from "react";
import { StyleSheet, Text, View } from "react-native";

// Coloured rounded square with one letter: marketplace logos ("E" for Etsy) and avatars.
export function LetterMark({
  letter,
  color,
  size = 42,
  round = false,
}: {
  letter: string;
  color: string;
  size?: number;
  round?: boolean;
}) {
  return (
    <View
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: round ? size / 2 : size * 0.31,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.letter, { fontSize: size * 0.45 }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: "center", justifyContent: "center" },
  letter: { color: "#FFFFFF", fontWeight: "800" },
});
