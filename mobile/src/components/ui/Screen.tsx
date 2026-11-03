import React from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { TAB_BAR_SPACE, colors, space } from '@/theme';

// Page container: safe area, keyboard avoidance, and room at the bottom for the floating tab bar.
export function Screen({
  children, scroll = true, edges = ['top'], padded = true, style,
}: { children: React.ReactNode; scroll?: boolean; edges?: Edge[]; padded?: boolean; style?: StyleProp<ViewStyle> }) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && styles.pad, { paddingBottom: TAB_BAR_SPACE + space.lg }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padded && styles.pad]}>{children}</View>
  );
  return (
    <SafeAreaView style={[styles.screen, style]} edges={edges}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: space.lg + 2, paddingTop: space.lg },
});
