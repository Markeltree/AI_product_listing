// Prompts for listing generation. The system prompt keeps the model to facts it can see or was told.
import { LANGUAGES, TAG_MAX_COUNT, TAG_MAX_LENGTH, TITLE_MAX, TONES } from '../../config/constants.js';

export const SYSTEM_PROMPT = `You are an expert Etsy listing copywriter and SEO specialist.
Rules you must follow:
- Only state product facts that are visible in the images or explicitly provided by the seller.
- Never invent materials, dimensions, certifications, brand names or care instructions. If unsure, leave it out.
- Write natural, human copy. No keyword stuffing, no all-caps, no emojis, no ALL CAPS hype.
- Respond with a single valid JSON object and nothing else.`;

export function buildUserPrompt({ listing, settings, transcript, frameCount }) {
  const p = listing.product || {};
  const tone = TONES.includes(p.tone) ? p.tone : (settings.defaultTone || 'warm');
  const language = LANGUAGES.includes(p.language) ? p.language : (settings.defaultLanguage || 'English');
  const photos = (listing.media || []).filter((m) => m.kind === 'image').length;
  return `Create an Etsy listing from the attached ${[photos ? `${photos} product photo(s)` : '', frameCount ? `${frameCount} frame(s) from a product video` : ''].filter(Boolean).join(' and ') || 'seller details'}.

Seller-provided facts (treat these as true):
${JSON.stringify({
  name: p.name, productType: p.type, materials: p.materials, colors: p.colors,
  dimensions: p.dimensions, brand: p.brand, keywords: p.keywords, notes: p.notes,
  targetAudience: p.audience, price: p.price, whoMade: p.whoMade,
}, null, 2)}

${transcript ? `Seller's voice note transcript (treat as true):\n"""${transcript}"""\n` : ''}
Writing requirements:
- Language: ${language}.
- Tone: ${tone}.
- title: max ${TITLE_MAX} characters, front-load the most searchable words, read naturally.
- description: 3 to 5 short paragraphs. The first two sentences must sell the product. Then short lines starting with "- " for materials, colors, size and what is included, only when known.
- tags: exactly up to ${TAG_MAX_COUNT} tags, each at most ${TAG_MAX_LENGTH} characters, phrases a buyer would search for. No punctuation except spaces, hyphens and apostrophes.
- category: the most specific Etsy category path you can, e.g. "Jewelry > Necklaces".
- attributes: array of {name, value} for materials, color, style, size when known.
- altTexts: one descriptive alt text per product photo, in order.
- suggestedPrice: a sensible USD price number or null, based on the product type and detail. Do not invent a precise price if you cannot judge it.
- pricingNote: one short sentence explaining the suggested price.
- detected: {productType, materials: [], colors: [], style, brand (null if not visible), dimensions (null if not visible)}.

Return JSON with exactly these keys: title, description, tags, category, attributes, altTexts, suggestedPrice, pricingNote, detected.`;
}

// Quick look at the photos before the seller fills in the details form. The answers prefill the form,
// so they must be things a seller can confirm at a glance.
export function buildAnalyzePrompt({ photoCount, frameCount = 0, language = 'English' }) {
  const media = [
    photoCount ? `${photoCount} product photo(s)` : '',
    frameCount ? `${frameCount} frame(s) taken from a product video` : '',
  ].filter(Boolean).join(' and ');
  return `Look at the attached ${media} and identify the product, so the seller can confirm the details before an Etsy listing is written.

Rules:
- Only report what is clearly visible. Use null (or an empty array) when you are not sure.
- brand: null unless a logo or label is clearly readable in the photo.
- dimensions: null unless a size is printed or measurable in the photo. Never estimate.
- Write values in ${language}.

Return JSON with exactly these keys:
- name: a short, descriptive product name a shopper would understand, at most 60 characters, e.g. "Sage Green Ceramic Mug".
- productType: one to three words, e.g. "Mug", "Wall art", "Necklace".
- materials: array of materials you can see, e.g. ["ceramic"].
- colors: array of the main colors.
- brand: string or null.
- dimensions: string or null.
- keywords: up to 8 short phrases buyers would type into Etsy search for this item.
- audience: a short phrase describing who would buy it, or null.`;
}
