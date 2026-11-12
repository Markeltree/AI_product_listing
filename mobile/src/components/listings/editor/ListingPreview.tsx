import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { money } from "@/lib/format";
import { Card, Row } from "@/components/ui";
import { colors, font, radius } from "@/theme";
import { ListingImage } from "../ListingImage";

// Roughly how the listing will look on Etsy: cover photo, price, title and shop.
export function ListingPreview({
  listingId,
  coverId,
  price,
  title,
  shopName,
  isSupply,
}: {
  listingId: string;
  coverId?: string | null;
  price: number | null;
  title: string;
  shopName?: string | null;
  isSupply: boolean;
}) {
  return (
    <Card style={{ padding: 12, gap: 10 }}>
      <Text style={[font.overline, { marginLeft: 2 }]}>Etsy preview</Text>
      <Row style={{ gap: 14, alignItems: "flex-start" }}>
        <ListingImage
          listingId={listingId}
          mediaId={coverId}
          iconSize={30}
          style={{ width: 112, height: 112, borderRadius: radius.md }}
        />
        <View style={{ flex: 1, gap: 5, paddingTop: 2 }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "800",
              color: colors.ink,
              letterSpacing: -0.3,
            }}
          >
            {price != null ? money(price) : "Price"}
          </Text>
          <Text
            style={{ fontSize: 14, color: colors.ink2, lineHeight: 19 }}
            numberOfLines={3}
          >
            {title || "Your title appears here"}
          </Text>
          <Row style={{ gap: 5 }}>
            <Ionicons
              name="storefront-outline"
              size={13}
              color={colors.muted}
            />
            <Text style={font.small} numberOfLines={1}>
              {shopName ?? "Your shop"}
              {isSupply ? " · Supplies" : ""}
            </Text>
          </Row>
        </View>
      </Row>
    </Card>
  );
}
