import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Linking, Pressable, RefreshControl, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api, mediaUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money, timeAgo } from '@/lib/format';
import type { ListingSummary } from '@/lib/types';
import { Banner, Button, Empty, IconButton, Row, Screen, Segmented, StatusBadge } from '@/components/ui';
import { HomeHeader } from '@/components/HomeHeader';
import { TAB_BAR_SPACE, colors, font, radius, shadow, space } from '@/theme';

type Filter = 'all' | 'draft' | 'published' | 'ended' | 'failed' | 'generating';

export default function ListingsScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [items, setItems] = useState<ListingSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ listings: ListingSummary[] }>('/api/listings');
      setItems(data.listings);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Reload every time the tab is shown, so edits made in other screens appear immediately.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const anyGenerating = !!items?.some((i) => i.status === 'generating');
  useEffect(() => {
    if (!anyGenerating) return;
    const timer = setInterval(load, 1500);
    return () => clearInterval(timer);
  }, [anyGenerating, load]);

  const counts = useMemo(() => {
    const list = items ?? [];
    return {
      all: list.length,
      draft: list.filter((i) => i.status === 'draft').length,
      published: list.filter((i) => i.status === 'published').length,
      ended: list.filter((i) => i.status === 'ended').length,
      failed: list.filter((i) => i.status === 'failed').length,
      generating: list.filter((i) => i.status === 'generating').length,
    };
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((i) => (filter === 'all' || i.status === filter) && (!q || i.title.toLowerCase().includes(q)));
  }, [items, filter, query]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const remove = (item: ListingSummary) => {
    Alert.alert(
      'Delete this listing?',
      `"${item.title}" and its photos will be removed from Velista. Listings already on Etsy stay there.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/api/listings/${item.id}`, { method: 'DELETE' });
              setItems((prev) => (prev ?? []).filter((i) => i.id !== item.id));
            } catch (e) {
              Alert.alert('Could not delete', (e as Error).message);
            }
          },
        },
      ],
    );
  };

  const header = (
    <View style={{ gap: space.md + 2 }}>
      <HomeHeader
        name={user?.name ?? ''}
        total={items ? items.length : null}
        live={counts.published}
        drafts={counts.draft}
        needsAttention={counts.failed}
        query={query}
        onQuery={setQuery}
        onNew={() => router.push('/new')}
      />
      {error ? <Banner tone="error" text={error} action={{ label: 'Try again', onPress: load }} /> : null}
      <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 19, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 }}>Your library</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accentDark }}>{visible.length} shown</Text>
      </Row>
      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All', count: counts.all },
          { value: 'draft', label: 'Drafts', count: counts.draft },
          { value: 'published', label: 'Published', count: counts.published },
          { value: 'ended', label: 'Ended', count: counts.ended },
          { value: 'failed', label: 'Attention', count: counts.failed },
          { value: 'generating', label: 'Generating', count: counts.generating },
        ]}
      />
    </View>
  );

  if (items === null && !error) {
    return (
      <Screen scroll={false} edges={[]}>
        {header}
        <View style={{ paddingTop: 40 }}><ActivityIndicator color={colors.accent} /></View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false} edges={[]}>
      <FlatList
        data={visible}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: space.lg + 2, paddingBottom: TAB_BAR_SPACE + 16, gap: 10 }}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: 6 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ListingCard item={item} token={token} onOpen={() => router.push(`/listing/${item.id}`)} onDelete={() => remove(item)} />
        )}
        ListEmptyComponent={
          items && items.length === 0 ? (
            <Empty
              icon="images-outline"
              title="No listings yet"
              text="Add a few product photos or a short video and Velista will draft the whole listing for you."
              action={<Button title="Create your first listing" icon="add" onPress={() => router.push('/new')} />}
            />
          ) : (
            <Empty icon="search-outline" title="Nothing matches" text="Try a different search or switch the filter back to All." />
          )
        }
      />
    </Screen>
  );
}


// One listing as a compact row: thumbnail, title, price and status, with open/delete actions.
function ListingCard({ item, token, onOpen, onDelete }: {
  item: ListingSummary; token: string | null; onOpen: () => void; onDelete: () => void;
}) {
  const generating = item.status === 'generating';
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.status}`}
      style={({ pressed }) => [{
        flexDirection: 'row', gap: 14, padding: 12, backgroundColor: colors.surface, borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.line, ...shadow, opacity: pressed ? 0.85 : 1,
      }]}
    >
      <View style={{ width: 84, height: 84, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface3 }}>
        {item.thumbnailId ? (
          <Image
            source={{ uri: mediaUrl(item.id, item.thumbnailId), headers: token ? { Authorization: `Bearer ${token}` } : undefined }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="image-outline" size={26} color={colors.muted} />
          </View>
        )}
      </View>
      <View style={{ flex: 1, gap: 6, justifyContent: 'center' }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink, lineHeight: 20, letterSpacing: -0.1 }} numberOfLines={2}>{item.title}</Text>
        {generating ? (
          <Row style={{ gap: 6 }}>
            <ActivityIndicator size="small" color={colors.info} />
            <Text style={{ fontSize: 12.5, color: colors.infoDark, fontWeight: '600', flex: 1 }} numberOfLines={1}>{item.step ?? 'Working…'}</Text>
          </Row>
        ) : null}
        {item.status === 'failed' && item.error ? (
          <Text style={{ fontSize: 12.5, color: colors.dangerDark }} numberOfLines={2}>{item.error}</Text>
        ) : null}
        {item.endedReason ? <Text style={[font.small, { fontSize: 12.5 }]} numberOfLines={1}>{item.endedReason}</Text> : null}
        {item.channels && (item.channels.etsy || item.channels.ebay) ? (
          <Text style={[font.small, { fontSize: 12 }]} numberOfLines={1}>
            {[item.channels.etsy && `Etsy ${item.channels.etsy === 'active' ? 'live' : item.channels.etsy}`, item.channels.ebay && `eBay ${item.channels.ebay === 'active' ? 'live' : item.channels.ebay}`].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        <Row style={{ flexWrap: 'wrap', gap: 6 }}>
          <Text style={{ fontSize: 14, color: colors.ink, fontWeight: '800' }}>{money(item.price)}</Text>
          <Text style={font.small}>· Qty {item.quantity ?? '—'}</Text>
          <Text style={font.small}>· {item.mediaCount} photo{item.mediaCount === 1 ? '' : 's'}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ gap: 8, flex: 1 }}>
            <StatusBadge status={item.status} />
            <Text style={[font.small, { fontSize: 12, flexShrink: 1 }]} numberOfLines={1}>{timeAgo(item.updatedAt)}</Text>
          </Row>
          <Row style={{ gap: 2 }}>
            {item.etsyUrl ? <IconButton icon="open-outline" label="Open on Etsy" onPress={() => Linking.openURL(item.etsyUrl!)} color={colors.muted} size={32} /> : null}
            <IconButton icon="trash-outline" label="Delete listing" onPress={onDelete} color={colors.muted} size={32} />
          </Row>
        </Row>
      </View>
    </Pressable>
  );
}
