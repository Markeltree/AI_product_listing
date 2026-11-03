// Settings card for eBay: connect / disconnect and the one-time listing setup
// (shipping, payment and return policies, ship-from location, item condition).
import React, { useCallback, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { parse as parseUrl } from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { api } from '@/lib/api';
import { SETTINGS_RETURN } from '@/lib/config';
import type { EbayPrefs, EbaySetup, EbayStatus } from '@/lib/types';
import { Banner, Button, Card, Field, Row, Select } from './ui';
import { colors, font, radius } from '@/theme';

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'New', NEW_OTHER: 'New (other / open box)', USED_EXCELLENT: 'Used: excellent', USED_GOOD: 'Used: good',
};
const NEW_LOCATION = '__new';

type Notice = { tone: 'success' | 'error' | 'warn'; text: string };

// Reloads every time the Settings screen comes into focus.
export function EbayCard({ onNotice }: { onNotice: (n: Notice) => void }) {
  const [status, setStatus] = useState<EbayStatus | null>(null);
  const [setup, setSetup] = useState<EbaySetup | null>(null);
  const [prefs, setPrefs] = useState<EbayPrefs>({});
  const [postal, setPostal] = useState('');
  const [country, setCountry] = useState('US');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await api<EbayStatus>('/api/ebay/status');
      setStatus(s);
      setPrefs(s.prefs || {});
      if (s.connected) {
        const data = await api<EbaySetup>('/api/ebay/setup').catch(() => null);
        setSetup(data);
      } else {
        setSetup(null);
      }
    } catch (e) {
      onNotice({ tone: 'error', text: (e as Error).message });
    }
  }, [onNotice]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Same flow as Etsy: a short-lived ticket link, finished in the system browser.
  const connect = async () => {
    setBusy('connect');
    try {
      const { url } = await api<{ url: string }>('/api/ebay/connect-url', { method: 'POST', body: { returnTo: SETTINGS_RETURN } });
      const result = await WebBrowser.openAuthSessionAsync(url, SETTINGS_RETURN);
      if (result.type === 'success') {
        const params = parseUrl(result.url).queryParams ?? {};
        if (params.ebay === 'error') onNotice({ tone: 'error', text: String(params.message ?? 'eBay could not be connected.') });
        else if (params.warning) onNotice({ tone: 'warn', text: `eBay connected. ${params.warning}` });
        else onNotice({ tone: 'success', text: 'eBay connected.' });
      }
      await load();
    } catch (e) {
      onNotice({ tone: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const body: Record<string, unknown> = { ...prefs };
    if (prefs.merchantLocationKey === NEW_LOCATION) {
      delete body.merchantLocationKey;
      body.newLocation = { postalCode: postal, country };
    }
    setBusy('save');
    try {
      const s = await api<EbayStatus>('/api/ebay/prefs', { method: 'PUT', body });
      onNotice(s.ready ? { tone: 'success', text: 'eBay is ready. You can publish listings to eBay now.' } : { tone: 'warn', text: s.setupProblem ?? '' });
      await load();
    } catch (e) {
      onNotice({ tone: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = () => {
    Alert.alert('Disconnect eBay?', 'Velista stops publishing to eBay and stops ending eBay copies when items sell on Etsy. Listings already on eBay stay live.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('/api/ebay/disconnect', { method: 'POST' });
            await load();
          } catch (e) {
            onNotice({ tone: 'error', text: (e as Error).message });
          }
        },
      },
    ]);
  };

  const badge = !status ? 'Checking…' : !status.configured ? 'Not configured' : !status.connected ? 'Not connected' : status.ready ? 'Ready' : 'Setup needed';
  const good = !!status?.ready;
  const policyOptions = (type: 'fulfillment' | 'payment' | 'return') => (setup?.policies[type] ?? []).map((p) => ({ value: p.id, label: p.name }));
  const setPref = (key: keyof EbayPrefs) => (v: string) => setPrefs((p) => ({ ...p, [key]: v }));

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={font.h2}>eBay</Text>
        <View style={{ paddingHorizontal: 10, height: 26, borderRadius: 999, justifyContent: 'center', backgroundColor: good ? colors.ok50 : colors.surface3 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: good ? colors.okDark : colors.muted }}>{badge}</Text>
        </View>
      </Row>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line }}>
        <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: '#0064D2', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 19 }}>e</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', color: colors.ink }} numberOfLines={1}>
            {status?.connected ? status.username ?? 'Your eBay account' : 'No eBay account connected'}
          </Text>
          <Text style={font.small}>
            {status?.connected ? `${status.sandbox ? 'Sandbox · ' : ''}When an item sells on Etsy or eBay, Velista ends it on the other.` : 'Connect to publish listings to eBay too.'}
          </Text>
        </View>
      </View>

      {status && !status.configured ? (
        <Banner tone="warn" text="The server has no eBay keys yet. Add EBAY_CLIENT_ID, EBAY_CLIENT_SECRET and EBAY_RUNAME to its .env file and restart it." />
      ) : null}
      {status?.connected && !status.ready && status.setupProblem ? <Banner tone="warn" text={status.setupProblem} /> : null}

      {status?.connected && setup ? (
        <View style={{ gap: 12 }}>
          <Select label="Shipping policy" value={prefs.fulfillmentPolicyId} onChange={setPref('fulfillmentPolicyId')} options={policyOptions('fulfillment')} placeholder={policyOptions('fulfillment').length ? 'Choose' : 'None yet. Create one on eBay'} />
          <Select label="Payment policy" value={prefs.paymentPolicyId} onChange={setPref('paymentPolicyId')} options={policyOptions('payment')} placeholder={policyOptions('payment').length ? 'Choose' : 'None yet. Create one on eBay'} />
          <Select label="Return policy" value={prefs.returnPolicyId} onChange={setPref('returnPolicyId')} options={policyOptions('return')} placeholder={policyOptions('return').length ? 'Choose' : 'None yet. Create one on eBay'} />
          <Select
            label="Item condition"
            value={prefs.condition ?? 'NEW'}
            onChange={setPref('condition')}
            options={setup.conditions.map((c) => ({ value: c, label: CONDITION_LABELS[c] ?? c }))}
          />
          <Select
            label="Ships from"
            value={prefs.merchantLocationKey}
            onChange={setPref('merchantLocationKey')}
            options={[
              ...setup.locations.map((l) => ({ value: l.key, label: `${l.name}${l.postalCode ? ` (${l.postalCode}, ${l.country})` : ''}` })),
              { value: NEW_LOCATION, label: '+ Add a ship-from address' },
            ]}
          />
          {prefs.merchantLocationKey === NEW_LOCATION ? (
            <Row style={{ gap: 10, alignItems: 'flex-start' }}>
              <View style={{ flex: 2 }}><Field label="Postal code" value={postal} onChangeText={setPostal} /></View>
              <View style={{ flex: 1 }}><Field label="Country" value={country} onChangeText={(v) => setCountry(v.toUpperCase().slice(0, 2))} maxLength={2} /></View>
            </Row>
          ) : null}
          <Button title="Save eBay setup" icon="checkmark" onPress={save} loading={busy === 'save'} full />
          <Button title="Manage policies on eBay" variant="ghost" icon="open-outline" onPress={() => Linking.openURL('https://www.bizpolicy.ebay.com/businesspolicy/manage')} full />
        </View>
      ) : null}

      {status?.connected ? (
        <Button title="Disconnect eBay" variant="danger" icon="unlink" onPress={disconnect} full />
      ) : (
        <Button title="Connect eBay" icon="link" onPress={connect} loading={busy === 'connect'} disabled={!status?.configured} full />
      )}
    </Card>
  );
}
