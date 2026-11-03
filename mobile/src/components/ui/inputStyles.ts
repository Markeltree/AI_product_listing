import { StyleSheet } from 'react-native';
import { colors, radius } from '@/theme';

// Shared by Field, Select and ChipInput so every input looks and behaves the same.
export const inputStyles = StyleSheet.create({
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  counter: { fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'], fontWeight: '500' },
  input: {
    minHeight: 50, paddingHorizontal: 15, paddingVertical: 12, borderRadius: radius.sm, borderWidth: 1.5,
    borderColor: colors.line, backgroundColor: colors.surface2, color: colors.ink, fontSize: 15.5,
  },
  focused: { borderColor: colors.accent, backgroundColor: colors.surface },
  errorText: { fontSize: 12.5, color: colors.danger, fontWeight: '500' },
});
