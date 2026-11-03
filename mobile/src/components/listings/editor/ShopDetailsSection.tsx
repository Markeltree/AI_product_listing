import React from 'react';
import { View } from 'react-native';
import { WHEN_MADE, WHO_MADE } from '@/lib/rules';
import type { Product, ShippingProfile } from '@/lib/types';
import {
  Banner, Card, CardHeader, Field, Row, Select, SwitchRow,
} from '@/components/ui';

// Price, quantity and the Etsy shop fields. Number inputs are passed as text so a half-typed
// value ("12.") is not lost; the screen converts them.
export function ShopDetailsSection({
  product, priceText, qtyText, readyText, onPrice, onQuantity, onReadiness, onChange,
  shopConnected, shipping, errors,
}: {
  product: Product; priceText: string; qtyText: string; readyText: string;
  onPrice: (v: string) => void; onQuantity: (v: string) => void; onReadiness: (v: string) => void;
  onChange: (patch: Partial<Product>) => void;
  shopConnected: boolean; shipping: ShippingProfile[] | null;
  errors: { price?: string; quantity?: string; shippingProfileId?: string };
}) {
  return (
    <Card>
      <CardHeader icon="cash-outline" title="Pricing and shop details" />
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Field label="Price (USD)" value={priceText} onChangeText={onPrice} keyboardType="decimal-pad" error={errors.price} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Quantity" value={qtyText} onChangeText={onQuantity} keyboardType="numeric" error={errors.quantity} />
        </View>
      </Row>
      <Select label="Who made it" value={product.whoMade} onChange={(v) => onChange({ whoMade: v as Product['whoMade'] })} options={WHO_MADE} />
      <Select label="When it was made" value={product.whenMade} onChange={(v) => onChange({ whenMade: v })} options={WHEN_MADE} />
      <SwitchRow label="Craft supply" hint="Helps buyers find it under Supplies." value={product.isSupply} onChange={(v) => onChange({ isSupply: v })} />
      {shopConnected ? (
        <Select
          label="Shipping profile"
          value={product.shippingProfileId ? String(product.shippingProfileId) : null}
          onChange={(v) => onChange({ shippingProfileId: Number(v) })}
          options={(shipping ?? []).map((p) => ({ value: String(p.id), label: p.title }))}
          placeholder={shipping ? 'Choose a profile' : 'Loading profiles…'}
          error={errors.shippingProfileId}
          hint={shipping && !shipping.length ? 'No profiles yet. Create one in Etsy Shop Manager.' : undefined}
        />
      ) : (
        <Banner tone="info" text="Connect Etsy in Settings to choose a shipping profile from your shop." />
      )}
      <Field
        label="Readiness state ID" value={readyText} onChangeText={onReadiness} keyboardType="numeric"
        hint="Optional. Etsy requires it for physical items with processing times. Set a default in Settings."
      />
    </Card>
  );
}
