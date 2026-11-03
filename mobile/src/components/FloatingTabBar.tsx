// Floating bottom navigation: a white pill above the screen edge. The active tab gets a soft orange
// background with an orange icon and label; the others are grey.
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
type IconName = keyof typeof Ionicons.glyphMap;

// Ionicons base name per route; the active tab uses the filled icon, the others the outline one.
const ICONS: Record<string, string> = { index: 'grid', new: 'add-circle', bulk: 'layers', settings: 'settings' };

export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 12) + 4, alignItems: 'center' }}
    >
      <View
        style={{
          flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 30, padding: 6, gap: 4,
          shadowColor: '#1A1A24', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
          elevation: 12, borderWidth: Platform.OS === 'android' ? 0 : 0.5, borderColor: colors.line,
        }}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;
          const base = ICONS[route.name] ?? 'ellipse';
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              hitSlop={4}
              style={({ pressed }) => ({
                minWidth: 72, height: 54, borderRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 2,
                paddingHorizontal: 10, backgroundColor: focused ? colors.accent50 : 'transparent', opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name={(focused ? base : `${base}-outline`) as IconName} size={21} color={focused ? colors.accent : colors.muted} />
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: focused ? colors.accentDark : colors.muted }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
