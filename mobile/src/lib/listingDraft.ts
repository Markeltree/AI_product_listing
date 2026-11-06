import type { Content, Media, Product } from './types';

// The seller's working copy of a listing, kept apart from the last copy saved on the server.
export type Draft = { product: Product; content: Content; media: Media[] };

export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
export const imageIds = (media: Media[]) => media.filter((m) => m.kind === 'image').map((m) => m.id);
export const draftKey = (d: Draft) => JSON.stringify({ p: d.product, c: d.content, o: imageIds(d.media) });
export const photoCountOf = (d: Draft) => d.media.filter((m) => m.kind === 'image').length;

// Empty text means no value; anything that is not a number is treated the same way.
export const parseNumber = (v: string): number | null => {
  const n = v.trim() === '' ? null : Number(v);
  return n !== null && Number.isFinite(n) ? n : null;
};
