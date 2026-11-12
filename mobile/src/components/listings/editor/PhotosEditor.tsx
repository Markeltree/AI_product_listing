import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MAX_PHOTOS } from "@/lib/rules";
import type { Media } from "@/lib/types";
import { Button, Card, CardHeader, Row } from "@/components/ui";
import { colors, font, radius } from "@/theme";
import { ListingImage } from "../ListingImage";

function RowAction({
  icon,
  label,
  onPress,
  disabled = false,
  danger = false,
}: {
  icon: "arrow-up" | "arrow-down" | "trash-outline";
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={[styles.action, disabled && { opacity: 0.35 }]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={danger ? colors.danger : colors.ink2}
      />
    </Pressable>
  );
}

// Photo list with alt text, reordering and removal. `media` also lists video/voice used for analysis.
export function PhotosEditor({
  listingId,
  media,
  altTexts,
  onAltChange,
  onMove,
  onRemove,
  onAdd,
  adding,
}: {
  listingId: string;
  media: Media[];
  altTexts: string[];
  onAltChange: (index: number, text: string) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (media: Media, index: number) => void;
  onAdd: () => void;
  adding: boolean;
}) {
  const images = media.filter((m) => m.kind === "image");
  const extras = media.filter((m) => m.kind !== "image");
  return (
    <Card>
      <CardHeader
        icon="images-outline"
        title="Photos"
        subtitle="The first photo is your cover. Alt text helps screen readers and search."
        right={
          <Text style={styles.count}>
            {images.length}/{MAX_PHOTOS}
          </Text>
        }
      />
      {images.map((m, i) => (
        <View key={m.id} style={styles.item}>
          <ListingImage
            listingId={listingId}
            mediaId={m.id}
            transition={0}
            style={styles.thumb}
          />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={font.label}>
              {i === 0 ? "Cover · " : ""}Alt text for photo {i + 1}
            </Text>
            <TextInput
              value={altTexts[i] ?? ""}
              onChangeText={(t) => onAltChange(i, t)}
              placeholder="Describe what the photo shows"
              placeholderTextColor={colors.placeholder}
              maxLength={250}
              accessibilityLabel={`Alt text for photo ${i + 1}`}
              style={styles.alt}
            />
            <Row>
              <RowAction
                icon="arrow-up"
                label={`Move photo ${i + 1} up`}
                onPress={() => onMove(i, -1)}
                disabled={i === 0}
              />
              <RowAction
                icon="arrow-down"
                label={`Move photo ${i + 1} down`}
                onPress={() => onMove(i, 1)}
                disabled={i === images.length - 1}
              />
              <RowAction
                icon="trash-outline"
                label={`Remove photo ${i + 1}`}
                onPress={() => onRemove(m, i)}
                danger
              />
            </Row>
          </View>
        </View>
      ))}
      {images.length === 0 ? (
        <Text style={[font.small, { color: colors.warn }]}>
          Add at least one photo before publishing.
        </Text>
      ) : null}
      {extras.length ? (
        <Text style={font.small}>
          Used for analysis:{" "}
          {extras
            .map((m) => (m.kind === "video" ? "video" : "voice note"))
            .join(", ")}
        </Text>
      ) : null}
      <Button
        title="Add photos"
        variant="secondary"
        icon="add"
        onPress={onAdd}
        loading={adding}
        disabled={images.length >= MAX_PHOTOS}
        full
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  count: { fontSize: 13, fontWeight: "700", color: colors.ink2 },
  item: {
    flexDirection: "row",
    gap: 12,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  alt: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.ink,
  },
  action: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
});
