import { Tabs } from 'expo-router';
import React from 'react';
import { FloatingTabBar } from '@/components/FloatingTabBar';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Listings' }} />
      <Tabs.Screen name="new" options={{ title: 'New' }} />
      <Tabs.Screen name="bulk" options={{ title: 'Bulk' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
