import React from "react";
import { ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { TONES } from "@/lib/rules";
import { Banner, Card, CardHeader, KeyValueRow } from "@/components/ui";
import { radius, space } from "@/theme";
import type { ListingDetails, PickedPhoto } from "./types";

// Step 3 of a new listing: what will be sent, before the AI writes the listing.
export function ReviewSummary({
  photos,
  hasVideo,
  hasVoice,
  details,
}: {
  photos: PickedPhoto[];
  hasVideo: boolean;
  hasVoice: boolean;
  details: ListingDetails;
}) {
  const rows: [string, string][] = [
    ["Name", details.name],
    ["Type", details.type],
    [
      "Price",
      details.price.trim()
        ? `$${Number(details.price).toFixed(2)}`
        : "AI suggested",
    ],
    ["Quantity", details.quantity],
    ["Materials", details.materials],
    ["Colors", details.colors],
    ["Keywords", details.keywords.join(", ")],
    [
      "Tone",
      TONES.find((t) => t.value === details.tone)?.label ?? details.tone,
    ],
    ["Language", details.language],
  ];
  const media = `${photos.length} photo${photos.length === 1 ? "" : "s"}${hasVideo ? " · 1 video" : ""}${hasVoice ? " · 1 voice note" : ""}`;
  return (
    <View style={{ gap: space.md }}>
      <Card>
        <CardHeader icon="images-outline" title="Media" subtitle={media} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {photos.map((p) => (
            <Image
              key={p.id}
              source={{ uri: p.uri }}
              style={{ width: 76, height: 76, borderRadius: radius.md }}
              contentFit="cover"
            />
          ))}
        </ScrollView>
      </Card>
      <Card>
        <CardHeader icon="cube-outline" title="Product" />
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <KeyValueRow key={k} label={k} value={v} />
          ))}
      </Card>
      <Banner
        tone="info"
        text="Velista writes the title, description, tags, category, alt text and a suggested price. Nothing goes to Etsy until you review and publish it."
      />
    </View>
  );
}
