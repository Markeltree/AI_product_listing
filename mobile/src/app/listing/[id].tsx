import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { api, ApiError, appendFiles, mediaUrl } from '@/lib/api';
import { preparePhoto } from '@/lib/images';
import { useAuth } from '@/lib/auth';
import { MAX_QUANTITY, MIN_PRICE, MAX_PHOTOS, TAG_MAX_COUNT, TAG_MAX_LENGTH, TITLE_MAX, WHEN_MADE, WHO_MADE, listingIssues } from '@/lib/rules';
import { money, STATUS_LABEL, timeAgo } from '@/lib/format';
import type { Attribute, Content, EtsyStatus, Issue, Listing, Media, Product, ShippingProfile, TaxonomyNode } from '@/lib/types';
import {
  Banner, Button, Card, CardHeader, ChipInput, Field, Row, Select, StatusBadge, SwitchRow,
} from '@/components/ui';
import { MarketplacesCard } from '@/components/MarketplacesCard';
import { colors, font, radius, shadow, space } from '@/theme';

type Draft = { product: Product; content: Content; media: Media[] };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const imageIds = (media: Media[]) => media.filter((m) => m.kind === 'image').map((m) => m.id);
const keyOf = (d: Draft) => JSON.stringify({ p: d.product, c: d.content, o: imageIds(d.media) });
const photoCountOf = (d: Draft) => d.media.filter((m) => m.kind === 'image').length;

type Notice = { tone: 'info' | 'warn' | 'error' | 'success'; title?: string; text: string; action?: { label: string; onPress: () => void } };

export default function ListingEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseKey, setBaseKey] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [etsy, setEtsy] = useState<EtsyStatus | null>(null);
  const [shipping, setShipping] = useState<ShippingProfile[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<Notice | null>(null);
  const [publishTried, setPublishTried] = useState(false);
  const [priceText, setPriceText] = useState('');
  const [qtyText, setQtyText] = useState('');
  const [readyText, setReadyText] = useState('');
  const [taxOpen, setTaxOpen] = useState(false);
  const [taxQuery, setTaxQuery] = useState('');
  const [taxResults, setTaxResults] = useState<TaxonomyNode[]>([]);
  const [taxError, setTaxError] = useState<string | null>(null);

  // Refs mirror the latest state for event handlers and async callbacks.
  const draftRef = useRef<Draft | null>(null);
  const baseKeyRef = useRef('');
  useEffect(() => {
    draftRef.current = draft;
    baseKeyRef.current = baseKey;
  }, [draft, baseKey]);

  const dirty = !!draft && keyOf(draft) !== baseKey;

  // Adopts a server copy as the new working copy and baseline.
  const adopt = useCallback((l: Listing) => {
    const d: Draft = { product: clone(l.product), content: clone(l.content), media: clone(l.media) };
    setListing(l);
    setDraft(d);
    setBaseKey(keyOf(d));
    setPriceText(l.product.price == null ? '' : String(l.product.price));
    setQtyText(l.product.quantity == null ? '' : String(l.product.quantity));
    setReadyText(l.product.readinessStateId == null ? '' : String(l.product.readinessStateId));
    setLoadError(null);
  }, []);

  // Reloads the listing. Unsaved edits are kept unless the server is still generating.
  const load = useCallback(async () => {
    try {
      const { listing: l } = await api<{ listing: Listing }>(`/api/listings/${id}`);
      const current = draftRef.current;
      const hasEdits = !!current && keyOf(current) !== baseKeyRef.current;
      if (!hasEdits || l.status === 'generating') adopt(l);
      else setListing(l);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [id, adopt]);

  const loadEtsy = useCallback(async () => {
    try {
      const status = await api<EtsyStatus>('/api/etsy/status');
      setEtsy(status);
      if (status.connected && status.hasShop) {
        const res = await api<{ profiles: ShippingProfile[] }>('/api/etsy/shipping-profiles').catch(() => null);
        setShipping(res?.profiles ?? null);
      } else {
        setShipping(null);
      }
    } catch {
      setEtsy({ configured: true, connected: false, hasShop: false, shopId: null, shopName: null });
    }
  }, []);

  // Refresh the listing and Etsy status every time the screen comes into focus.
  useFocusEffect(useCallback(() => {
    load();
    loadEtsy();
  }, [load, loadEtsy]));

  // Poll while the server is still writing the listing.
  const generating = listing?.status === 'generating';
  useEffect(() => {
    if (!generating) return;
    const timer = setInterval(() => { load(); }, 1200);
    return () => clearInterval(timer);
  }, [generating, load]);

  // ----- derived -----
  const issues: Issue[] = useMemo(() => (draft
    ? listingIssues(draft.product, draft.content, photoCountOf(draft), { forPublish: true })
    : []), [draft]);
  const blocking = issues.filter((i) => i.severity === 'error');
  const issueFor = (field: string) => issues.find((i) => i.field === field);

  // Warn about the leftover unsaved-changes state when leaving the screen.
  usePreventRemove(dirty, ({ repeat }) => {
    Alert.alert('Discard unsaved changes?', 'Your latest edits have not been saved yet.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: repeat },
    ]);
  });

  // ----- editing helpers -----
  const setProduct = (patch: Partial<Product>) => setDraft((d) => (d ? { ...d, product: { ...d.product, ...patch } } : d));
  const setContent = (patch: Partial<Content>) => setDraft((d) => (d ? { ...d, content: { ...d.content, ...patch } } : d));

  const onPrice = (v: string) => {
    setPriceText(v);
    const n = v.trim() === '' ? null : Number(v);
    setProduct({ price: n !== null && Number.isFinite(n) ? n : null });
  };
  const onQuantity = (v: string) => {
    setQtyText(v);
    const n = v.trim() === '' ? null : Number(v);
    setProduct({ quantity: n !== null && Number.isFinite(n) ? n : null });
  };
  const onReadiness = (v: string) => {
    setReadyText(v);
    const n = v.trim() === '' ? null : Number(v);
    setProduct({ readinessStateId: n !== null && Number.isFinite(n) ? n : null });
  };

  // ----- category search -----
  useEffect(() => {
    if (!taxOpen) return;
    const q = taxQuery.trim();
    const t = setTimeout(async () => {
      try {
        const { results } = await api<{ results: TaxonomyNode[] }>(`/api/etsy/taxonomy?q=${encodeURIComponent(q)}`);
        setTaxResults(results);
        setTaxError(null);
      } catch (e) {
        setTaxResults([]);
        setTaxError((e as Error).message);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [taxQuery, taxOpen]);

  const chooseCategory = (node: TaxonomyNode) => {
    setProduct({ taxonomyId: node.id, taxonomyPath: node.path });
    setTaxOpen(false);
    setTaxQuery('');
  };

  // ----- photos -----
  const images = draft?.media.filter((m) => m.kind === 'image') ?? [];

  const movePhoto = (index: number, dir: -1 | 1) => {
    setDraft((d) => {
      if (!d) return d;
      const imgs = d.media.filter((m) => m.kind === 'image');
      const others = d.media.filter((m) => m.kind !== 'image');
      const j = index + dir;
      if (j < 0 || j >= imgs.length) return d;
      [imgs[index], imgs[j]] = [imgs[j], imgs[index]];
      const alts = [...d.content.altTexts];
      while (alts.length < imgs.length) alts.push('');
      [alts[index], alts[j]] = [alts[j], alts[index]];
      return { ...d, media: [...imgs, ...others], content: { ...d.content, altTexts: alts } };
    });
  };

  const setAlt = (index: number, text: string) => {
    setDraft((d) => {
      if (!d) return d;
      const alts = [...d.content.altTexts];
      while (alts.length <= index) alts.push('');
      alts[index] = text;
      return { ...d, content: { ...d.content, altTexts: alts } };
    });
  };

  const addPhotos = async () => {
    const room = MAX_PHOTOS - images.length;
    if (room <= 0) return Alert.alert('Photo limit', `A listing can have up to ${MAX_PHOTOS} photos.`);
    const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.85 });
    if (result.canceled) return;
    setBusy('photo');
    try {
      const form = new FormData();
      const files = await Promise.all(result.assets.map((a, i) => preparePhoto(a, `photo-${i + 1}.jpg`)));
      await appendFiles(form, 'images', files);
      const { listing: l } = await api<{ listing: Listing }>(`/api/listings/${id}/media`, { method: 'POST', form });
      const wasDirty = dirty;
      setDraft((d) => {
        if (!d) return d;
        const added = l.media.filter((m) => m.kind === 'image').length - imageIds(d.media).length;
        const next = { ...d, media: l.media, content: { ...d.content, altTexts: [...d.content.altTexts, ...Array.from({ length: Math.max(0, added) }, () => '')] } };
        if (!wasDirty) setBaseKey(keyOf(next));
        return next;
      });
      setListing(l);
    } catch (e) {
      setBanner({ tone: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = (m: Media, index: number) => {
    Alert.alert('Remove this photo?', 'It is deleted from Velista. If it is already on Etsy, remove it there too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const { listing: l } = await api<{ listing: Listing }>(`/api/listings/${id}/media/${m.id}`, { method: 'DELETE' });
            setDraft((d) => (d ? {
              ...d,
              media: l.media,
              content: { ...d.content, altTexts: d.content.altTexts.filter((_, i) => i !== index) },
            } : d));
            setListing(l);
          } catch (e) {
            setBanner({ tone: 'error', text: (e as Error).message });
          }
        },
      },
    ]);
  };

  // ----- save / publish -----
  const saveDraft = async (): Promise<boolean> => {
    const current = draftRef.current;
    if (!current) return false;
    const sentKey = keyOf(current);
    try {
      const res = await api<{ listing: Listing }>(`/api/listings/${id}`, {
        method: 'PUT',
        body: { product: current.product, content: current.content, mediaOrder: imageIds(current.media) },
      });
      const server: Draft = { product: res.listing.product, content: res.listing.content, media: res.listing.media };
      setListing(res.listing);
      // Keep edits made while the request was in flight; otherwise adopt the server's normalised copy.
      if (draftRef.current && keyOf(draftRef.current) === sentKey) {
        setDraft(clone(server));
        setBaseKey(keyOf(server));
      } else {
        setBaseKey(keyOf(server));
      }
      return true;
    } catch (e) {
      setBanner({ tone: 'error', text: (e as Error).message });
      return false;
    }
  };

  const save = async () => {
    setBusy('save');
    const ok = await saveDraft();
    setBusy(null);
    if (ok) setBanner({ tone: 'success', text: 'Changes saved.' });
  };

  const publish = async (state: 'active' | 'draft') => {
    if (!draft) return;
    setPublishTried(true);
    const pubIssues = listingIssues(draft.product, draft.content, photoCountOf(draft), {
      forPublish: state === 'active',
      forEtsyDraft: state !== 'active',
    }).filter((i) => i.severity === 'error');
    if (pubIssues.length) {
      setBanner({
        tone: 'error',
        title: `Fix ${pubIssues.length} item${pubIssues.length === 1 ? '' : 's'} first`,
        text: pubIssues.map((i) => i.message).join(' '),
      });
      return;
    }
    if (!etsy?.configured) {
      setBanner({ tone: 'warn', text: 'The server has no Etsy API key yet. Add ETSY_API_KEY to its .env file.' });
      return;
    }
    if (!etsy.connected || !etsy.hasShop) {
      Alert.alert('Connect Etsy first', 'Link your Etsy shop in Settings, then publish this listing.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => router.push('/(tabs)/settings') },
      ]);
      return;
    }

    setBusy(state);
    try {
      if (dirty) {
        const ok = await saveDraft();
        if (!ok) return;
      }
      const res = await api<{ listing: Listing }>(`/api/listings/${id}/publish`, { method: 'POST', body: { state } });
      adopt(res.listing);
      setPublishTried(false);
      if (state === 'active') {
        setBanner({
          tone: 'success',
          title: 'Live on Etsy',
          text: 'Your listing is published.',
          action: res.listing.etsy?.url ? { label: 'View on Etsy', onPress: () => Linking.openURL(res.listing.etsy!.url) } : undefined,
        });
      } else {
        setBanner({
          tone: 'success',
          text: 'Saved to Etsy as a draft. Open your Etsy drafts to review and activate it.',
          action: { label: 'Open Etsy drafts', onPress: () => Linking.openURL('https://www.etsy.com/your/shops/me/tools/listings/draft') },
        });
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 422 && err.data?.issues) {
        setBanner({ tone: 'error', text: 'Some fields need attention before publishing.' });
      } else if (err.data?.code === 'etsy_not_connected') {
        Alert.alert('Connect Etsy first', err.message, [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => router.push('/(tabs)/settings') },
        ]);
      } else if (err.status === 502) {
        if (err.data?.listing) adopt(err.data.listing);
        setBanner({ tone: 'error', title: 'Etsy did not accept this listing', text: err.message });
      } else {
        setBanner({ tone: 'error', text: err.message });
      }
    } finally {
      setBusy(null);
    }
  };

  const regenerate = () => {
    Alert.alert('Regenerate the copy?', 'The title, description, tags, category and alt text will be rewritten. Photos and product details stay the same.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Regenerate',
        onPress: async () => {
          try {
            const { listing: l } = await api<{ listing: Listing }>(`/api/listings/${id}/regenerate`, { method: 'POST' });
            adopt(l);
          } catch (e) {
            setBanner({ tone: 'error', text: (e as Error).message });
          }
        },
      },
    ]);
  };

  // ----- render -----
  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: 'Edit listing',
        headerBackTitle: 'Listings',
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
        headerRight: () => (
          listing && listing.status !== 'generating' ? (
            <Pressable onPress={regenerate} accessibilityRole="button" accessibilityLabel="Regenerate copy" hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accent50, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, marginRight: Platform.OS === 'web' ? 14 : 0 }}>
              <Ionicons name="sparkles" size={15} color={colors.accent} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accentDark }}>Rewrite</Text>
            </Pressable>
          ) : null
        ),
      }}
    />
  );

  if (loadError && !listing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.md, justifyContent: 'center' }}>
        {header}
        <Banner tone="error" text={loadError} action={{ label: 'Try again', onPress: load }} />
      </View>
    );
  }

  if (!listing || !draft) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        {header}
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (listing.status === 'generating') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.xl, gap: space.md, justifyContent: 'center' }}>
        {header}
        <Card style={{ alignItems: 'center', paddingVertical: 44, gap: 10 }}>
          <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.accent50, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
          <Text style={[font.h2, { fontSize: 19, marginTop: 6 }]}>Creating your listing</Text>
          <View style={{ backgroundColor: colors.info50, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.infoDark, textAlign: 'center' }}>{listing.step ?? 'Working…'}</Text>
          </View>
          <Text style={[font.small, { textAlign: 'center' }]}>This usually takes 15 to 40 seconds. You can leave this screen; the work continues on the server.</Text>
        </Card>
      </View>
    );
  }

  const cover = images[0];
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
  const publishable = blocking.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: space.lg + 2, gap: space.md + 2, paddingBottom: 170 }} keyboardShouldPersistTaps="handled">
        <Row style={{ justifyContent: 'space-between' }}>
          <StatusBadge status={listing.status} />
          <Row style={{ gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dirty ? colors.warn : colors.ok }} />
            <Text style={[font.small, { fontWeight: '600', color: dirty ? colors.warn : colors.muted }]}>{dirty ? 'Unsaved changes' : `Saved ${timeAgo(listing.updatedAt)}`}</Text>
          </Row>
        </Row>

        {listing.status === 'failed' && listing.error ? (
          <Banner tone="error" title={STATUS_LABEL.failed} text={listing.error} />
        ) : null}
        {banner ? <Banner tone={banner.tone} title={banner.title} text={banner.text} action={banner.action} /> : null}
        {!etsy?.connected ? (
          <Banner tone="info" text="Connect your Etsy shop in Settings to publish from here. You can keep editing without it." />
        ) : null}

        {/* Preview */}
        <Card style={{ padding: 12, gap: 10 }}>
          <Text style={[font.overline, { marginLeft: 2 }]}>Etsy preview</Text>
          <Row style={{ gap: 14, alignItems: 'flex-start' }}>
            <View style={{ width: 112, height: 112, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface3 }}>
              {cover ? (
                <Image source={{ uri: mediaUrl(listing.id, cover.id), headers: authHeaders }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="image-outline" size={30} color={colors.muted} /></View>
              )}
            </View>
            <View style={{ flex: 1, gap: 5, paddingTop: 2 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 }}>{draft.product.price != null ? money(draft.product.price) : 'Price'}</Text>
              <Text style={{ fontSize: 14, color: colors.ink2, lineHeight: 19 }} numberOfLines={3}>{draft.content.title || 'Your title appears here'}</Text>
              <Row style={{ gap: 5 }}>
                <Ionicons name="storefront-outline" size={13} color={colors.muted} />
                <Text style={font.small} numberOfLines={1}>{etsy?.shopName ?? 'Your shop'}{draft.product.isSupply ? ' · Supplies' : ''}</Text>
              </Row>
            </View>
          </Row>
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader
            icon="images-outline"
            title="Photos"
            subtitle="The first photo is your cover. Alt text helps screen readers and search."
            right={<Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink2 }}>{images.length}/{MAX_PHOTOS}</Text>}
          />
          {images.map((m, i) => (
            <View key={m.id} style={{ flexDirection: 'row', gap: 12, padding: 10, borderRadius: radius.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line }}>
              <View style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface3 }}>
                <Image source={{ uri: mediaUrl(listing.id, m.id), headers: authHeaders }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={font.label}>{i === 0 ? 'Cover · ' : ''}Alt text for photo {i + 1}</Text>
                <TextInput
                  value={draft.content.altTexts[i] ?? ''}
                  onChangeText={(t) => setAlt(i, t)}
                  placeholder="Describe what the photo shows"
                  placeholderTextColor={colors.placeholder}
                  maxLength={250}
                  accessibilityLabel={`Alt text for photo ${i + 1}`}
                  style={{ minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 11, paddingVertical: 8, fontSize: 14, color: colors.ink }}
                />
                <Row>
                  <Pressable onPress={() => movePhoto(i, -1)} disabled={i === 0} accessibilityLabel={`Move photo ${i + 1} up`} style={iconBtn(i === 0)}>
                    <Ionicons name="arrow-up" size={16} color={colors.ink2} />
                  </Pressable>
                  <Pressable onPress={() => movePhoto(i, 1)} disabled={i === images.length - 1} accessibilityLabel={`Move photo ${i + 1} down`} style={iconBtn(i === images.length - 1)}>
                    <Ionicons name="arrow-down" size={16} color={colors.ink2} />
                  </Pressable>
                  <Pressable onPress={() => removePhoto(m, i)} accessibilityLabel={`Remove photo ${i + 1}`} style={iconBtn(false)}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                </Row>
              </View>
            </View>
          ))}
          {images.length === 0 ? <Text style={[font.small, { color: colors.warn }]}>Add at least one photo before publishing.</Text> : null}
          {draft.media.some((m) => m.kind !== 'image') ? (
            <Text style={font.small}>
              Used for analysis: {draft.media.filter((m) => m.kind !== 'image').map((m) => (m.kind === 'video' ? 'video' : 'voice note')).join(', ')}
            </Text>
          ) : null}
          <Button title="Add photos" variant="secondary" icon="add" onPress={addPhotos} loading={busy === 'photo'} disabled={images.length >= MAX_PHOTOS} full />
        </Card>

        {/* Copy */}
        <Card>
          <CardHeader icon="document-text-outline" title="Title and description" />
          <Field
            label="Title" value={draft.content.title} onChangeText={(v) => setContent({ title: v })}
            counter={{ length: draft.content.title.length, max: TITLE_MAX }}
            error={issueFor('title')?.severity === 'error' ? issueFor('title')?.message : undefined}
          />
          <Field
            label="Description" value={draft.content.description} onChangeText={(v) => setContent({ description: v })}
            multiline hint="Short lines starting with “- ” read well for materials, colors and sizes."
            error={issueFor('description') ? issueFor('description')?.message : undefined}
          />
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader icon="pricetags-outline" title="Tags" />
          <ChipInput
            label="Tags"
            values={draft.content.tags}
            onChange={(v) => setContent({ tags: v })}
            placeholder="Add a tag, then Enter"
            maxCount={TAG_MAX_COUNT}
            maxLength={TAG_MAX_LENGTH}
            hint={`Up to ${TAG_MAX_COUNT} tags, each ${TAG_MAX_LENGTH} characters or fewer.`}
          />
        </Card>

        {/* Category and attributes */}
        <Card>
          <CardHeader icon="folder-open-outline" title="Category" />
          <Pressable
            onPress={() => setTaxOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel="Choose Etsy category"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, borderRadius: radius.sm, borderWidth: 1.5, borderColor: issueFor('taxonomyId') && publishTried ? colors.danger : taxOpen ? colors.accent : colors.line, paddingHorizontal: 15, backgroundColor: taxOpen ? colors.surface : colors.surface2 }}
          >
            <Text style={{ flex: 1, fontSize: 15, color: draft.product.taxonomyPath ? colors.ink : colors.placeholder }} numberOfLines={2}>
              {draft.product.taxonomyPath ?? (draft.product.taxonomyId ? `Category ${draft.product.taxonomyId}` : 'Choose a category')}
            </Text>
            <Ionicons name={taxOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
          </Pressable>
          {publishTried && issueFor('taxonomyId') ? <Text style={{ fontSize: 12.5, color: colors.danger }}>{issueFor('taxonomyId')!.message}</Text> : null}
          {taxOpen ? (
            <View style={{ gap: 8 }}>
              <TextInput
                value={taxQuery}
                onChangeText={setTaxQuery}
                placeholder="Search, e.g. mugs or necklaces"
                placeholderTextColor={colors.placeholder}
                autoFocus
                accessibilityLabel="Search Etsy categories"
                style={{ minHeight: 46, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 14, fontSize: 15, color: colors.ink, backgroundColor: colors.surface2 }}
              />
              {taxError ? <Text style={{ fontSize: 12.5, color: colors.danger }}>{taxError}</Text> : null}
              {taxResults.map((n) => (
                <Pressable key={n.id} onPress={() => chooseCategory(n)} accessibilityRole="button" style={({ pressed }) => ({ paddingVertical: 11, paddingHorizontal: 13, borderRadius: 12, backgroundColor: pressed ? colors.accent50 : colors.surface2, borderWidth: 1, borderColor: colors.line })}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>{n.name}</Text>
                  <Text style={font.small} numberOfLines={1}>{n.path}</Text>
                </Pressable>
              ))}
              {!taxResults.length && !taxError && taxQuery.trim() ? <Text style={font.small}>No categories match. Try a broader word.</Text> : null}
            </View>
          ) : null}

          <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 2 }} />
          <CardHeader icon="list-outline" title="Attributes" />
          {draft.content.attributes.map((a, i) => (
            <Row key={i} style={{ alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Field label="Name" value={a.name} onChangeText={(v) => setContent({ attributes: draft.content.attributes.map((x, j) => (j === i ? { ...x, name: v } : x)) })} placeholder="Material" />
              </View>
              <View style={{ flex: 1.4 }}>
                <Field label="Value" value={a.value} onChangeText={(v) => setContent({ attributes: draft.content.attributes.map((x, j) => (j === i ? { ...x, value: v } : x)) })} placeholder="Stoneware" />
              </View>
              <Pressable onPress={() => setContent({ attributes: draft.content.attributes.filter((_, j) => j !== i) })} accessibilityLabel={`Remove attribute ${i + 1}`} style={{ height: 46, justifyContent: 'center', paddingHorizontal: 4 }}>
                <Ionicons name="close-circle-outline" size={22} color={colors.muted} />
              </Pressable>
            </Row>
          ))}
          <Button
            title="Add attribute" variant="ghost" icon="add"
            onPress={() => setContent({ attributes: [...draft.content.attributes, { name: '', value: '' } as Attribute] })}
          />
        </Card>

        {/* Pricing and shop details */}
        <Card>
          <CardHeader icon="cash-outline" title="Pricing and shop details" />
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Field label="Price (USD)" value={priceText} onChangeText={onPrice} keyboardType="decimal-pad" error={issueFor('price')?.severity === 'error' && (publishTried || priceText !== '') ? issueFor('price')?.message : undefined} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Quantity" value={qtyText} onChangeText={onQuantity} keyboardType="numeric" error={issueFor('quantity') ? issueFor('quantity')?.message : undefined} />
            </View>
          </Row>
          <Select label="Who made it" value={draft.product.whoMade} onChange={(v) => setProduct({ whoMade: v as Product['whoMade'] })} options={WHO_MADE} />
          <Select label="When it was made" value={draft.product.whenMade} onChange={(v) => setProduct({ whenMade: v })} options={WHEN_MADE} />
          <SwitchRow label="Craft supply" hint="Helps buyers find it under Supplies." value={draft.product.isSupply} onChange={(v) => setProduct({ isSupply: v })} />
          {etsy?.connected && etsy.hasShop ? (
            <Select
              label="Shipping profile"
              value={draft.product.shippingProfileId ? String(draft.product.shippingProfileId) : null}
              onChange={(v) => setProduct({ shippingProfileId: Number(v) })}
              options={(shipping ?? []).map((p) => ({ value: String(p.id), label: p.title }))}
              placeholder={shipping ? 'Choose a profile' : 'Loading profiles…'}
              error={publishTried ? issueFor('shippingProfileId')?.message : undefined}
              hint={shipping && !shipping.length ? 'No profiles yet. Create one in Etsy Shop Manager.' : undefined}
            />
          ) : (
            <Banner tone="info" text="Connect Etsy in Settings to choose a shipping profile from your shop." />
          )}
          <Field label="Readiness state ID" value={readyText} onChangeText={onReadiness} keyboardType="numeric" hint="Optional. Etsy requires it for physical items with processing times. Set a default in Settings." />
        </Card>

        {/* Checklist */}
        <Card>
          <CardHeader icon="checkmark-done-outline" title="Publishing readiness" />
          {checklist(draft, photoCountOf(draft)).map((c) => (
            <Row key={c.label} style={{ justifyContent: 'space-between', paddingVertical: 2 }}>
              <Row>
                <Ionicons name={c.ok ? 'checkmark-circle' : c.warn ? 'alert-circle' : 'ellipse-outline'} size={21} color={c.ok ? colors.ok : c.warn ? colors.warn : colors.danger} />
                <Text style={{ fontSize: 14.5, color: colors.ink, fontWeight: '500' }}>{c.label}</Text>
              </Row>
              <Text style={[font.small, { fontWeight: '600' }]}>{c.meta}</Text>
            </Row>
          ))}
          <Row style={{ gap: 8, backgroundColor: publishable ? colors.ok50 : colors.warn50, padding: 12, borderRadius: radius.sm }}>
            <Ionicons name={publishable ? 'rocket-outline' : 'time-outline'} size={18} color={publishable ? colors.okDark : colors.warn} />
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: publishable ? colors.okDark : colors.warn }}>
              {publishable ? 'Ready to publish' : 'Finish the required items to publish'}
            </Text>
          </Row>
        </Card>

        <MarketplacesCard listing={listing} onListing={adopt} saveFirst={async () => (dirty ? saveDraft() : true)} />

        {/* AI notes */}
        {listing.analysis ? (
          <Card>
            <CardHeader
              icon="sparkles-outline"
              title="AI notes"
              right={(
                <View style={{ backgroundColor: listing.analysis.source === 'ai' ? colors.accent50 : colors.surface3, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: listing.analysis.source === 'ai' ? colors.accentDark : colors.muted }}>
                    {listing.analysis.source === 'ai' ? (listing.analysis.provider === 'anthropic' ? 'Claude Vision' : 'OpenAI Vision') : 'Template'}
                  </Text>
                </View>
              )}
            />
            {listing.analysis.source === 'template' ? (
              <Text style={font.small}>Written from the details you entered. Add an AI key on the server to let Velista read your photos.</Text>
            ) : null}
            {listing.analysis.transcript ? (
              <Text style={[font.body, { fontStyle: 'italic' }]}>“{listing.analysis.transcript.slice(0, 280)}”</Text>
            ) : null}
            {listing.content.suggestedPrice ? (
              <Row style={{ justifyContent: 'space-between', backgroundColor: colors.accent50, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent100 }}>
                <View>
                  <Text style={font.small}>Suggested price</Text>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>{money(listing.content.suggestedPrice)}</Text>
                </View>
                <Button
                  title="Use it" variant="secondary"
                  onPress={() => { setPriceText(String(listing.content.suggestedPrice)); setProduct({ price: listing.content.suggestedPrice }); }}
                  style={{ minHeight: 38, paddingHorizontal: 14 }}
                />
              </Row>
            ) : null}
            {listing.content.pricingNote ? <Text style={font.small}>{listing.content.pricingNote}</Text> : null}
            {(listing.analysis.warnings ?? []).map((w) => <Banner key={w} tone="warn" text={w} />)}
          </Card>
        ) : null}

        {draft.product.price !== null && draft.product.price < MIN_PRICE ? (
          <Banner tone="warn" text={`Etsy requires a price of at least $${MIN_PRICE.toFixed(2)}.`} />
        ) : null}
        {Number(qtyText) > MAX_QUANTITY ? <Banner tone="warn" text={`Quantity can be at most ${MAX_QUANTITY}.`} /> : null}
      </ScrollView>

      {/* Actions */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, gap: 10, borderTopLeftRadius: 22, borderTopRightRadius: 22, ...shadow, shadowOffset: { width: 0, height: -4 } }}>
        <Row>
          <Button title="Save" variant="secondary" icon="save-outline" onPress={save} loading={busy === 'save'} disabled={!dirty || !!busy} style={{ flex: 1 }} />
          <Button title="Save draft" variant="secondary" icon="cloud-upload-outline" onPress={() => publish('draft')} loading={busy === 'draft'} disabled={!!busy} style={{ flex: 1.2 }} />
        </Row>
        <Button title="Publish to Etsy" icon="send" onPress={() => publish('active')} loading={busy === 'active'} disabled={!!busy} full />
      </View>
    </View>
  );
}

function checklist(d: Draft, photos: number) {
  const pub = listingIssues(d.product, d.content, photos, { forPublish: true });
  const has = (f: string) => pub.some((i) => i.field === f && i.severity === 'error');
  const warn = (f: string) => pub.some((i) => i.field === f && i.severity === 'warning');
  return [
    { label: 'Title', ok: !has('title'), warn: false, meta: `${d.content.title.length}/${TITLE_MAX}` },
    { label: 'Description', ok: !has('description'), warn: false, meta: '' },
    { label: 'Tags', ok: !has('tags'), warn: false, meta: `${d.content.tags.length}/${TAG_MAX_COUNT}` },
    { label: 'Price', ok: !has('price'), warn: false, meta: d.product.price != null ? money(d.product.price) : '' },
    { label: 'Category', ok: !has('taxonomyId'), warn: false, meta: '' },
    { label: 'Photos', ok: !has('media'), warn: false, meta: String(photos) },
    { label: 'Shipping profile', ok: !has('shippingProfileId'), warn: false, meta: '' },
    { label: 'Alt text', ok: !warn('altTexts'), warn: warn('altTexts'), meta: '' },
  ];
}

const iconBtn = (disabled: boolean) => ({
  width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: colors.line2,
  alignItems: 'center' as const, justifyContent: 'center' as const, opacity: disabled ? 0.35 : 1, backgroundColor: colors.surface,
});

