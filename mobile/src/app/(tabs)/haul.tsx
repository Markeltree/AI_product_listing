import React from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  launchCameraAsync, launchImageLibraryAsync, requestCameraPermissionsAsync, type ImagePickerAsset,
} from 'expo-image-picker';
import { File } from 'expo-file-system';
import { HaulCard } from '@/components/hauls/HaulCard';
import {
  Banner, Button, Card, CardHeader, Empty, Heading, Screen,
} from '@/components/ui';
import { useHauls } from '@/hooks/useHauls';
import { font, space } from '@/theme';

const MAX_SECONDS = 180;

const sizeOf = (asset: ImagePickerAsset) => asset.fileSize ?? (Platform.OS === 'web' ? 1 : new File(asset.uri).size);

export default function HaulScreen() {
  const router = useRouter();
  const {
    hauls, error, uploading, upload, remove,
  } = useHauls();

  const send = (asset: ImagePickerAsset) => upload({ uri: asset.uri, mime: asset.mimeType ?? 'video/mp4', size: sizeOf(asset) });

  const record = async () => {
    const permission = await requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera blocked', 'Allow camera access in Settings, or choose a video from your gallery.');
      return;
    }
    const result = await launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: MAX_SECONDS });
    if (!result.canceled) await send(result.assets[0]);
  };

  const choose = async () => {
    const result = await launchImageLibraryAsync({ mediaTypes: ['videos'] });
    if (!result.canceled) await send(result.assets[0]);
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Delete this haul?', 'Listings already made from it stay in your Listings tab.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(id) },
    ]);
  };

  return (
    <Screen>
      <Heading eyebrow="One video, many listings" title="Film a haul" subtitle="Show each item for a few seconds. We find every product and write a draft for each one." />

      <View style={{ gap: space.md, marginTop: space.lg }}>
        {error ? <Banner tone="error" text={error} /> : null}

        <Card>
          <CardHeader icon="videocam-outline" title="New haul" subtitle="Up to 3 minutes. Hold each item steady in good light, one at a time." />
          <View style={{ gap: space.sm }}>
            <Button title={uploading ? 'Uploading your video…' : 'Record a haul'} icon="videocam" onPress={record} loading={uploading} full />
            <Button title="Choose from gallery" variant="secondary" icon="images-outline" onPress={choose} disabled={uploading} full />
          </View>
        </Card>

        {hauls?.length ? <Text style={[font.h2, { marginTop: space.sm }]}>Your hauls</Text> : null}
        {hauls?.map((haul) => (
          <HaulCard
            key={haul.id}
            haul={haul}
            onOpen={() => router.push({ pathname: '/haul/[id]', params: { id: haul.id } })}
            onDelete={() => confirmDelete(haul.id)}
          />
        ))}
        {hauls && !hauls.length ? (
          <Empty icon="videocam-outline" title="No hauls yet" text="Your filmed hauls and their drafts will show up here." />
        ) : null}
      </View>
    </Screen>
  );
}
