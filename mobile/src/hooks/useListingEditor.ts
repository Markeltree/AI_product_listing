import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useFocusEffect, usePreventRemove, useRouter } from 'expo-router';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { api, ApiError, appendFiles } from '@/lib/api';
import { preparePhoto } from '@/lib/images';
import { clone, draftKey, imageIds, parseNumber, photoCountOf, type Draft } from '@/lib/listingDraft';
import { MAX_PHOTOS, listingIssues } from '@/lib/rules';
import type { Content, EtsyStatus, Issue, Listing, Media, Product, ShippingProfile, TaxonomyNode } from '@/lib/types';

export type Notice = { tone: 'info' | 'warn' | 'error' | 'success'; title?: string; text: string; action?: { label: string; onPress: () => void } };

// Everything the listing editor does: loading, editing, saving and publishing. The screen only draws it.
export function useListingEditor(id: string) {
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

  const dirty = !!draft && draftKey(draft) !== baseKey;

  // Adopts a server copy as the new working copy and baseline.
  const adopt = useCallback((l: Listing) => {
    const d: Draft = { product: clone(l.product), content: clone(l.content), media: clone(l.media) };
    setListing(l);
    setDraft(d);
    setBaseKey(draftKey(d));
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
      const hasEdits = !!current && draftKey(current) !== baseKeyRef.current;
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
    setProduct({ price: parseNumber(v) });
  };
  const onQuantity = (v: string) => {
    setQtyText(v);
    setProduct({ quantity: parseNumber(v) });
  };
  const onReadiness = (v: string) => {
    setReadyText(v);
    setProduct({ readinessStateId: parseNumber(v) });
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
        if (!wasDirty) setBaseKey(draftKey(next));
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
    const sentKey = draftKey(current);
    try {
      const res = await api<{ listing: Listing }>(`/api/listings/${id}`, {
        method: 'PUT',
        body: { product: current.product, content: current.content, mediaOrder: imageIds(current.media) },
      });
      const server: Draft = { product: res.listing.product, content: res.listing.content, media: res.listing.media };
      setListing(res.listing);
      // Keep edits made while the request was in flight; otherwise adopt the server's normalised copy.
      if (draftRef.current && draftKey(draftRef.current) === sentKey) {
        setDraft(clone(server));
        setBaseKey(draftKey(server));
      } else {
        setBaseKey(draftKey(server));
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

  const saveIfDirty = async () => (dirty ? saveDraft() : true);

  const applySuggestedPrice = (price: number) => {
    setPriceText(String(price));
    setProduct({ price });
  };

  const errorOf = (field: string, show = true) => {
    const issue = issueFor(field);
    return show && issue?.severity === 'error' ? issue.message : undefined;
  };

  return {
    listing, draft, etsy, shipping, busy, banner, loadError, dirty, publishTried,
    images, priceText, qtyText, readyText,
    photoCount: draft ? photoCountOf(draft) : 0,
    publishable: blocking.length === 0,
    issueFor, errorOf,
    load, adopt, save, saveIfDirty, publish, regenerate,
    setProduct, setContent, setAlt, onPrice, onQuantity, onReadiness, chooseCategory, applySuggestedPrice,
    movePhoto, addPhotos, removePhoto,
  };
}
