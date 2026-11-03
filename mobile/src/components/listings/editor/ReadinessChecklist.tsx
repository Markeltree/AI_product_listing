import React from 'react';
import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { money } from '@/lib/format';
import { TAG_MAX_COUNT, TITLE_MAX, listingIssues } from '@/lib/rules';
import type { Content, Product } from '@/lib/types';
import { Card, CardHeader, Row } from '@/components/ui';
import { colors, font, radius } from '@/theme';

function checklist(product: Product, content: Content, photos: number) {
  const issues = listingIssues(product, content, photos, { forPublish: true });
  const has = (f: string) => issues.some((i) => i.field === f && i.severity === 'error');
  const warn = (f: string) => issues.some((i) => i.field === f && i.severity === 'warning');
  return [
    { label: 'Title', ok: !has('title'), warn: false, meta: `${content.title.length}/${TITLE_MAX}` },
    { label: 'Description', ok: !has('description'), warn: false, meta: '' },
    { label: 'Tags', ok: !has('tags'), warn: false, meta: `${content.tags.length}/${TAG_MAX_COUNT}` },
    { label: 'Price', ok: !has('price'), warn: false, meta: product.price != null ? money(product.price) : '' },
    { label: 'Category', ok: !has('taxonomyId'), warn: false, meta: '' },
    { label: 'Photos', ok: !has('media'), warn: false, meta: String(photos) },
    { label: 'Shipping profile', ok: !has('shippingProfileId'), warn: false, meta: '' },
    { label: 'Alt text', ok: !warn('altTexts'), warn: warn('altTexts'), meta: '' },
  ];
}

// What still needs doing before the listing can be published. `ready` comes from the full validation.
export function ReadinessChecklist({ product, content, photoCount, ready }: {
  product: Product; content: Content; photoCount: number; ready: boolean;
}) {
  const items = checklist(product, content, photoCount);
  return (
    <Card>
      <CardHeader icon="checkmark-done-outline" title="Publishing readiness" />
      {items.map((c) => (
        <Row key={c.label} style={{ justifyContent: 'space-between', paddingVertical: 2 }}>
          <Row>
            <Ionicons
              name={c.ok ? 'checkmark-circle' : c.warn ? 'alert-circle' : 'ellipse-outline'}
              size={21}
              color={c.ok ? colors.ok : c.warn ? colors.warn : colors.danger}
            />
            <Text style={{ fontSize: 14.5, color: colors.ink, fontWeight: '500' }}>{c.label}</Text>
          </Row>
          <Text style={[font.small, { fontWeight: '600' }]}>{c.meta}</Text>
        </Row>
      ))}
      <Row style={{ gap: 8, backgroundColor: ready ? colors.ok50 : colors.warn50, padding: 12, borderRadius: radius.sm }}>
        <Ionicons name={ready ? 'rocket-outline' : 'time-outline'} size={18} color={ready ? colors.okDark : colors.warn} />
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: ready ? colors.okDark : colors.warn }}>
          {ready ? 'Ready to publish' : 'Finish the required items to publish'}
        </Text>
      </Row>
    </Card>
  );
}
