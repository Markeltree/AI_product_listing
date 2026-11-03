1
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image as RNImage, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState,
} from 'expo-audio';
import { launchCameraAsync, launchImageLibraryAsync, requestCameraPermissionsAsync, type ImagePickerAsset } from 'expo-image-picker';
import { api, ApiError, appendFile, appendFiles } from '@/lib/api';
import { preparePhoto } from '@/lib/images';
import { useAuth } from '@/lib/auth';
import { formatDuration } from '@/lib/format';
import { LANGUAGES, MAX_PHOTOS, MAX_QUANTITY, MIN_PRICE, PRODUCT_TYPES, TONES } from '@/lib/rules';
import type { Listing, ProductSuggestions, Tone } from '@/lib/types';
import {
  Banner, Button, Card, CardHeader, ChipInput, Field, Heading, KeyValueRow, Row, Screen, Segmented, Select, Stepper,
} from '@/components/ui';
import { colors, font, radius, space } from '@/theme';

type Photo = { id: string; uri: string; name: string; type: string };
type Clip = { uri: string; name: string; type: string; durationMs?: number };

type Details = {
  name: string; type: string; price: string; quantity: string; materials: string; colors: string;
  dimensions: string; brand: string; keywords: string[]; tone: Tone; language: string; audience: string; notes: string;
};

const STEPS = ['Media', 'Details', 'Review'];

// Detail fields the AI can fill in from photos.
const SUGGESTED_FIELDS = ['name', 'type', 'materials', 'colors', 'dimensions', 'brand', 'keywords', 'audience'] as const;

// Fills only the fields the seller left empty, so nothing they typed is overwritten.
function mergeSuggestions(details: Details, s: ProductSuggestions): { next: Details; filled: number } {
  const next = { ...details };
  let filled = 0;
  for (const key of SUGGESTED_FIELDS) {
    if (key === 'keywords') {
      if (!next.keywords.length && s.keywords.length) { next.keywords = s.keywords; filled++; }
    } else if (!next[key].trim() && s[key]) {
      next[key] = s[key];
      filled++;
    }
  }
  return { next, filled };
}

export default function NewListingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const defaults = user?.settings;
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [video, setVideo] = useState<Clip | null>(null);
  const [voice, setVoice] = useState<Clip | null>(null);
  const [details, setDetails] = useState<Details>({
    name: '', type: '', price: '', quantity: String(defaults?.defaultQuantity ?? 1), materials: '', colors: '',
    dimensions: '', brand: '', keywords: [], tone: defaults?.defaultTone ?? 'warm',
    language: defaults?.defaultLanguage ?? 'English', audience: '', notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  // Photo analysis: runs when leaving the media step, once per set of photos.
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedFor, setAnalyzedFor] = useState('');
  const [notice, setNotice] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null);

  const hasMedia = photos.length > 0 || !!video;
  const set = <K extends keyof Details>(key: K, value: Details[K]) => {
    setDetails((d) => ({ ...d, [key]: value }));
    if (errors[key as string]) setErrors((e) => { const n = { ...e }; delete n[key as string]; return n; });
  };

  // ----- media -----
  const addPhotos = async () => {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return Alert.alert('Photo limit', `You can add up to ${MAX_PHOTOS} photos.`);
    const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.85 });
    if (result.canceled) return;
    const added = await Promise.all(result.assets.map(async (a, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      ...(await preparePhoto(a, `photo-${photos.length + i + 1}.jpg`)),
    })));
    setPhotos((p) => [...p, ...added].slice(0, MAX_PHOTOS));
  };

  const movePhoto = (index: number, dir: -1 | 1) => {
    setPhotos((p) => {
      const j = index + dir;
      if (j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const takeVideoAsset = (a: ImagePickerAsset) => {
    setVideo({ uri: a.uri, name: a.fileName ?? 'product-video.mp4', type: a.mimeType ?? 'video/mp4', durationMs: a.duration ?? undefined });
  };

  const addVideo = async () => {
    const result = await launchImageLibraryAsync({ mediaTypes: ['videos'], videoMaxDuration: 60 });
    if (result.canceled) return;
    takeVideoAsset(result.assets[0]);
  };

  // Opens the camera straight away to record the product video.
  const recordVideo = async () => {
    const perm = await requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera blocked', 'Allow camera access in Settings to record a video, or choose one from your gallery instead.');
      return;
    }
    try {
      const result = await launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 60 });
      if (result.canceled) return;
      takeVideoAsset(result.assets[0]);
    } catch (e) {
      setBanner(`The camera could not be opened: ${(e as Error).message}`);
    }
  };

  // ----- voice note (expo-audio) -----
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);

  const startRecording = async () => {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Microphone blocked', 'Allow microphone access in Settings to record a voice note, or pick an audio file instead.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stopRecording = async () => {
    await recorder.stop();
    const uri = recorder.uri;
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (!uri) return setBanner('The recording could not be saved. Please try again.');
    setVoice({ uri, name: 'voice-note.m4a', type: 'audio/m4a', durationMs: recState.durationMillis });
  };

  // Stop a recording if the user leaves the screen.
  useEffect(() => () => {
    if (recState.isRecording) recorder.stop().catch(() => {});
  }, [recState.isRecording, recorder]);

  // ----- validation -----
  const validateDetails = () => {
    const e: Record<string, string> = {};
    if (!details.name.trim()) e.name = 'Enter a product name.';
    if (!details.type.trim()) e.type = 'Enter a product type, such as Mug.';
    const price = details.price.trim();
    if (price && (!Number.isFinite(Number(price)) || Number(price) < MIN_PRICE)) e.price = `Enter at least $${MIN_PRICE.toFixed(2)}, or leave it blank.`;
    const qty = Number(details.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY) e.quantity = `Enter a whole number from 1 to ${MAX_QUANTITY}.`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Sends the photos (and the video, whose frames the server reads) to the AI and prefills the
  // details form. Failure is not fatal: the seller can always type the details in.
  const analyzePhotos = async () => {
    const key = [...photos.map((p) => p.id), video?.uri ?? ''].join(',');
    if ((!photos.length && !video) || key === analyzedFor) return;
    const what = photos.length ? (video ? 'photos and video' : 'photos') : 'video';
    setAnalyzing(true);
    try {
      const form = new FormData();
      form.append('language', details.language);
      if (photos.length) await appendFiles(form, 'images', photos);
      if (video) await appendFile(form, 'video', video);
      const { suggestions } = await api<{ suggestions: ProductSuggestions }>('/api/listings/analyze', { method: 'POST', form });
      const { next: merged, filled } = mergeSuggestions(details, suggestions);
      setDetails(merged);
      setNotice(filled
        ? { tone: 'info', text: `We filled in ${filled} detail${filled === 1 ? '' : 's'} from your ${what}. Check them and fix anything that is not right.` }
        : { tone: 'info', text: `We looked at your ${what} but could not add anything new. Fill in the details below.` });
      setAnalyzedFor(key);
    } catch (e) {
      setNotice({ tone: 'warn', text: `${(e as ApiError).message} You can fill in the details yourself.` });
    } finally {
      setAnalyzing(false);
    }
  };

  const next = async () => {
    setBanner(null);
    if (step === 0) {
      if (!hasMedia) return setBanner('Add at least one photo or a product video to continue.');
      await analyzePhotos();
      setStep(1);
    } else if (step === 1) {
      if (validateDetails()) setStep(2);
    }
  };

  // ----- submit -----
  const generate = async () => {
    setUploading(true);
    setBanner(null);
    try {
      const form = new FormData();
      form.append('product', JSON.stringify({
        name: details.name.trim(),
        type: details.type.trim(),
        price: details.price.trim() ? Number(details.price) : null,
        quantity: Number(details.quantity),
        materials: details.materials.trim(),
        colors: details.colors.trim(),
        dimensions: details.dimensions.trim(),
        brand: details.brand.trim(),
        keywords: details.keywords.join(', '),
        tone: details.tone,
        language: details.language,
        audience: details.audience.trim(),
        notes: details.notes.trim(),
      }));
      await appendFiles(form, 'images', photos);
      if (video) await appendFile(form, 'video', video);
      if (voice) await appendFile(form, 'voice', voice);

      const { listing } = await api<{ listing: Listing }>('/api/listings', { method: 'POST', form });
      setPhotos([]);
      setVideo(null);
      setVoice(null);
      router.push(`/listing/${listing.id}`);
    } catch (e) {
      const err = e as ApiError;
      setBanner(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const summary = useMemo(() => ({
    photos: photos.length,
    video: !!video,
    voice: !!voice,
  }), [photos.length, video, voice]);

  return (
    <Screen>
      <Heading eyebrow={`Step ${step + 1} of ${STEPS.length}`} title="New listing" subtitle="Three quick steps. You review everything before it goes to Etsy." />
      <View style={{ marginBottom: space.lg }}>
        <Stepper steps={STEPS} current={step} />
      </View>

      {banner ? <View style={{ marginBottom: space.md }}><Banner tone="error" text={banner} /></View> : null}

      {step === 0 ? (
        <View style={{ gap: space.md }}>
          <Card>
            <CardHeader
              icon="images-outline"
              title="Product photos"
              subtitle="Plain backgrounds and daylight work best. The first photo is your cover."
              right={<Text style={styles.count}>{photos.length}/{MAX_PHOTOS}</Text>}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {photos.map((p, i) => (
                <View key={p.id} style={{ width: '31%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface3 }}>
                  <Image source={{ uri: p.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityLabel={`Photo ${i + 1}`} />
                  {i === 0 ? (
                    <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.ink }}>Cover</Text>
                    </View>
                  ) : null}
                  <View style={{ position: 'absolute', bottom: 6, left: 6, right: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Pressable onPress={() => movePhoto(i, -1)} disabled={i === 0} accessibilityLabel={`Move photo ${i + 1} left`} style={chipBtn(i === 0)}>
                      <Ionicons name="chevron-back" size={16} color={colors.ink} />
                    </Pressable>
                    <Pressable onPress={() => setPhotos((p) => p.filter((x) => x.id !== p[i].id))} accessibilityLabel={`Remove photo ${i + 1}`} style={chipBtn(false)}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </Pressable>
                    <Pressable onPress={() => movePhoto(i, 1)} disabled={i === photos.length - 1} accessibilityLabel={`Move photo ${i + 1} right`} style={chipBtn(i === photos.length - 1)}>
                      <Ionicons name="chevron-forward" size={16} color={colors.ink} />
                    </Pressable>
                  </View>
                </View>
              ))}
              {photos.length < MAX_PHOTOS ? (
                <Pressable
                  onPress={addPhotos}
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

          <Card>
            <CardHeader icon="videocam-outline" title="Product video" subtitle="A 10 to 30 second clip from every angle. We analyse three frames from it." right={<Text style={styles.optional}>Optional</Text>} />
            {video ? (
              <Row style={{ justifyContent: 'space-between', backgroundColor: colors.surface2, padding: 12, borderRadius: radius.md }}>
                <Row style={{ flex: 1 }}>
                  <Ionicons name="videocam-outline" size={20} color={colors.accentDark} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: colors.ink }} numberOfLines={1}>{video.name}</Text>
                    <Text style={font.small}>{video.durationMs ? formatDuration(video.durationMs) : 'Ready to upload'}</Text>
                  </View>
                </Row>
                <Button title="Remove" variant="ghost" onPress={() => setVideo(null)} style={{ minHeight: 36 }} />
              </Row>
            ) : (
              <View style={{ gap: space.sm }}>
                <Button title="Record with camera" variant="secondary" icon="camera-outline" onPress={recordVideo} full />
                <Button title="Upload from gallery" variant="secondary" icon="cloud-upload-outline" onPress={addVideo} full />
              </View>
            )}
          </Card>

          <Card>
            <CardHeader icon="mic-outline" title="Voice note" subtitle="Say the materials, size or story behind the piece. We transcribe it and use the facts in your listing." right={<Text style={styles.optional}>Optional</Text>} />
            {recState.isRecording ? (
              <Row style={{ justifyContent: 'space-between', backgroundColor: colors.danger50, padding: 14, borderRadius: radius.md }}>
                <Row>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.danger }} />
                  <Text style={{ fontWeight: '600', color: '#A8322A', fontVariant: ['tabular-nums'] }}>
                    Recording {formatDuration(recState.durationMillis)}
                  </Text>
                </Row>
                <Button title="Stop" variant="primary" icon="stop" onPress={stopRecording} style={{ minHeight: 38, paddingHorizontal: 14 }} />
              </Row>
            ) : voice ? (
              <Row style={{ justifyContent: 'space-between', backgroundColor: colors.ok50, padding: 12, borderRadius: radius.md }}>
                <Row>
                  <Ionicons name="mic-outline" size={20} color="#176B47" />
                  <Text style={{ fontWeight: '600', color: '#176B47' }}>Voice note ready · {voice.durationMs ? formatDuration(voice.durationMs) : ''}</Text>
                </Row>
                <Row>
                  <Button title="Re-record" variant="ghost" onPress={startRecording} style={{ minHeight: 36 }} />
                  <Button title="Remove" variant="ghost" onPress={() => setVoice(null)} style={{ minHeight: 36 }} />
                </Row>
              </Row>
            ) : (
              <Button title="Record a voice note" variant="secondary" icon="mic-outline" onPress={startRecording} full />
            )}
          </Card>

          {!hasMedia ? <Text style={[font.small, { textAlign: 'center' }]}>Add at least one photo or a video to continue.</Text> : null}
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: space.md }}>
          {notice ? <Banner tone={notice.tone} text={notice.text} /> : null}
          <Card>
            <CardHeader icon="cube-outline" title="The basics" />
            <Field label="Product name" value={details.name} onChangeText={(v) => set('name', v)} placeholder="e.g. Sage Ceramic Mug" maxLength={140} counter={{ length: details.name.length, max: 140 }} error={errors.name} />
            <Field label="Product type" value={details.type} onChangeText={(v) => set('type', v)} placeholder="e.g. Mug" error={errors.type} hint={`Suggestions: ${PRODUCT_TYPES.slice(0, 6).join(', ')}…`} />
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Field label="Price (USD)" value={details.price} onChangeText={(v) => set('price', v)} placeholder="24.00" keyboardType="decimal-pad" error={errors.price} hint="Blank lets the AI suggest one." />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Quantity" value={details.quantity} onChangeText={(v) => set('quantity', v)} keyboardType="numeric" error={errors.quantity} />
              </View>
            </Row>
          </Card>

          <Card>
            <CardHeader icon="color-palette-outline" title="Details" subtitle="Only what you know. Velista never invents materials or sizes." />
            <Field label="Materials" value={details.materials} onChangeText={(v) => set('materials', v)} placeholder="e.g. Stoneware, glaze" />
            <Field label="Colors" value={details.colors} onChangeText={(v) => set('colors', v)} placeholder="e.g. Sage green, cream" />
            <Field label="Dimensions" value={details.dimensions} onChangeText={(v) => set('dimensions', v)} placeholder="e.g. 10 cm tall, 350 ml" maxLength={160} />
            <Field label="Brand" value={details.brand} onChangeText={(v) => set('brand', v)} placeholder="Your shop or brand" maxLength={80} hint="Only add it if it is your brand name." />
          </Card>

          <Card>
            <CardHeader icon="chatbubble-ellipses-outline" title="Listing voice" />
            <ChipInput label="Keywords" values={details.keywords} onChange={(v) => set('keywords', v)} placeholder="Type a keyword, then Enter" maxCount={30} hint="Words buyers search for, such as “boho wall art”." />
            <View style={{ gap: 6 }}>
              <Text style={font.label}>Tone</Text>
              <Segmented<Tone> value={details.tone} onChange={(v) => set('tone', v)} options={TONES as { value: Tone; label: string }[]} />
            </View>
            <Select label="Language" value={details.language} onChange={(v) => set('language', v)} options={LANGUAGES.map((l) => ({ value: l, label: l }))} />
            <Field label="Who is it for?" value={details.audience} onChangeText={(v) => set('audience', v)} placeholder="e.g. New homeowners, coffee lovers" maxLength={160} />
            <Field label="Anything else?" value={details.notes} onChangeText={(v) => set('notes', v)} placeholder="Care instructions, what is included, the story behind it" multiline maxLength={1000} counter={{ length: details.notes.length, max: 1000 }} />
          </Card>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: space.md }}>
          <Card>
            <CardHeader
              icon="images-outline"
              title="Media"
              subtitle={`${summary.photos} photo${summary.photos === 1 ? '' : 's'}${summary.video ? ' · 1 video' : ''}${summary.voice ? ' · 1 voice note' : ''}`}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {photos.map((p) => <RNImage key={p.id} source={{ uri: p.uri }} style={{ width: 76, height: 76, borderRadius: radius.md }} />)}
            </ScrollView>
          </Card>
          <Card>
            <CardHeader icon="cube-outline" title="Product" />
            {[
              ['Name', details.name],
              ['Type', details.type],
              ['Price', details.price.trim() ? `$${Number(details.price).toFixed(2)}` : 'AI suggested'],
              ['Quantity', details.quantity],
              ['Materials', details.materials],
              ['Colors', details.colors],
              ['Keywords', details.keywords.join(', ')],
              ['Tone', TONES.find((t) => t.value === details.tone)?.label ?? details.tone],
              ['Language', details.language],
            ].filter(([, v]) => v).map(([k, v]) => <KeyValueRow key={k} label={k} value={v} />)}
          </Card>
          <Banner tone="info" text="Velista writes the title, description, tags, category, alt text and a suggested price. Nothing goes to Etsy until you review and publish it." />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: space.xl }}>
        {step > 0 ? <Button title="Back" variant="secondary" icon="arrow-back" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
        {step < 2 ? (
          <Button
            title={step === 0 ? (analyzing ? 'Reading your photos…' : 'Continue') : 'Review'}
            icon="arrow-forward"
            onPress={next}
            loading={analyzing}
            style={{ flex: 1.4 }}
          />
        ) : (
          <Button title="Generate listing" icon="sparkles" onPress={generate} loading={uploading} style={{ flex: 1.4 }} />
        )}
      </View>
    </Screen>
  );
}

const styles = {
  count: { fontSize: 13, fontWeight: '700' as const, color: colors.ink2, fontVariant: ['tabular-nums' as const] },
  optional: { fontSize: 12, fontWeight: '600' as const, color: colors.muted, backgroundColor: colors.surface3, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' as const },
};

const chipBtn = (disabled: boolean) => ({
  width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.94)',
  alignItems: 'center' as const, justifyContent: 'center' as const, opacity: disabled ? 0.35 : 1,
});
