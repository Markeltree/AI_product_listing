import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { EbayStatus, Listing } from '@/lib/types';
import {
  Banner, Button, Card, CardHeader, Pill, Row,
} from '@/components/ui';
import { MARKETPLACES, MarketplaceMark, type Marketplace } from './MarketplaceMark';
import { colors, font, radius } from '@/theme';

type Info = { listingId?: string | number | null; offerId?: string; url?: string | null; state?: string; publishedAt?: string | null } | null | undefined;

const isLive = (info: Info) => !!info?.listingId && (info.state ? info.state === 'active' : !!info.publishedAt);

function stateOf(info: Info): { label: string; live: boolean } {
  if (!info?.listingId && !info?.offerId) return { label: 'Not listed', live: false };
  if (isLive(info)) return { label: 'Live', live: true };
  return { label: info.state === 'ended' ? 'Ended' : 'Draft', live: false };
}

function ChannelRow({ marketplace, info, note }: { marketplace: Marketplace; info: Info; note?: string | null }) {
  const st = stateOf(info);
  const { name } = MARKETPLACES[marketplace];
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: colors.surface2, padding: 12, borderRadius: radius.md }}>
      <Row style={{ flex: 1, alignItems: 'flex-start' }}>
        <MarketplaceMark marketplace={marketplace} size={30} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', color: colors.ink }}>{name}</Text>
          {note ? <Text style={font.small}>{note}</Text> : null}
          {info?.url && st.live ? (
            <Text style={{ color: colors.accentDark, fontWeight: '600', marginTop: 2 }} onPress={() => Linking.openURL(info.url!)}>View on {name}</Text>
          ) : null}
        </View>
      </Row>
      <Pill label={st.label} tone={st.live ? 'success' : 'neutral'} />
    </Row>
  );
}

// saveFirst: saves unsaved edits; returns false if saving failed.
export function MarketplacesCard({ listing, onListing, saveFirst }: {
  listing: Listing; onListing: (l: Listing) => void; saveFirst: () => Promise<boolean>;
}) {
  const router = useRouter();
  const [ebay, setEbay] = useState<EbayStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

  const loadEbay = useCallback(() => {
    api<EbayStatus>('/api/ebay/status').then(setEbay).catch(() => setEbay(null));
  }, []);
  useEffect(() => { loadEbay(); }, [loadEbay]);

  const etsyLive = isLive(listing.etsy as Info);
  const ebayLive = isLive(listing.ebay as Info);
  const both = etsyLive && ebayLive;
  const sync = listing.sync ?? {};

  const publishEbay = async () => {
    setBusy('ebay');
    setNotice(null);
    try {
      if (!(await saveFirst())) return;
      const res = await api<{ listing: Listing }>(`/api/listings/${listing.id}/publish-ebay`, { method: 'POST', body: { state: 'active' } });
      onListing(res.listing);
      setNotice({ tone: 'success', text: 'Live on eBay.' });
    } catch (e) {
      const err = e as ApiError;
      if (err.data?.listing) onListing(err.data.listing);
      if (err.data?.code === 'ebay_setup' || err.data?.code === 'ebay_not_connected') loadEbay();
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  };

  const end = (channel: 'etsy' | 'ebay' | 'all') => {
    const where = { etsy: 'Etsy', ebay: 'eBay', all: 'Etsy and eBay' }[channel];
    Alert.alert(`End on ${where}?`, channel === 'all' ? 'Both listings end now. Use this when the item sold somewhere else.' : `The ${where} listing ends now.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End listing',
        style: 'destructive',
        onPress: async () => {
          setBusy(`end-${channel}`);
          try {
            const res = await api<{ listing: Listing }>(`/api/listings/${listing.id}/delist`, { method: 'POST', body: { channel } });
            onListing(res.listing);
            setNotice({ tone: 'success', text: `Ended on ${where}.` });
          } catch (e) {
            const err = e as ApiError;
            if (err.data?.listing) onListing(err.data.listing);
            setNotice({ tone: 'error', text: err.message });
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const checkNow = async () => {
    setBusy('sync');
    try {
      const res = await api<{ changes: { id: string; action?: string; error?: string }[] }>('/api/listings/sync', { method: 'POST' });
      const mine = res.changes.find((c) => c.id === listing.id);
      onListing((await api<{ listing: Listing }>(`/api/listings/${listing.id}`)).listing);
      setNotice(mine ? { tone: mine.error ? 'error' : 'success', text: (mine.action || mine.error)! } : { tone: 'info', text: 'No new sales. Both listings are still live.' });
    } catch (e) {
      setNotice({ tone: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  let ebayNote: string | null = null;
  if (!ebay?.configured) ebayNote = 'eBay keys are not set on the server yet.';
  else if (!ebay.connected) ebayNote = 'Connect eBay in Settings to list here.';
  else if (!ebay.ready) ebayNote = ebay.setupProblem;
  else if (listing.ebay?.lastError) ebayNote = listing.ebay.lastError;
  else if (listing.ebay?.categoryPath) ebayNote = listing.ebay.categoryPath;

  const canEbay = !!ebay?.connected && ebay.ready && !busy;

  return (
    <Card>
      <CardHeader icon="git-branch-outline" title="Marketplaces" subtitle="Sell on Etsy and eBay. When it sells on one, Velista ends the other." />
      <ChannelRow marketplace="etsy" info={listing.etsy as Info} note={listing.etsy ? null : 'Use Publish to Etsy below.'} />
      <ChannelRow marketplace="ebay" info={listing.ebay as Info} note={ebayNote} />

      {ebay?.connected && !ebay.ready ? (
        <Button title="Finish eBay setup" variant="secondary" icon="settings-outline" onPress={() => router.push('/(tabs)/settings')} full />
      ) : !ebay?.connected && ebay?.configured ? (
        <Button title="Connect eBay" variant="secondary" icon="link" onPress={() => router.push('/(tabs)/settings')} full />
      ) : (
        <Button title={ebayLive ? 'Update eBay listing' : 'Publish to eBay'} variant={ebayLive ? 'secondary' : 'primary'} icon="send" onPress={publishEbay} loading={busy === 'ebay'} disabled={!canEbay} full />
      )}

      {both ? (
        <View style={{ gap: 8, backgroundColor: colors.info50, padding: 12, borderRadius: radius.sm }}>
          <Row style={{ alignItems: 'flex-start' }}>
            <Ionicons name="sync-outline" size={18} color={colors.infoDark} />
            <Text style={{ flex: 1, fontSize: 13.5, color: colors.infoDark }}>
              Auto-delist is on. When this sells or ends on one marketplace, Velista ends it on the other and keeps quantities in step.
              {sync.checkedAt ? ` Last checked ${timeAgo(sync.checkedAt)}.` : ''}
            </Text>
          </Row>
          {sync.lastError ? <Text style={{ fontSize: 12.5, color: colors.danger }}>{sync.lastError}</Text> : null}
          <Button title="Check sales now" variant="ghost" icon="refresh" onPress={checkNow} loading={busy === 'sync'} disabled={!!busy} />
        </View>
      ) : sync.endedAt ? (
        <Banner tone="success" text={`${sync.reason ?? 'Ended'} · ${timeAgo(sync.endedAt)}`} />
      ) : null}

      {both ? (
        <Button title="End everywhere" variant="danger" icon="close-circle-outline" onPress={() => end('all')} loading={busy === 'end-all'} disabled={!!busy} full />
      ) : etsyLive || ebayLive ? (
        <Button title={`End on ${etsyLive ? 'Etsy' : 'eBay'}`} variant="danger" icon="close-circle-outline" onPress={() => end(etsyLive ? 'etsy' : 'ebay')} loading={busy?.startsWith('end') ?? false} disabled={!!busy} full />
      ) : null}

      {notice ? <Banner tone={notice.tone} text={notice.text} /> : null}
    </Card>
  );
}
