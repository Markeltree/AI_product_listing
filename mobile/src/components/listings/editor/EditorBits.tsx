import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { timeAgo } from "@/lib/format";
import { Button, Row, StatusBadge } from "@/components/ui";
import { colors, font, shadow, space } from "@/theme";

// Status pill plus "Unsaved changes" / "Saved 2 min ago".
export function SaveStatus({
  status,
  dirty,
  updatedAt,
}: {
  status: string;
  dirty: boolean;
  updatedAt: string;
}) {
  return (
    <Row style={{ justifyContent: "space-between" }}>
      <StatusBadge status={status} />
      <Row style={{ gap: 6 }}>
        <View
          style={[
            styles.dot,
            { backgroundColor: dirty ? colors.warn : colors.ok },
          ]}
        />
        <Text
          style={[
            font.small,
            { fontWeight: "600", color: dirty ? colors.warn : colors.muted },
          ]}
        >
          {dirty ? "Unsaved changes" : `Saved ${timeAgo(updatedAt)}`}
        </Text>
      </Row>
    </Row>
  );
}

// Fixed bar at the bottom of the editor: save, save draft to Etsy, publish.
export function EditorActionBar({
  dirty,
  busy,
  onSave,
  onSaveDraft,
  onPublish,
}: {
  dirty: boolean;
  busy: string | null;
  onSave: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}) {
  return (
    <View style={styles.bar}>
      <Row>
        <Button
          title="Save"
          variant="secondary"
          icon="save-outline"
          onPress={onSave}
          loading={busy === "save"}
          disabled={!dirty || !!busy}
          style={{ flex: 1 }}
        />
        <Button
          title="Save draft"
          variant="secondary"
          icon="cloud-upload-outline"
          onPress={onSaveDraft}
          loading={busy === "draft"}
          disabled={!!busy}
          style={{ flex: 1.2 }}
        />
      </Row>
      <Button
        title="Publish to Etsy"
        icon="send"
        onPress={onPublish}
        loading={busy === "active"}
        disabled={!!busy}
        full
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 7, height: 7, borderRadius: 4 },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 10,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    ...shadow,
    shadowOffset: { width: 0, height: -4 },
  },
});
