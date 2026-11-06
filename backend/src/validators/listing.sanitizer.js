// Turns untrusted listing input (from the editor, the mobile app or the AI) into clean values
// that fit Etsy's limits. Never throws; bad values fall back or are dropped.
import {
  DEFAULT_SETTINGS, DESCRIPTION_MAX, HAUL_PHOTOS_PER_ITEM, LANGUAGES, MAX_HAUL_ITEMS, TAG_MAX_COUNT, TAG_MAX_LENGTH, TITLE_MAX, TONES, WHEN_MADE, WHO_MADE,
} from '../config/constants.js';
import { toIntOrNull, toNumberOrNull } from '../utils/parse.js';
import { clean, cleanMultiline, splitList } from '../utils/text.js';

const TAG_DISALLOWED = /[^\p{L}\p{N} '\-]/gu;

const oneOf = (allowed, value, fallback) => (allowed.includes(value) ? value : fallback);

export function sanitizeTags(input) {
  const seen = new Set();
  const out = [];
  for (const raw of splitList(input)) {
    const tag = raw.replace(TAG_DISALLOWED, '').replace(/\s+/g, ' ').trim().slice(0, TAG_MAX_LENGTH).trim();
    if (tag.length < 2) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length === TAG_MAX_COUNT) break;
  }
  return out;
}

export function sanitizeAttributes(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((a) => ({ name: clean(a?.name, 60), value: clean(a?.value, 200) }))
    .filter((a) => a.name && a.value)
    .slice(0, 20);
}

// Generated copy: title, description, tags, alt text and so on. Missing fields come from `fallback`.
export function sanitizeContent(input = {}, fallback = {}) {
  const price = Number(input.suggestedPrice);
  return {
    title: clean(input.title, TITLE_MAX) || clean(fallback.title, TITLE_MAX),
    description: cleanMultiline(input.description ?? fallback.description ?? '', DESCRIPTION_MAX),
    tags: sanitizeTags(input.tags !== undefined ? input.tags : fallback.tags),
    category: clean(input.category, 200) || clean(fallback.category, 200),
    attributes: sanitizeAttributes(input.attributes !== undefined ? input.attributes : fallback.attributes),
    altTexts: Array.isArray(input.altTexts) ? input.altTexts.map((t) => clean(t, 250)) : (fallback.altTexts || []),
    suggestedPrice: Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : (fallback.suggestedPrice ?? null),
    pricingNote: clean(input.pricingNote ?? fallback.pricingNote, 300),
  };
}

// Seller-entered product facts. Missing choices fall back to the user's default settings.
export function sanitizeProduct(input = {}, settings = DEFAULT_SETTINGS) {
  return {
    name: clean(input.name, 140),
    type: clean(input.type, 80),
    materials: splitList(input.materials).join(', '),
    colors: splitList(input.colors).join(', '),
    dimensions: clean(input.dimensions, 160),
    brand: clean(input.brand, 80),
    keywords: splitList(input.keywords).slice(0, 30).join(', '),
    notes: clean(input.notes, 1000),
    audience: clean(input.audience, 160),
    tone: oneOf(TONES, input.tone, settings.defaultTone),
    language: oneOf(LANGUAGES, input.language, settings.defaultLanguage),
    price: toNumberOrNull(input.price),
    quantity: toIntOrNull(input.quantity) ?? settings.defaultQuantity ?? 1,
    whoMade: oneOf(WHO_MADE, input.whoMade, settings.defaultWhoMade),
    whenMade: oneOf(WHEN_MADE, input.whenMade, settings.defaultWhenMade),
    isSupply: typeof input.isSupply === 'boolean' ? input.isSupply : Boolean(settings.defaultIsSupply),
    taxonomyId: toIntOrNull(input.taxonomyId) ?? settings.defaultTaxonomyId ?? null,
    taxonomyPath: clean(input.taxonomyPath, 300) || null,
    shippingProfileId: toIntOrNull(input.shippingProfileId) ?? settings.defaultShippingProfileId ?? null,
    readinessStateId: toIntOrNull(input.readinessStateId) ?? settings.defaultReadinessStateId ?? null,
  };
}

const ORIGINS = ['observed', 'inferred', 'spoken', 'missing'];
const ORIGIN_FIELDS = ['name', 'type', 'colors', 'materials', 'brand', 'size'];

// Items the AI found in a haul video. Items without a name or a usable frame are dropped, because
// a listing needs both. Frame numbers are checked against the frames that were actually sent.
export function sanitizeHaulItems(input = {}, frameCount = 0) {
  const items = Array.isArray(input.items) ? input.items : [];
  return items.slice(0, MAX_HAUL_ITEMS).map((item) => {
    const origins = Object.fromEntries(ORIGIN_FIELDS.map((f) => [f, oneOf(ORIGINS, item?.origins?.[f], 'missing')]));
    const frames = [...new Set(Array.isArray(item?.frames) ? item.frames : [])]
      .filter((n) => Number.isInteger(n) && n >= 0 && n < frameCount)
      .slice(0, HAUL_PHOTOS_PER_ITEM);
    return {
      name: clean(item?.name, 140),
      type: clean(item?.type, 80) || 'Item',
      colors: clean(item?.colors, 160),
      materials: clean(item?.materials, 160),
      brand: clean(item?.brand, 80),
      // Measurements are never guessed: only a size the seller said out loud is kept.
      dimensions: origins.size === 'spoken' ? clean(item?.size, 160) : '',
      notes: clean(item?.notes, 1000),
      frames,
      origins,
    };
  }).filter((item) => item.name && item.frames.length);
}

// AI suggestions from photo analysis, shaped like the wizard's details form. Unknown values become ''.
export function sanitizeSuggestions(input = {}) {
  return {
    name: clean(input.name, 140),
    type: clean(input.productType ?? input.type, 80),
    materials: splitList(input.materials).join(', '),
    colors: splitList(input.colors).join(', '),
    dimensions: clean(input.dimensions, 160),
    brand: clean(input.brand, 80),
    keywords: splitList(input.keywords).slice(0, 10),
    audience: clean(input.audience, 160),
  };
}
