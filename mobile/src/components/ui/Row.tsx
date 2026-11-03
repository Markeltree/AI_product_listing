import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { space } from '@/theme';

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, style]}>{children}</View>;
}
