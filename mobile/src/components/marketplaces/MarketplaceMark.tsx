import React from 'react';
import { LetterMark } from '@/components/ui';

export type Marketplace = 'etsy' | 'ebay';

export const MARKETPLACES: Record<Marketplace, { name: string; letter: string; color: string }> = {
  etsy: { name: 'Etsy', letter: 'E', color: '#F1641E' },
  ebay: { name: 'eBay', letter: 'e', color: '#0064D2' },
};

export function MarketplaceMark({ marketplace, size = 42 }: { marketplace: Marketplace; size?: number }) {
  const m = MARKETPLACES[marketplace];
  return <LetterMark letter={m.letter} color={m.color} size={size} />;
}
