import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { timeAgo } from '@/lib/format';
import type { Haul, HaulStatus } from '@/lib/types';
import { IconButton, Pill, type Tone } from '@/components/ui';
import { colors, font, radius, shadow } from '@/theme';

const STATUS: Record<HaulStatus, { label: string; tone: Tone }> = {
  uploading: { label: 'Not uploaded', tone: 'warning' },
  queued: { label: 'Waiting', tone: 'info' },
  processing: { label: 'Working', tone: 'info' },
  review: { label: 'Ready to review', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
};

function detail(haul: Haul) {
  if (haul.status === 'failed') return haul.error ?? 'Something went wrong with this video.';
  if (haul.status === 'review') return `${haul.itemCount} item${haul.itemCount === 1 ? '' : 's'} found`;
  if (haul.status === 'uploading') return 'This video did not finish uploading.';
  return haul.step ?? 'Waiting to start';
}

// One filmed haul. Opens its drafts once they are ready.
export function HaulCard({ haul, onOpen, onDelete }: { haul: Haul; onOpen: () => void; onDelete: () => void }) {
  const ready = haul.status === 'review';
  const working = haul.status === 'queued' || haul.status === 'processing';
  const { label, tone } = STATUS[haul.status];
  return (
    <Pressable
      onPress={ready ? onOpen : undefined}
      disabled={!ready}
      accessibilityRole="button"
      accessibilityLabel={`Haul, ${label}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.icon}>
        {working ? <ActivityIndicator color={colors.accent} /> : <Ionicons name="videocam" size={22} color={colors.accent} />}
      </View>
      <View style={styles.body}>
        <View style={styles.top}>
          <Pill label={label} tone={tone} />
          <Text style={font.small}>{timeAgo(haul.createdAt)}</Text>
        </View>
        <Text style={styles.detail}>{detail(haul)}</Text>
      </View>
      {working ? null : <IconButton icon="trash-outline" label="Delete haul" tone="danger" onPress={onDelete} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg,
    backgroundColor: colors.surface, ...shadow,
  },
  icon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent50, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  detail: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
});
