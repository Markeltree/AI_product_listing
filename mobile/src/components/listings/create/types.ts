import type { Tone } from '@/lib/types';

export type PickedPhoto = { id: string; uri: string; name: string; type: string };
export type PickedClip = { uri: string; name: string; type: string; durationMs?: number };

// The details form keeps numbers as text so half-typed values are not lost.
export type ListingDetails = {
  name: string; type: string; price: string; quantity: string; materials: string; colors: string;
  dimensions: string; brand: string; keywords: string[]; tone: Tone; language: string; audience: string; notes: string;
};
