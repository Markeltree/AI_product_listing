import React from 'react';
import {
  ActivityIndicator, Linking, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { money, timeAgo } from '@/lib/format';
import type { ChannelState, ListingSummary } from '@/lib/types';
import {
  IconButton, Pill, Row, StatusBadge,
} from '@/components/ui';
import { colors, font, radius, shadow } from '@/theme';
import { ListingImage } from './ListingImage';

const channelLabel = (name: string, state: ChannelState) => (state === 'active' ? name : `${name} ${state}`);

// One listing as a compact row: thumbnail, title, price, marketplaces and status, with open/delete actions.
export function ListingCard({ item, onOpen, onDelete }: { item: ListingSummary; onOpen: () => void; onDelete: () => void }) {
  const generating = item.status === 'generating';
  const channels = [
    item.channels?.etsy ? { key: 'etsy', label: channelLabel('Etsy', item.channels.etsy), live: item.channels.etsy === 'active' } : null,
    item.channels?.ebay ? { key: 'ebay', label: channelLabel('eBay', item.channels.ebay), live: item.channels.ebay === 'active' } : null,
  ].filter((c): c is { key: string; label: string; live: boolean } => c !== null);

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.status}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <ListingImage listingId={item.id} mediaId={item.thumbnailId} style={styles.thumb} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {generating ? (
          <Row style={{ gap: 6 }}>
            <ActivityIndicator size="small" color={colors.info} />
            <Text style={styles.step} numberOfLines={1}>{item.step ?? 'Working…'}</Text>
          </Row>
        ) : null}
        {item.status === 'failed' && item.error ? <Text style={styles.error} numberOfLines={2}>{item.error}</Text> : null}
        {item.endedReason ? <Text style={[font.small, { fontSize: 12.5 }]} numberOfLines={1}>{item.endedReason}</Text> : null}
        {channels.length ? (
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {channels.map((c) => <Pill key={c.key} label={c.label} tone={c.live ? 'success' : 'neutral'} />)}
          </Row>
        ) : null}
        <Row style={{ flexWrap: 'wrap', gap: 6 }}>
          <Text style={styles.price}>{money(item.price)}</Text>
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

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', gap: 14, padding: 12, backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.line, ...shadow,
  },
  thumb: { width: 84, height: 84, borderRadius: radius.md },
  body: { flex: 1, gap: 6, justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink, lineHeight: 20, letterSpacing: -0.1 },
  step: { fontSize: 12.5, color: colors.infoDark, fontWeight: '600', flex: 1 },
  error: { fontSize: 12.5, color: colors.dangerDark },
  price: { fontSize: 14, color: colors.ink, fontWeight: '800' },
});
