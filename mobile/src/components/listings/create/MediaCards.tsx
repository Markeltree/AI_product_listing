import React from 'react';
import {
  Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { formatDuration } from '@/lib/format';
import { MAX_PHOTOS } from '@/lib/rules';
import {
  Button, Card, CardHeader, Pill, Row,
} from '@/components/ui';
import { colors, font, radius, space } from '@/theme';
import type { PickedClip, PickedPhoto } from './types';

function TileAction({ icon, label, onPress, disabled = false, danger = false }: {
  icon: 'chevron-back' | 'chevron-forward' | 'trash-outline'; label: string; onPress: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={label} style={[styles.tileAction, disabled && { opacity: 0.35 }]}>
      <Ionicons name={icon} size={16} color={danger ? colors.danger : colors.ink} />
    </Pressable>
  );
}

// Grid of picked photos (cover first) with move/remove, plus an "Add photos" tile.
export function PhotoPickerCard({ photos, onAdd, onMove, onRemove }: {
  photos: PickedPhoto[]; onAdd: () => void; onMove: (index: number, dir: -1 | 1) => void; onRemove: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader
        icon="images-outline"
        title="Product photos"
        subtitle="Plain backgrounds and daylight work best. The first photo is your cover."
        right={<Text style={styles.count}>{photos.length}/{MAX_PHOTOS}</Text>}
      />
      <View style={styles.grid}>
        {photos.map((p, i) => (
          <View key={p.id} style={styles.tile}>
            <Image source={{ uri: p.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityLabel={`Photo ${i + 1}`} />
            {i === 0 ? <View style={styles.cover}><Text style={styles.coverText}>Cover</Text></View> : null}
            <View style={styles.tileActions}>
              <TileAction icon="chevron-back" label={`Move photo ${i + 1} left`} onPress={() => onMove(i, -1)} disabled={i === 0} />
              <TileAction icon="trash-outline" label={`Remove photo ${i + 1}`} onPress={() => onRemove(p.id)} danger />
              <TileAction icon="chevron-forward" label={`Move photo ${i + 1} right`} onPress={() => onMove(i, 1)} disabled={i === photos.length - 1} />
            </View>
          </View>
        ))}
        {photos.length < MAX_PHOTOS ? (
          <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add photos" style={[styles.tile, styles.addTile]}>
            <View style={styles.addIcon}><Ionicons name="add" size={22} color={colors.accent} /></View>
            <Text style={styles.addText}>Add photos</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

// Optional product video: record with the camera or pick from the gallery.
export function VideoCard({ video, onRecord, onUpload, onRemove }: {
  video: PickedClip | null; onRecord: () => void; onUpload: () => void; onRemove: () => void;
}) {
  return (
    <Card>
      <CardHeader
        icon="videocam-outline"
        title="Product video"
        subtitle="A 10 to 30 second clip from every angle. We analyse three frames from it."
        right={<Pill label="Optional" />}
      />
      {video ? (
        <Row style={[styles.status, { backgroundColor: colors.surface2 }]}>
          <Row style={{ flex: 1 }}>
            <Ionicons name="videocam-outline" size={20} color={colors.accentDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle} numberOfLines={1}>{video.name}</Text>
              <Text style={font.small}>{video.durationMs ? formatDuration(video.durationMs) : 'Ready to upload'}</Text>
            </View>
          </Row>
          <Button title="Remove" variant="ghost" onPress={onRemove} style={{ minHeight: 36 }} />
        </Row>
      ) : (
        <View style={{ gap: space.sm }}>
          <Button title="Record with camera" variant="secondary" icon="camera-outline" onPress={onRecord} full />
          <Button title="Upload from gallery" variant="secondary" icon="cloud-upload-outline" onPress={onUpload} full />
        </View>
      )}
    </Card>
  );
}

// Optional voice note: record, stop, re-record or remove.
export function VoiceNoteCard({ recording, recordingMs, voice, onStart, onStop, onRemove }: {
  recording: boolean; recordingMs: number; voice: PickedClip | null;
  onStart: () => void; onStop: () => void; onRemove: () => void;
}) {
  return (
    <Card>
      <CardHeader
        icon="mic-outline"
        title="Voice note"
        subtitle="Say the materials, size or story behind the piece. We transcribe it and use the facts in your listing."
        right={<Pill label="Optional" />}
      />
      {recording ? (
        <Row style={[styles.status, { backgroundColor: colors.danger50, padding: 14 }]}>
          <Row>
            <View style={styles.recDot} />
            <Text style={styles.recText}>Recording {formatDuration(recordingMs)}</Text>
          </Row>
          <Button title="Stop" icon="stop" onPress={onStop} style={{ minHeight: 38, paddingHorizontal: 14 }} />
        </Row>
      ) : voice ? (
        <Row style={[styles.status, { backgroundColor: colors.ok50 }]}>
          <Row>
            <Ionicons name="mic-outline" size={20} color={colors.okDark} />
            <Text style={{ fontWeight: '600', color: colors.okDark }}>Voice note ready · {voice.durationMs ? formatDuration(voice.durationMs) : ''}</Text>
          </Row>
          <Row>
            <Button title="Re-record" variant="ghost" onPress={onStart} style={{ minHeight: 36 }} />
            <Button title="Remove" variant="ghost" onPress={onRemove} style={{ minHeight: 36 }} />
          </Row>
        </Row>
      ) : (
        <Button title="Record a voice note" variant="secondary" icon="mic-outline" onPress={onStart} full />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  count: { fontSize: 13, fontWeight: '700', color: colors.ink2, fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '31%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface3 },
  cover: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  coverText: { fontSize: 11, fontWeight: '600', color: colors.ink },
  tileActions: { position: 'absolute', bottom: 6, left: 6, right: 6, flexDirection: 'row', justifyContent: 'space-between' },
  tileAction: { width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center' },
  addTile: {
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accent100, alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: colors.accent50,
  },
  addIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 12, fontWeight: '600', color: colors.ink2 },
  status: { justifyContent: 'space-between', padding: 12, borderRadius: radius.md },
  statusTitle: { fontWeight: '600', color: colors.ink },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.danger },
  recText: { fontWeight: '600', color: colors.dangerDark, fontVariant: ['tabular-nums'] },
});
