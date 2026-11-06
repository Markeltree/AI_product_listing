import React from "react";
import { Text, View } from "react-native";
import { LANGUAGES, PRODUCT_TYPES, TONES } from "@/lib/rules";
import type { Tone } from "@/lib/types";
import {
  Card,
  CardHeader,
  ChipInput,
  Field,
  Row,
  Segmented,
  Select,
} from "@/components/ui";
import { font, space } from "@/theme";
import type { ListingDetails } from "./types";

type SetField = <K extends keyof ListingDetails>(
  key: K,
  value: ListingDetails[K],
) => void;

// Step 2 of a new listing: the facts the seller knows, and how the listing should sound.
export function DetailsForm({
  details,
  set,
  errors,
}: {
  details: ListingDetails;
  set: SetField;
  errors: Record<string, string>;
}) {
  return (
    <View style={{ gap: space.md }}>
      <Card>
        <CardHeader icon="cube-outline" title="The basics" />
        <Field
          label="Product name"
          value={details.name}
          onChangeText={(v) => set("name", v)}
          placeholder="e.g. Sage Ceramic Mug"
          maxLength={140}
          counter={{ length: details.name.length, max: 140 }}
          error={errors.name}
        />
        <Field
          label="Product type"
          value={details.type}
          onChangeText={(v) => set("type", v)}
          placeholder="e.g. Mug"
          error={errors.type}
          hint={`Suggestions: ${PRODUCT_TYPES.slice(0, 6).join(", ")}…`}
        />
        <Row style={{ alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Price (USD)"
              value={details.price}
              onChangeText={(v) => set("price", v)}
              placeholder="24.00"
              keyboardType="decimal-pad"
              error={errors.price}
              hint="Blank lets the AI suggest one."
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Quantity"
              value={details.quantity}
              onChangeText={(v) => set("quantity", v)}
              keyboardType="numeric"
              error={errors.quantity}
            />
          </View>
        </Row>
      </Card>

      <Card>
        <CardHeader
          icon="color-palette-outline"
          title="Details"
          subtitle="Only what you know. Velista never invents materials or sizes."
        />
        <Field
          label="Materials"
          value={details.materials}
          onChangeText={(v) => set("materials", v)}
          placeholder="e.g. Stoneware, glaze"
        />
        <Field
          label="Colors"
          value={details.colors}
          onChangeText={(v) => set("colors", v)}
          placeholder="e.g. Sage green, cream"
        />
        <Field
          label="Dimensions"
          value={details.dimensions}
          onChangeText={(v) => set("dimensions", v)}
          placeholder="e.g. 10 cm tall, 350 ml"
          maxLength={160}
        />
        <Field
          label="Brand"
          value={details.brand}
          onChangeText={(v) => set("brand", v)}
          placeholder="Your shop or brand"
          maxLength={80}
          hint="Only add it if it is your brand name."
        />
      </Card>

      <Card>
        <CardHeader icon="chatbubble-ellipses-outline" title="Listing voice" />
        <ChipInput
          label="Keywords"
          values={details.keywords}
          onChange={(v) => set("keywords", v)}
          placeholder="Type a keyword, then Enter"
          maxCount={30}
          hint="Words buyers search for, such as “boho wall art”."
        />
        <View style={{ gap: 6 }}>
          <Text style={font.label}>Tone</Text>
          <Segmented<Tone>
            value={details.tone}
            onChange={(v) => set("tone", v)}
            options={TONES as { value: Tone; label: string }[]}
          />
        </View>
        <Select
          label="Language"
          value={details.language}
          onChange={(v) => set("language", v)}
          options={LANGUAGES.map((l) => ({ value: l, label: l }))}
        />
        <Field
          label="Who is it for?"
          value={details.audience}
          onChangeText={(v) => set("audience", v)}
          placeholder="e.g. New homeowners, coffee lovers"
          maxLength={160}
        />
        <Field
          label="Anything else?"
          value={details.notes}
          onChangeText={(v) => set("notes", v)}
          placeholder="Care instructions, what is included, the story behind it"
          multiline
          maxLength={1000}
          counter={{ length: details.notes.length, max: 1000 }}
        />
      </Card>
    </View>
  );
}
