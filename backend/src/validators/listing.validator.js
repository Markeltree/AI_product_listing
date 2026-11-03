import { MAX_QUANTITY, MIN_PRICE, WHEN_MADE, WHO_MADE, TAG_MAX_COUNT, TAG_MAX_LENGTH, TITLE_MAX } from '../config/constants.js';

// Returns [{field, message, severity}]. Severity 'error' blocks publishing; 'warning' does not.
// forPublish: required before going live (photos, category, shipping).
// forEtsyDraft: required before saving a draft to Etsy (category and shipping; photos optional).
export function validateListing(listing, { forPublish = false, forEtsyDraft = false } = {}) {
  const issues = [];
  const add = (field, message, severity = 'error') => issues.push({ field, message, severity });
  const c = listing.content || {};
  const p = listing.product || {};
  const media = (listing.media || []).filter((m) => m.kind === 'image');

  const title = String(c.title || '');
  if (!title.trim()) add('title', 'Add a title.');
  else if (title.length > TITLE_MAX) add('title', `Titles can be at most ${TITLE_MAX} characters (${title.length} now).`);

  if (!String(c.description || '').trim()) add('description', 'Add a description.');

  const tags = Array.isArray(c.tags) ? c.tags : [];
  if (tags.length > TAG_MAX_COUNT) add('tags', `Etsy allows ${TAG_MAX_COUNT} tags. Remove ${tags.length - TAG_MAX_COUNT}.`);
  tags.forEach((t) => {
    if (t.length > TAG_MAX_LENGTH) add('tags', `Tag "${t}" is longer than ${TAG_MAX_LENGTH} characters.`);
  });

  const price = Number(p.price);
  if (!Number.isFinite(price) || price < MIN_PRICE) add('price', `Enter a price of at least $${MIN_PRICE.toFixed(2)}.`);

  const qty = Number(p.quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY) add('quantity', `Quantity must be a whole number from 1 to ${MAX_QUANTITY}.`);

  if (!WHO_MADE.includes(p.whoMade)) add('whoMade', 'Choose who made this item.');
  if (!WHEN_MADE.includes(p.whenMade)) add('whenMade', 'Choose when it was made.');

  if (forPublish || forEtsyDraft) {
    if (!Number.isInteger(Number(p.taxonomyId)) || Number(p.taxonomyId) <= 0) {
      add('taxonomyId', `Choose an Etsy category before ${forPublish ? 'publishing' : 'saving to Etsy'}.`);
    }
    if (!p.shippingProfileId) add('shippingProfileId', `Choose a shipping profile before ${forPublish ? 'publishing' : 'saving to Etsy'}.`);
  }
  if (forPublish) {
    if (!media.length) add('media', 'Add at least one photo before publishing to Etsy.');
    if (!p.readinessStateId) add('readinessStateId', 'Set a readiness state in Settings before publishing physical items.', 'warning');
  }

  if (!c.altTexts?.length && media.length) add('altTexts', 'Alt text is missing for your photos.', 'warning');
  return issues;
}

export function hasBlockingIssues(issues) {
  return issues.some((i) => i.severity === 'error');
}
