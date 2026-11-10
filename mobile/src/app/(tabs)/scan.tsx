import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  launchCameraAsync, launchImageLibraryAsync, requestCameraPermissionsAsync, type ImagePickerAsset,
} from 'expo-image-picker';
import {
  Banner, Button, Card, CardHeader, Heading, Screen,
} from '@/components/ui';
import { api, appendFile } from '@/lib/api';
import type { Listing } from '@/lib/types';
import { space } from '@/theme';

const MAX_SECONDS = 30;

// One video of a product. The server reads it and the listing opens as soon as it is uploaded.
export default function ScanScreen() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (asset: ImagePickerAsset) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      await appendFile(form, 'video', { uri: asset.uri, name: asset.fileName ?? 'scan.mp4', type: asset.mimeType ?? 'video/mp4' });
      const { listing } = await api<{ listing: Listing }>('/api/listings/scan', { method: 'POST', form });
      router.push({ pathname: '/listing/[id]', params: { id: listing.id } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const openCamera = async () => {
    const permission = await requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera blocked', 'Allow camera access in Settings, or choose a video from your gallery.');
      return;
    }
    const result = await launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: MAX_SECONDS });
    if (!result.canceled) await send(result.assets[0]);
  };

  const openGallery = async () => {
    const result = await launchImageLibraryAsync({ mediaTypes: ['videos'] });
    if (!result.canceled) await send(result.assets[0]);
  };

  return (
    <Screen>
      <Heading eyebrow="Video to listing" title="Scan a product" subtitle="Film your product and we write the listing for you." />

      <View style={{ gap: space.md, marginTop: space.lg }}>
        {error ? <Banner tone="error" text={error} /> : null}
        <Card>
          <CardHeader icon="scan-outline" title="Film one product" subtitle="Move slowly around it for 10 to 30 seconds, in good light." />
          <View style={{ gap: space.sm }}>
            <Button title={uploading ? 'Uploading your video…' : 'Open camera'} icon="camera" onPress={openCamera} loading={uploading} full />
            <Button title="Choose from gallery" variant="secondary" icon="images-outline" onPress={openGallery} disabled={uploading} full />
          </View>
        </Card>
      </View>
    </Screen>
  );
}
