import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ListingCard } from '@/components/listings/ListingCard';
import { Banner, Empty } from '@/components/ui';
import { api } from '@/lib/api';
import type { HaulDetail } from '@/lib/types';
import { colors, font, space } from '@/theme';

const POLL_MS = 2000;

// The drafts made from one haul video. Each opens in the listing editor.
export default function HaulDraftsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [haul, setHaul] = useState<HaulDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ haul: HaulDetail }>(`/api/hauls/${id}`);
      setHaul(data.haul);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const writing = !!haul?.listings.some((l) => l.status === 'generating');
  useEffect(() => {
    if (!writing) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [writing, load]);

  const confirmDelete = (listingId: string) => {
    Alert.alert('Remove this draft?', 'Use this if the item was found by mistake or is a duplicate.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/listings/${listingId}`, { method: 'DELETE' });
            await load();
          } catch (e) {
            setError((e as Error).message);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.page}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Review drafts',
          headerBackTitle: 'Hauls',
          headerTintColor: colors.ink,
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
        }}
      />
      {!haul && !error ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error ? <Banner tone="error" text={error} action={{ label: 'Try again', onPress: load }} /> : null}
          {haul?.listings.length ? (
            <Text style={font.body}>Check each draft. Remove anything found by mistake, then open a draft to finish and publish it.</Text>
          ) : null}
          {haul?.listings.map((item) => (
            <ListingCard
              key={item.id}
              item={item}
              onOpen={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
              onDelete={() => confirmDelete(item.id)}
            />
          ))}
          {haul && !haul.listings.length ? (
            <Empty icon="albums-outline" title="No drafts left" text="All drafts from this haul have been removed." />
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: space.lg + 2, gap: space.md, paddingBottom: space.xxl },
});
