// eBay endpoints used by the app: account setup (policies, location), category and item specifics,
// photo upload, and creating, publishing, checking and ending listings through the Inventory API.
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../../config/index.js';
import { EBAY_TITLE_MAX } from '../../../config/constants.js';
import { EbayError } from './oauth.js';
import { ebayRequest } from './client.js';

const ACCOUNT = '/sell/account/v1';
const INVENTORY = '/sell/inventory/v1';
const TAXONOMY = '/commerce/taxonomy/v1';
export const VELISTA_LOCATION_KEY = 'velista-default';

// ---------- account ----------

export async function fetchEbayUser(userId) {
  const { json } = await ebayRequest(userId, { path: '/commerce/identity/v1/user/', base: config.ebay.identityBase });
  return { ebayUserId: json?.userId || null, username: json?.username || null };
}

const POLICY_TYPES = {
  fulfillment: { path: 'fulfillment_policy', list: 'fulfillmentPolicies', id: 'fulfillmentPolicyId' },
  payment: { path: 'payment_policy', list: 'paymentPolicies', id: 'paymentPolicyId' },
  return: { path: 'return_policy', list: 'returnPolicies', id: 'returnPolicyId' },
};

// Business policies (shipping, payment, returns) for the marketplace. Accounts that never opted in
// to business policies are opted in once, then asked to create them on eBay.
export async function fetchPolicies(userId) {
  const out = {};
  for (const [type, t] of Object.entries(POLICY_TYPES)) {
    let json;
    try {
      ({ json } = await ebayRequest(userId, { path: `${ACCOUNT}/${t.path}`, query: { marketplace_id: config.ebay.marketplaceId } }));
    } catch (err) {
      // 20403: the account is not opted in to business policies.
      if (err.ebayErrors?.some((e) => e.errorId === 20403)) {
        await ebayRequest(userId, { method: 'POST', path: `${ACCOUNT}/program/opt_in`, body: { programType: 'SELLING_POLICY_MANAGEMENT' } }).catch(() => {});
        json = {};
      } else {
        throw err;
      }
    }
    out[type] = (json?.[t.list] || []).map((p) => ({ id: String(p[t.id]), name: p.name }));
  }
  return out;
}

export async function fetchLocations(userId) {
  const { json } = await ebayRequest(userId, { path: `${INVENTORY}/location`, query: { limit: 100 } });
  return (json?.locations || []).map((l) => ({
    key: l.merchantLocationKey,
    name: l.name || l.merchantLocationKey,
    postalCode: l.location?.address?.postalCode || null,
    country: l.location?.address?.country || null,
  }));
}

// Creates (or replaces) the inventory location Velista ships from. eBay only needs country + postal code.
export async function createLocation(userId, { postalCode, country }) {
  try {
    await ebayRequest(userId, {
      method: 'POST',
      path: `${INVENTORY}/location/${VELISTA_LOCATION_KEY}`,
      body: {
        location: { address: { postalCode, country } },
        locationTypes: ['WAREHOUSE'],
        name: 'Velista ship-from location',
        merchantLocationStatus: 'ENABLED',
      },
    });
  } catch (err) {
    // 25803: the key already exists. Update its address instead.
    if (!err.ebayErrors?.some((e) => e.errorId === 25803)) throw err;
    await ebayRequest(userId, {
      method: 'POST',
      path: `${INVENTORY}/location/${VELISTA_LOCATION_KEY}/update_location_details`,
      body: { location: { address: { postalCode, country } } },
    });
  }
  return VELISTA_LOCATION_KEY;
}

// ---------- category and item specifics ----------

let treeId = null;
async function categoryTreeId() {
  if (treeId) return treeId;
  const { json } = await ebayRequest(null, {
    auth: 'app', path: `${TAXONOMY}/get_default_category_tree_id`, query: { marketplace_id: config.ebay.marketplaceId },
  });
  treeId = json.categoryTreeId;
  return treeId;
}

// Best leaf categories for a search phrase, best first.
export async function suggestCategories(q) {
  const tree = await categoryTreeId();
  const { json } = await ebayRequest(null, {
    auth: 'app', path: `${TAXONOMY}/category_tree/${tree}/get_category_suggestions`, query: { q: String(q).slice(0, 350) },
  });
  return (json?.categorySuggestions || []).map((s) => ({
    id: String(s.category.categoryId),
    name: s.category.categoryName,
    path: [...(s.categoryTreeNodeAncestors || []).map((a) => a.categoryName).reverse(), s.category.categoryName].join(' > '),
  }));
}

// Item specifics (aspects) for a category: [{ name, required, mode, multi, values }]
export async function categoryAspects(categoryId) {
  const tree = await categoryTreeId();
  const { json } = await ebayRequest(null, {
    auth: 'app', path: `${TAXONOMY}/category_tree/${tree}/get_item_aspects_for_category`, query: { category_id: categoryId },
  });
  return (json?.aspects || []).map((a) => ({
    name: a.localizedAspectName,
    required: Boolean(a.aspectConstraint?.aspectRequired),
    mode: a.aspectConstraint?.aspectMode || 'FREE_TEXT', // or SELECTION_ONLY
    multi: a.aspectConstraint?.itemToAspectCardinality === 'MULTI',
    values: (a.aspectValues || []).map((v) => v.localizedValue),
  }));
}

// ---------- photos ----------

// Uploads a photo to eBay Picture Services and returns its eBay-hosted URL.
export async function uploadImage(userId, filePath, mime = 'image/jpeg') {
  const form = new FormData();
  form.append('image', new Blob([await fs.readFile(filePath)], { type: mime }), path.basename(filePath));
  const created = await ebayRequest(userId, {
    method: 'POST', base: config.ebay.mediaBase, path: '/commerce/media/v1_beta/image/create_image_from_file', form,
  });
  if (created.json?.imageUrl) return created.json.imageUrl;
  const location = created.headers.get('location');
  if (!location) throw new EbayError(502, 'eBay did not return the uploaded image.');
  const imageId = location.split('/').pop();
  const { json } = await ebayRequest(userId, { base: config.ebay.mediaBase, path: `/commerce/media/v1_beta/image/${imageId}` });
  if (!json?.imageUrl) throw new EbayError(502, 'eBay did not return a URL for the uploaded image.');
  return json.imageUrl;
}

// ---------- listings ----------

export const skuFor = (listingId) => `velista-${listingId}`.slice(0, 50);
export const itemUrl = (listingId) => `${config.ebay.itemUrlBase}${listingId}`;

// Cuts at a word boundary so the title does not end mid-word.
export function ebayTitle(title) {
  const t = String(title || '').replace(/\s+/g, ' ').trim();
  if (t.length <= EBAY_TITLE_MAX) return t;
  const cut = t.slice(0, EBAY_TITLE_MAX + 1);
  const space = cut.lastIndexOf(' ');
  return (space > 40 ? cut.slice(0, space) : t.slice(0, EBAY_TITLE_MAX)).replace(/[\s,;:-]+$/, '');
}

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Plain text description -> simple HTML: paragraphs, and "- " lines as a bullet list.
export function ebayDescription(text) {
  const blocks = String(text || '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.every((l) => /^[-•*]\s+/.test(l))) {
      return `<ul>${lines.map((l) => `<li>${escapeHtml(l.replace(/^[-•*]\s+/, ''))}</li>`).join('')}</ul>`;
    }
    return `<p>${lines.map(escapeHtml).join('<br>')}</p>`;
  }).join('\n');
}

export async function putInventoryItem(userId, sku, { title, description, aspects, imageUrls, quantity, condition }) {
  await ebayRequest(userId, {
    method: 'PUT',
    path: `${INVENTORY}/inventory_item/${encodeURIComponent(sku)}`,
    body: {
      availability: { shipToLocationAvailability: { quantity } },
      condition,
      product: { title, description, aspects, imageUrls },
    },
  });
}

async function findOfferIdForSku(userId, sku) {
  try {
    const { json } = await ebayRequest(userId, {
      path: `${INVENTORY}/offer`, query: { sku, marketplace_id: config.ebay.marketplaceId },
    });
    return json?.offers?.[0]?.offerId || null;
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// Creates or updates the offer (price, policies, category) for a SKU. Returns the offerId.
export async function upsertOffer(userId, { offerId, sku, offer }) {
  const body = {
    sku,
    marketplaceId: config.ebay.marketplaceId,
    format: 'FIXED_PRICE',
    ...offer,
  };
  const existing = offerId || await findOfferIdForSku(userId, sku);
  if (existing) {
    try {
      await ebayRequest(userId, { method: 'PUT', path: `${INVENTORY}/offer/${existing}`, body });
      return existing;
    } catch (err) {
      if (err.status !== 404) throw err; // the stored offer is gone; create a new one
    }
  }
  const { json } = await ebayRequest(userId, { method: 'POST', path: `${INVENTORY}/offer`, body });
  return json.offerId;
}

export async function publishOffer(userId, offerId) {
  const { json } = await ebayRequest(userId, { method: 'POST', path: `${INVENTORY}/offer/${offerId}/publish` });
  return json.listingId;
}

// Ends the eBay listing. The offer and inventory item stay, so it can be published again later.
export async function withdrawOffer(userId, offerId) {
  try {
    await ebayRequest(userId, { method: 'POST', path: `${INVENTORY}/offer/${offerId}/withdraw` });
  } catch (err) {
    // Already ended or never published: nothing to do.
    if (err.status === 404 || err.ebayErrors?.some((e) => [25713, 25002].includes(e.errorId))) return;
    throw err;
  }
}

// Current state on eBay: { exists, active, quantity, listingStatus }.
export async function getListingState(userId, { offerId, sku }) {
  let offer;
  try {
    ({ json: offer } = await ebayRequest(userId, { path: `${INVENTORY}/offer/${offerId}` }));
  } catch (err) {
    if (err.status === 404) return { exists: false, active: false, quantity: 0, listingStatus: 'REMOVED' };
    throw err;
  }
  let quantity = Number(offer.availableQuantity ?? 0);
  try {
    const { json: item } = await ebayRequest(userId, { path: `${INVENTORY}/inventory_item/${encodeURIComponent(sku)}` });
    const q = item?.availability?.shipToLocationAvailability?.quantity;
    if (q !== undefined && q !== null) quantity = Number(q);
  } catch (err) {
    if (err.status !== 404) throw err;
    quantity = 0;
  }
  const listingStatus = offer.listing?.listingStatus || (offer.status === 'PUBLISHED' ? 'ACTIVE' : 'UNPUBLISHED');
  const active = offer.status === 'PUBLISHED' && listingStatus === 'ACTIVE' && quantity > 0;
  return { exists: true, active, quantity, listingStatus };
}

export async function setQuantity(userId, { offerId, sku, quantity }) {
  await ebayRequest(userId, {
    method: 'POST',
    path: `${INVENTORY}/bulk_update_price_quantity`,
    body: {
      requests: [{
        sku,
        shipToLocationAvailability: { quantity },
        offers: [{ offerId, availableQuantity: quantity }],
      }],
    },
  });
}
