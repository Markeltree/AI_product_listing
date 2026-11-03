import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { mediaUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors } from '@/theme';

// A listing photo from the API (sends the sign-in token), or a placeholder when there is none.
export function ListingImage({ listingId, mediaId, style, iconSize = 26, transition = 200 }: {
  listingId: string; mediaId: string | null | undefined; style?: StyleProp<ViewStyle>; iconSize?: number; transition?: number;
}) {
  const { token } = useAuth();
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: colors.surface3 }, style]}>
      {mediaId ? (
        <Image
          source={{ uri: mediaUrl(listingId, mediaId), headers: token ? { Authorization: `Bearer ${token}` } : undefined }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={transition}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="image-outline" size={iconSize} color={colors.muted} />
        </View>
      )}
    </View>
  );
}
