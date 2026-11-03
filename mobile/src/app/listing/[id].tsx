import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { api, ApiError, appendFiles } from '@/lib/api';
import { preparePhoto } from '@/lib/images';
import { MAX_QUANTITY, MIN_PRICE, MAX_PHOTOS, listingIssues } from '@/lib/rules';
import { STATUS_LABEL } from '@/lib/format';
import type { Content, EtsyStatus, Issue, Listing, Media, Product, ShippingProfile, TaxonomyNode } from '@/lib/types';
import { Banner, Card, CardHeader } from '@/components/ui';
import { AiNotesCard } from '@/components/listings/editor/AiNotesCard';
import { AttributesEditor } from '@/components/listings/editor/AttributesEditor';
import { CategoryPicker } from '@/components/listings/editor/CategoryPicker';
import { CopySection, TagsSection } from '@/components/listings/editor/CopySection';
import { EditorActionBar, SaveStatus } from '@/components/listings/editor/EditorBits';
import { ListingPreview } from '@/components/listings/editor/ListingPreview';
import { PhotosEditor } from '@/components/listings/editor/PhotosEditor';
import { ReadinessChecklist } from '@/components/listings/editor/ReadinessChecklist';
import { ShopDetailsSection } from '@/components/listings/editor/ShopDetailsSection';
import { MarketplacesCard } from '@/components/marketplaces/MarketplacesCard';
import { colors, font, space } from '@/theme';

type Draft = { product: Product; content: Content; media: Media[] };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const imageIds = (media: Media[]) => media.filter((m) => m.kind === 'image').map((m) => m.id);
const keyOf = (d: Draft) => JSON.stringify({ p: d.product, c: d.content, o: imageIds(d.media) });
const photoCountOf = (d: Draft) => d.media.filter((m) => m.kind === 'image').length;

type Notice = { tone: 'info' | 'warn' | 'error' | 'success'; title?: string; text: string; action?: { label: string; onPress: () => void } };

export default function ListingEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

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

  const chooseCategory = (node: TaxonomyNode) => setProduct({ taxonomyId: node.id, taxonomyPath: node.path });

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

  const publishable = blocking.length === 0;
  const errorOf = (field: string, show = true) => {
    const issue = issueFor(field);
    return show && issue?.severity === 'error' ? issue.message : undefined;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: space.lg + 2, gap: space.md + 2, paddingBottom: 170 }} keyboardShouldPersistTaps="handled">
        <SaveStatus status={listing.status} dirty={dirty} updatedAt={listing.updatedAt} />

        {listing.status === 'failed' && listing.error ? (
          <Banner tone="error" title={STATUS_LABEL.failed} text={listing.error} />
        ) : null}
        {banner ? <Banner tone={banner.tone} title={banner.title} text={banner.text} action={banner.action} /> : null}
        {!etsy?.connected ? (
          <Banner tone="info" text="Connect your Etsy shop in Settings to publish from here. You can keep editing without it." />
        ) : null}

        <ListingPreview
          listingId={listing.id}
          coverId={images[0]?.id}
          price={draft.product.price}
          title={draft.content.title}
          shopName={etsy?.shopName}
          isSupply={draft.product.isSupply}
        />

        <PhotosEditor
          listingId={listing.id}
          media={draft.media}
          altTexts={draft.content.altTexts}
          onAltChange={setAlt}
          onMove={movePhoto}
          onRemove={removePhoto}
          onAdd={addPhotos}
          adding={busy === 'photo'}
        />

        <CopySection
          title={draft.content.title}
          description={draft.content.description}
          onChange={setContent}
          titleError={errorOf('title')}
          descriptionError={issueFor('description')?.message}
        />

        <TagsSection tags={draft.content.tags} onChange={(tags) => setContent({ tags })} />

        <Card>
          <CardHeader icon="folder-open-outline" title="Category" />
          <CategoryPicker
            taxonomyId={draft.product.taxonomyId}
            taxonomyPath={draft.product.taxonomyPath}
            onChoose={chooseCategory}
            error={publishTried ? issueFor('taxonomyId')?.message : undefined}
          />
          <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 2 }} />
          <AttributesEditor attributes={draft.content.attributes} onChange={(attributes) => setContent({ attributes })} />
        </Card>

        <ShopDetailsSection
          product={draft.product}
          priceText={priceText}
          qtyText={qtyText}
          readyText={readyText}
          onPrice={onPrice}
          onQuantity={onQuantity}
          onReadiness={onReadiness}
          onChange={setProduct}
          shopConnected={!!(etsy?.connected && etsy.hasShop)}
          shipping={shipping}
          errors={{
            price: errorOf('price', publishTried || priceText !== ''),
            quantity: issueFor('quantity')?.message,
            shippingProfileId: publishTried ? issueFor('shippingProfileId')?.message : undefined,
          }}
        />

        <ReadinessChecklist product={draft.product} content={draft.content} photoCount={photoCountOf(draft)} ready={publishable} />

        <MarketplacesCard listing={listing} onListing={adopt} saveFirst={async () => (dirty ? saveDraft() : true)} />

        {listing.analysis ? (
          <AiNotesCard
            analysis={listing.analysis}
            suggestedPrice={listing.content.suggestedPrice}
            pricingNote={listing.content.pricingNote}
            onUsePrice={(price) => { setPriceText(String(price)); setProduct({ price }); }}
          />
        ) : null}

        {draft.product.price !== null && draft.product.price < MIN_PRICE ? (
          <Banner tone="warn" text={`Etsy requires a price of at least $${MIN_PRICE.toFixed(2)}.`} />
        ) : null}
        {Number(qtyText) > MAX_QUANTITY ? <Banner tone="warn" text={`Quantity can be at most ${MAX_QUANTITY}.`} /> : null}
      </ScrollView>

      <EditorActionBar dirty={dirty} busy={busy} onSave={save} onSaveDraft={() => publish('draft')} onPublish={() => publish('active')} />
    </View>
  );
}
