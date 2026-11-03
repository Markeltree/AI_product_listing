import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState,
} from 'expo-audio';
import { launchCameraAsync, launchImageLibraryAsync, requestCameraPermissionsAsync, type ImagePickerAsset } from 'expo-image-picker';
import { api, ApiError, appendFile, appendFiles } from '@/lib/api';
import { preparePhoto } from '@/lib/images';
import { useAuth } from '@/lib/auth';
import { MAX_PHOTOS, MAX_QUANTITY, MIN_PRICE } from '@/lib/rules';
import type { Listing, ProductSuggestions } from '@/lib/types';
import {
  Banner, Button, Heading, Screen, Stepper,
} from '@/components/ui';
import { DetailsForm } from '@/components/listings/create/DetailsForm';
import { PhotoPickerCard, VideoCard, VoiceNoteCard } from '@/components/listings/create/MediaCards';
import { ReviewSummary } from '@/components/listings/create/ReviewSummary';
import type { ListingDetails, PickedClip, PickedPhoto } from '@/components/listings/create/types';
import { font, space } from '@/theme';

type Photo = PickedPhoto;
type Clip = PickedClip;
type Details = ListingDetails;

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

  return (
    <Screen>
      <Heading eyebrow={`Step ${step + 1} of ${STEPS.length}`} title="New listing" subtitle="Three quick steps. You review everything before it goes to Etsy." />
      <View style={{ marginBottom: space.lg }}>
        <Stepper steps={STEPS} current={step} />
      </View>

      {banner ? <View style={{ marginBottom: space.md }}><Banner tone="error" text={banner} /></View> : null}

      {step === 0 ? (
        <View style={{ gap: space.md }}>
          <PhotoPickerCard
            photos={photos}
            onAdd={addPhotos}
            onMove={movePhoto}
            onRemove={(photoId) => setPhotos((list) => list.filter((x) => x.id !== photoId))}
          />
          <VideoCard video={video} onRecord={recordVideo} onUpload={addVideo} onRemove={() => setVideo(null)} />
          <VoiceNoteCard
            recording={recState.isRecording}
            recordingMs={recState.durationMillis}
            voice={voice}
            onStart={startRecording}
            onStop={stopRecording}
            onRemove={() => setVoice(null)}
          />
          {!hasMedia ? <Text style={[font.small, { textAlign: 'center' }]}>Add at least one photo or a video to continue.</Text> : null}
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: space.md }}>
          {notice ? <Banner tone={notice.tone} text={notice.text} /> : null}
          <DetailsForm details={details} set={set} errors={errors} />
        </View>
      ) : null}

      {step === 2 ? <ReviewSummary photos={photos} hasVideo={!!video} hasVoice={!!voice} details={details} /> : null}

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
