import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { api, ApiError, appendFiles } from '@/lib/api';
import { preparePhoto } from '@/lib/images';
import { useAuth } from '@/lib/auth';
import { LANGUAGES, MAX_BULK, MAX_QUANTITY, MIN_PRICE, PRODUCT_TYPES, TONES } from '@/lib/rules';
import type { Tone } from '@/lib/types';
import { Banner, Button, Card, CardHeader, Field, Heading, Row, Screen, Segmented, Select } from '@/components/ui';
import { colors, font, radius, space } from '@/theme';

type Item = { id: string; uri: string; name: string; type: string };

export default function BulkScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [type, setType] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState(String(user?.settings.defaultQuantity ?? 1));
  const [materials, setMaterials] = useState('');
  const [tone, setTone] = useState<Tone>(user?.settings.defaultTone ?? 'warm');
  const [language, setLanguage] = useState(user?.settings.defaultLanguage ?? 'English');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const pick = async () => {
    const room = MAX_BULK - items.length;
    if (room <= 0) return Alert.alert('Limit reached', `A bulk upload can include up to ${MAX_BULK} photos.`);
    const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.85 });
    if (result.canceled) return;
    const picked = await Promise.all(result.assets.map(async (a, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      ...(await preparePhoto(a, `product-${items.length + i + 1}.jpg`)),
    })));
    setItems((prev) => [...prev, ...picked].slice(0, MAX_BULK));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    const q = Number(quantity);
    if (!Number.isInteger(q) || q < 1 || q > MAX_QUANTITY) e.quantity = `Enter a whole number from 1 to ${MAX_QUANTITY}.`;
    if (price.trim() && (!Number.isFinite(Number(price)) || Number(price) < MIN_PRICE)) e.price = `Enter at least $${MIN_PRICE.toFixed(2)}, or leave it blank.`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const create = async () => {
    setBanner(null);
    if (!items.length) return setBanner('Add at least one photo.');
    if (!validate()) return;
    setBusy(true);
    try {
      const form = new FormData();
      await appendFiles(form, 'images', items);
      form.append('defaults', JSON.stringify({
        type: type.trim(),
        price: price.trim() ? Number(price) : null,
        quantity: Number(quantity),
        materials: materials.trim(),
        tone,
        language,
      }));
      const res = await api<{ listings: { id: string }[] }>('/api/listings/bulk', { method: 'POST', form });
      setItems([]);
      Alert.alert('Listings started', `${res.listings.length} listing${res.listings.length === 1 ? '' : 's'} are being written. Open the Listings tab to follow progress.`);
      router.replace('/');
    } catch (e) {
      setBanner((e as ApiError).message || 'Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Heading eyebrow="Many products at once" title="Bulk upload" subtitle={`Each photo becomes its own listing. Up to ${MAX_BULK} at once.`} />
      {banner ? <View style={{ marginBottom: space.md }}><Banner tone="error" text={banner} /></View> : null}

      <Card>
        <CardHeader
          icon="images-outline"
          title="Product photos"
          subtitle="Name each file after its product, such as sage-mug.jpg. The file name becomes the starting title."
          right={<Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink2 }}>{items.length}/{MAX_BULK}</Text>}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {items.map((it, i) => (
            <View key={it.id} style={{ width: '31%', gap: 4 }}>
              <View style={{ aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface3 }}>
                <Image source={{ uri: it.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityLabel={it.name} />
                <Pressable
                  onPress={() => setItems((p) => p.filter((x) => x.id !== it.id))}
                  accessibilityLabel={`Remove ${it.name}`}
                  style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="close" size={15} color={colors.ink} />
                </Pressable>
              </View>
              <Text style={{ fontSize: 11.5, color: colors.muted }} numberOfLines={1}>{i + 1}. {it.name}</Text>
            </View>
          ))}
          {items.length < MAX_BULK ? (
            <Pressable
              onPress={pick}
              accessibilityRole="button"
              accessibilityLabel="Add photos"
              style={{ width: '31%', aspectRatio: 1, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accent100, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.accent50 }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="add" size={22} color={colors.accent} />
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.ink2 }}>Add photos</Text>
            </Pressable>
          ) : null}
        </View>
      </Card>

      <View style={{ height: space.md }} />
      <Card>
        <CardHeader icon="copy-outline" title="Shared details" subtitle="Applied to every listing. You can change each one afterwards." />
        <Field label="Product type" value={type} onChangeText={setType} placeholder={`e.g. ${PRODUCT_TYPES[0]}`} />
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Field label="Price (USD)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Optional" error={errors.price} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="numeric" error={errors.quantity} />
          </View>
        </Row>
        <Field label="Materials" value={materials} onChangeText={setMaterials} placeholder="Only if the same for every item" />
        <View style={{ gap: 6 }}>
          <Text style={font.label}>Tone</Text>
          <Segmented<Tone> value={tone} onChange={setTone} options={TONES as { value: Tone; label: string }[]} />
        </View>
        <Select label="Language" value={language} onChange={setLanguage} options={LANGUAGES.map((l) => ({ value: l, label: l }))} />
      </Card>

      <View style={{ marginTop: space.xl }}>
        <Button
          title={items.length ? `Create ${items.length} listing${items.length === 1 ? '' : 's'}` : 'Create listings'}
          icon="sparkles"
          onPress={create}
          loading={busy}
          disabled={!items.length}
          full
        />
      </View>
    </Screen>
  );
}
