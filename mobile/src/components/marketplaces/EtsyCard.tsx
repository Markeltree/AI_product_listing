import React from 'react';
import { View } from 'react-native';
import type { EtsyStatus } from '@/lib/types';
import {
  Banner, Button, Card, CardHeader, InfoTile, Pill,
} from '@/components/ui';
import { MarketplaceMark } from './MarketplaceMark';

function statusLabel(etsy: EtsyStatus | null, connected: boolean) {
  if (!etsy) return 'Checking…';
  if (!etsy.configured) return 'Not configured';
  if (connected) return 'Connected';
  return etsy.connected ? 'No shop found' : 'Not connected';
}

// Settings card for the Etsy shop connection. The screen owns the data and actions.
export function EtsyCard({ etsy, busy, onConnect, onRefresh, onDisconnect }: {
  etsy: EtsyStatus | null; busy: string | null;
  onConnect: () => void; onRefresh: () => void; onDisconnect: () => void;
}) {
  const connected = !!(etsy?.connected && etsy.hasShop);
  return (
    <Card>
      <CardHeader
        icon="storefront-outline"
        title="Etsy shop"
        right={<Pill label={statusLabel(etsy, connected)} tone={connected ? 'success' : 'neutral'} />}
      />
      {etsy && !etsy.configured ? (
        <Banner tone="warn" text="The server has no Etsy API key yet. Add ETSY_API_KEY to its .env file and restart it." />
      ) : null}
      <InfoTile
        leading={<MarketplaceMark marketplace="etsy" />}
        title={connected ? etsy?.shopName ?? 'Your Etsy shop' : 'No shop connected'}
        subtitle={connected ? `Shop ID ${etsy?.shopId}` : 'Connect to publish listings straight from your phone.'}
      />
      {connected ? (
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Button title="Refresh shop" variant="secondary" icon="refresh" onPress={onRefresh} loading={busy === 'refresh'} style={{ flex: 1, paddingHorizontal: 10 }} />
          <Button title="Disconnect" variant="danger" icon="unlink" onPress={onDisconnect} style={{ flex: 1, paddingHorizontal: 10 }} />
        </View>
      ) : (
        <Button
          title={etsy?.connected ? 'Reconnect Etsy' : 'Connect Etsy'}
          icon="link"
          onPress={onConnect}
          loading={busy === 'connect'}
          disabled={!etsy?.configured}
          full
        />
      )}
    </Card>
  );
}
