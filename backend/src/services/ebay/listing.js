// Builds an eBay listing from a Velista listing and sends it through the Inventory API:
// photos -> inventory item (title, description, item specifics) -> offer (price, policies) -> publish.
import { config } from '../../config/index.js';
import { EbayError } from './oauth.js';
import {
  categoryAspects, ebayDescription, ebayTitle, itemUrl, publishOffer, putInventoryItem, skuFor, suggestCategories,
  uploadImage, upsertOffer,
} from './api.js';
import { buildAspects } from './aspects.js';

// Settings needed before anything can be listed. Returns a user-facing message, or null when ready.
export function setupProblem(prefs = {}) {
  const missing = [];
  if (!prefs.fulfillmentPolicyId) missing.push('a shipping policy');
  if (!prefs.paymentPolicyId) missing.push('a payment policy');
  if (!prefs.returnPolicyId) missing.push('a return policy');
  if (!prefs.merchantLocationKey) missing.push('your ship-from location');
  return missing.length ? `Finish eBay setup in Settings: choose ${missing.join(', ')}.` : null;
}

async function pickCategory(listing) {
  const saved = listing.ebay?.categoryId;
  if (saved) return { id: saved, path: listing.ebay.categoryPath || null };
  const p = listing.product || {};
  const queries = [listing.content?.title, [p.type, p.name].filter(Boolean).join(' '), p.type].filter(Boolean);
  for (const q of queries) {
    const [best] = await suggestCategories(q);
    if (best) return best;
  }
  throw new EbayError(422, 'eBay could not find a category for this item. Add a clearer product type and try again.');
}

// Uploads photos not yet on eBay. Sets media.ebayImageUrl on each (mutates `listing`), so a retry skips them.
async function uploadNewImages(userId, listing) {
  const images = (listing.media || []).filter((m) => m.kind === 'image');
  for (const media of images) {
    if (!media.ebayImageUrl) media.ebayImageUrl = await uploadImage(userId, media.absolutePath, media.mime);
  }
  return images.map((m) => m.ebayImageUrl);
}

// `listing` must be hydrated (media items carry absolutePath). state: 'active' publishes,
// anything else leaves an unpublished offer on eBay (a draft).
export async function pushListingToEbay(listing, { state, prefs }) {
  const problem = setupProblem(prefs);
  if (problem) throw new EbayError(409, problem);
  const { userId } = listing;
  const p = listing.product;
  const sku = skuFor(listing.id);

  const category = await pickCategory(listing);
  const { aspects, missing } = await buildAspects(listing, await categoryAspects(category.id));
  const imageUrls = await uploadNewImages(userId, listing);
  if (!imageUrls.length) throw new EbayError(422, 'Add at least one photo before listing on eBay.');

  const quantity = Number(p.quantity) || 1;
  const description = ebayDescription(listing.content.description);
  await putInventoryItem(userId, sku, {
    title: ebayTitle(listing.content.title),
    description,
    aspects,
    imageUrls,
    quantity,
    condition: prefs.condition || 'NEW',
  });

  const offerId = await upsertOffer(userId, {
    offerId: listing.ebay?.offerId,
    sku,
    offer: {
      availableQuantity: quantity,
      categoryId: category.id,
      listingDescription: description,
      listingPolicies: {
        fulfillmentPolicyId: prefs.fulfillmentPolicyId,
        paymentPolicyId: prefs.paymentPolicyId,
        returnPolicyId: prefs.returnPolicyId,
      },
      pricingSummary: { price: { value: Number(p.price).toFixed(2), currency: config.ebay.currency } },
      merchantLocationKey: prefs.merchantLocationKey,
    },
  });

  const listingId = state === 'active' ? await publishOffer(userId, offerId) : (listing.ebay?.listingId ?? null);
  return {
    sku,
    offerId,
    listingId,
    url: listingId ? itemUrl(listingId) : null,
    categoryId: category.id,
    categoryPath: category.path,
    missingAspects: missing,
  };
}
