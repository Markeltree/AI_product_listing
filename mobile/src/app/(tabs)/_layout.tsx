import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

// Outline icon normally, filled icon with a soft pill behind it when the tab is active.
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icon = (focused ? name : `${name}-outline`) as IconName;
  return (
    <View style={{ width: 52, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.accent50 : 'transparent' }}>
      <Ionicons name={icon} size={21} color={focused ? colors.accent : colors.muted} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 70 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 10),
        },
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: '700', lineHeight: 15 },
        tabBarIconStyle: { height: 30 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Listings', tabBarIcon: ({ focused }) => <TabIcon name="grid" focused={focused} /> }} />
      <Tabs.Screen name="new" options={{ title: 'New', tabBarIcon: ({ focused }) => <TabIcon name="add-circle" focused={focused} /> }} />
      <Tabs.Screen name="bulk" options={{ title: 'Bulk', tabBarIcon: ({ focused }) => <TabIcon name="layers" focused={focused} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} /> }} />
    </Tabs>
  );
}
