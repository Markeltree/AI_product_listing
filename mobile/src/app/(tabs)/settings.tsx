import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { parse as parseUrl } from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { api } from '@/lib/api';
import { API_URL, SETTINGS_RETURN, USING_LOCAL_SERVER } from '@/lib/config';
import { useAuth } from '@/lib/auth';
import { LANGUAGES, MAX_QUANTITY, TONES, WHEN_MADE, WHO_MADE } from '@/lib/rules';
import type { EtsyStatus, Settings, ShippingProfile, Tone } from '@/lib/types';
import {
  Banner, Button, Card, CardHeader, Field, Heading, KeyValueRow, Screen, Segmented, Select, SwitchRow,
} from '@/components/ui';
import { EbayCard } from '@/components/marketplaces/EbayCard';
import { NotificationsCard } from '@/components/settings/NotificationsCard';
import { EtsyCard } from '@/components/marketplaces/EtsyCard';
import { font, space } from '@/theme';

export default function SettingsScreen() {
  const { user, signOut, updateUser } = useAuth();
  const [etsy, setEtsy] = useState<EtsyStatus | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [shipping, setShipping] = useState<ShippingProfile[] | null>(null);
  const [ai, setAi] = useState<{ provider: string; model: string | null } | null>(null);
  const [saved, setSaved] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ tone: 'success' | 'error' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadEtsy = useCallback(async () => {
    try {
      const status = await api<EtsyStatus>('/api/etsy/status');
      setEtsy(status);
      if (status.connected && status.hasShop) {
        try {
          const { profiles } = await api<{ profiles: ShippingProfile[] }>('/api/etsy/shipping-profiles');
          setShipping(profiles);
        } catch {
          setShipping(null);
        }
      } else {
        setShipping(null);
      }
    } catch (e) {
      setBanner({ tone: 'error', text: (e as Error).message });
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadEtsy();
    api<{ settings: Settings }>('/api/settings').then((d) => setSettings(d.settings)).catch(() => {});
    api<{ ai: { provider: string; model: string | null } }>('/api/health').then((d) => setAi(d.ai)).catch(() => {});
  }, [loadEtsy]));

  // Connect Etsy: the server issues a short-lived ticket, then the system browser completes OAuth.
  const connectEtsy = async () => {
    setBusy('connect');
    setBanner(null);
    try {
      const { url } = await api<{ url: string }>('/api/etsy/connect-url', { method: 'POST', body: { returnTo: SETTINGS_RETURN } });
      const result = await WebBrowser.openAuthSessionAsync(url, SETTINGS_RETURN);
      if (result.type === 'success') {
        const params = parseUrl(result.url).queryParams ?? {};
        if (params.etsy === 'error') {
          setBanner({ tone: 'error', text: String(params.message ?? 'Etsy could not be connected.') });
        } else {
          setBanner({ tone: 'success', text: 'Etsy shop connected.' });
        }
      }
      await loadEtsy();
    } catch (e) {
      setBanner({ tone: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const refreshShop = async () => {
    setBusy('refresh');
    try {
      const res = await api<{ shopName: string | null }>('/api/etsy/refresh', { method: 'POST' });
      setBanner({ tone: 'success', text: `Shop refreshed${res.shopName ? `: ${res.shopName}` : ''}.` });
      await loadEtsy();
    } catch (e) {
      setBanner({ tone: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = () => {
    Alert.alert('Disconnect Etsy?', 'Velista will stop publishing to your shop. Listings already on Etsy stay live.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('/api/etsy/disconnect', { method: 'POST' });
            await loadEtsy();
          } catch (e) {
            setBanner({ tone: 'error', text: (e as Error).message });
          }
        },
      },
    ]);
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You will need to sign in again on this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
    setSaved('');
    setErrors((e) => { const n = { ...e }; delete n[key as string]; return n; });
  };

  const saveSettings = async () => {
    if (!settings) return;
    const q = Number(settings.defaultQuantity);
    if (!Number.isInteger(q) || q < 1 || q > MAX_QUANTITY) {
      setErrors({ defaultQuantity: `Enter a whole number from 1 to ${MAX_QUANTITY}.` });
      return;
    }
    setBusy('save');
    try {
      const res = await api<{ settings: Settings }>('/api/settings', { method: 'PUT', body: settings });
      setSettings(res.settings);
      updateUser({ settings: res.settings });
      setSaved('Saved. New listings will use these defaults.');
    } catch (e) {
      setBanner({ tone: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const connected = !!(etsy?.connected && etsy.hasShop);

  return (
    <Screen>
      <Heading eyebrow="Velista" title="Settings" subtitle="Connect Etsy and eBay, set defaults and manage your account." />
      {banner ? <View style={{ marginBottom: space.md }}><Banner tone={banner.tone === 'warn' ? 'warn' : banner.tone === 'success' ? 'success' : 'error'} text={banner.text} /></View> : null}

      <EtsyCard etsy={etsy} busy={busy} onConnect={connectEtsy} onRefresh={refreshShop} onDisconnect={disconnect} />

      <View style={{ height: space.md }} />
      <EbayCard onNotice={setBanner} />

      <View style={{ height: space.md }} />
      <Card>
        <CardHeader icon="options-outline" title="Listing defaults" subtitle="Used whenever you create a listing. You can still change them per product." />
        {settings ? (
          <>
            <View style={{ gap: 6 }}>
              <Text style={font.label}>Tone</Text>
              <Segmented<Tone> value={settings.defaultTone} onChange={(v) => update('defaultTone', v)} options={TONES as { value: Tone; label: string }[]} />
            </View>
            <Select label="Language" value={settings.defaultLanguage} onChange={(v) => update('defaultLanguage', v)} options={LANGUAGES.map((l) => ({ value: l, label: l }))} />
            <Select label="Who made it" value={settings.defaultWhoMade} onChange={(v) => update('defaultWhoMade', v as Settings['defaultWhoMade'])} options={WHO_MADE} />
            <Select label="When it was made" value={settings.defaultWhenMade} onChange={(v) => update('defaultWhenMade', v)} options={WHEN_MADE} />
            <Field
              label="Default quantity" value={String(settings.defaultQuantity)} keyboardType="numeric"
              onChangeText={(v) => update('defaultQuantity', Number(v.replace(/\D/g, '')) || 0)} error={errors.defaultQuantity}
            />
            <Select
              label="Default shipping profile"
              value={settings.defaultShippingProfileId ? String(settings.defaultShippingProfileId) : null}
              onChange={(v) => update('defaultShippingProfileId', Number(v))}
              options={(shipping ?? []).map((p) => ({ value: String(p.id), label: p.title }))}
              placeholder={connected ? 'Choose a profile' : 'Connect Etsy to choose one'}
              hint={connected && shipping && !shipping.length ? 'No shipping profiles yet. Create one in Etsy first.' : undefined}
            />
            <SwitchRow
              label="Craft supply by default"
              hint="Turn on if most of your listings are materials rather than finished goods."
              value={settings.defaultIsSupply}
              onChange={(v) => update('defaultIsSupply', v)}
            />
            {saved ? <Banner tone="success" text={saved} /> : null}
            <Button title="Save defaults" icon="save-outline" onPress={saveSettings} loading={busy === 'save'} full />
          </>
        ) : (
          <Text style={font.small}>Loading your defaults…</Text>
        )}
      </Card>

      <View style={{ height: space.md }} />
      <NotificationsCard />

      <Card>
        <CardHeader icon="sparkles-outline" title="AI and services" />
        <KeyValueRow label="Listing AI" value={ai ? (ai.provider === 'template' ? 'Template only (no AI key on the server)' : `${ai.provider}${ai.model ? ` · ${ai.model}` : ''}`) : 'Checking…'} selectable />
        <KeyValueRow label="Server" value={API_URL} selectable />
        {USING_LOCAL_SERVER ? (
          <Banner tone="warn" text="This app is using a development server on a computer, not the live Velista server. Remove EXPO_PUBLIC_API_URL from mobile/.env and restart Expo with: npx expo start -c" />
        ) : null}
      </Card>

      <View style={{ height: space.md }} />
      <Card>
        <CardHeader icon="person-circle-outline" title="Account" />
        <KeyValueRow label="Name" value={user?.name ?? ''} selectable />
        <KeyValueRow label="Email" value={user?.email ?? ''} selectable />
        <Button title="Sign out" variant="secondary" icon="log-out-outline" onPress={confirmSignOut} full />
      </Card>
    </Screen>
  );
}


