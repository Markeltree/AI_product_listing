// Mirrors server/config/constants.js and server/validators/listing.validator.js so problems show before a request is sent.
import type { Content, Issue, Product } from './types';

export const TITLE_MAX = 140;
export const TAG_MAX_COUNT = 13;
export const TAG_MAX_LENGTH = 20;
export const MIN_PRICE = 0.2;
export const MAX_QUANTITY = 999;
export const MAX_PHOTOS = 5;
export const MAX_BULK = 20;

export const TONES: { value: string; label: string }[] = [
  { value: 'warm', label: 'Warm & friendly' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'luxurious', label: 'Luxurious' },
  { value: 'playful', label: 'Playful' },
  { value: 'professional', label: 'Professional' },
];

export const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian'];

export const WHO_MADE = [
  { value: 'i_did', label: 'I did' },
  { value: 'collective', label: 'A member of my shop' },
  { value: 'someone_else', label: 'Another company or person' },
];

export const WHEN_MADE = [
  { value: 'made_to_order', label: 'Made to order' },
  { value: '2020_2025', label: '2020 – 2025' },
  { value: '2010_2019', label: '2010 – 2019' },
  { value: '2000_2009', label: '2000 – 2009' },
  { value: '1990s', label: '1990s' },
  { value: '1980s', label: '1980s' },
  { value: '1970s', label: '1970s' },
  { value: 'before_1700', label: 'Before 1700' },
];

export const PRODUCT_TYPES = ['Mug', 'Necklace', 'Earrings', 'Ring', 'Candle', 'Wall art', 'Print', 'Tote bag', 'Planter', 'Soap', 'Notebook', 'Home decor'];

export function listingIssues(
  product: Product,
  content: Content,
  photoCount: number,
  { forPublish = false, forEtsyDraft = false }: { forPublish?: boolean; forEtsyDraft?: boolean } = {},
): Issue[] {
  const issues: Issue[] = [];
  const add = (field: string, message: string, severity: 'error' | 'warning' = 'error') =>
    issues.push({ field, message, severity });

  if (!content.title.trim()) add('title', 'Add a title.');
  else if (content.title.length > TITLE_MAX) add('title', `Titles can be at most ${TITLE_MAX} characters.`);
  if (!content.description.trim()) add('description', 'Add a description.');
  if (content.tags.length > TAG_MAX_COUNT) add('tags', `Etsy allows ${TAG_MAX_COUNT} tags.`);

  if (product.price === null || product.price === undefined) add('price', 'Add a price.');
  else if (!(product.price >= MIN_PRICE)) add('price', `Price must be at least $${MIN_PRICE.toFixed(2)}.`);

  if (!Number.isInteger(product.quantity) || (product.quantity ?? 0) < 1 || (product.quantity ?? 0) > MAX_QUANTITY) {
    add('quantity', `Quantity must be a whole number from 1 to ${MAX_QUANTITY}.`);
  }

  if (forPublish || forEtsyDraft) {
    if (!product.taxonomyId) add('taxonomyId', 'Choose an Etsy category.');
    if (!product.shippingProfileId) add('shippingProfileId', 'Choose a shipping profile.');
  }
  if (forPublish && photoCount < 1) add('media', 'Add at least one photo before publishing.');
  if (photoCount && content.altTexts.slice(0, photoCount).some((t) => !t.trim())) {
    add('altTexts', 'Some photos are missing alt text.', 'warning');
  }
  return issues;
}
