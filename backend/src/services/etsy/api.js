// Etsy endpoints used by the app: shop lookup, shipping profiles, taxonomy search,
// and creating, updating and publishing listings with images.
import fs from 'node:fs/promises';
import path from 'node:path';
import { store } from '../../db/index.js';
import { EtsyError, assertEtsyConfigured } from './oauth.js';
import { etsyRequest } from './client.js';

// ---------- account and shop ----------

export async function fetchShopForUser(userId) {
  const me = await etsyRequest(userId, { path: '/application/users/me' });
  const shop = await etsyRequest(userId, { path: `/application/users/${me.user_id}/shops` });
  return { etsyUserId: me.user_id, shopId: shop.shop_id ?? null, shopName: shop.shop_name ?? null };
}

export async function fetchShippingProfiles(userId, shopId) {
  const json = await etsyRequest(userId, { path: `/application/shops/${shopId}/shipping-profiles` });
  return (json.results || []).map((p) => ({
    id: p.shipping_profile_id,
    title: p.title,
    originCountry: p.origin_country_iso,
  }));
}

// ---------- taxonomy (categories) ----------

const TAXONOMY_TTL_MS = 24 * 60 * 60 * 1000;
let taxonomyCache = { at: 0, items: [] };

function flattenTaxonomy(nodes, parentPath = [], out = []) {
  for (const node of nodes || []) {
    const pathNames = [...parentPath, node.name].filter(Boolean);
    if (node.id != null && pathNames.length) out.push({ id: Number(node.id), name: node.name, path: pathNames.join(' > ') });
    if (Array.isArray(node.children) && node.children.length) flattenTaxonomy(node.children, pathNames, out);
  }
  return out;
}

async function taxonomy() {
  const stale = Date.now() - taxonomyCache.at > TAXONOMY_TTL_MS;
  if (stale || !taxonomyCache.items.length) {
    const json = await etsyRequest(null, { path: '/application/seller-taxonomy/nodes', auth: false });
    taxonomyCache = { at: Date.now(), items: flattenTaxonomy(json.results || json.nodes || []) };
  }
  return taxonomyCache.items;
}

export async function searchTaxonomy(q, limit = 20) {
  assertEtsyConfigured();
  const items = await taxonomy();
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return items.slice(0, limit);
  return items
    .filter((n) => n.path.toLowerCase().includes(needle))
    .sort((a, b) => a.path.length - b.path.length)
    .slice(0, limit);
}

// ---------- listings ----------

function listingFormFields(listing) {
  const p = listing.product;
  const c = listing.content;
  const fields = {
    quantity: Number(p.quantity),
    title: c.title,
    description: c.description,
    price: Number(p.price).toFixed(2),
    who_made: p.whoMade,
    when_made: p.whenMade,
    taxonomy_id: Number(p.taxonomyId),
    is_supply: Boolean(p.isSupply),
    tags: (c.tags || []).join(','),
  };
  if (p.shippingProfileId) fields.shipping_profile_id = Number(p.shippingProfileId);
  if (p.readinessStateId) fields.readiness_state_id = Number(p.readinessStateId);
  return fields;
}

const listingPath = (shopId, listingId = '') => `/application/shops/${shopId}/listings${listingId ? `/${listingId}` : ''}`;

// Uploads photos that are not on Etsy yet. Sets media.etsyImageId on each uploaded item (mutates `listing`),
// so a later retry skips photos that already made it.
async function uploadNewImages(userId, shopId, etsyListingId, listing) {
  const images = (listing.media || []).filter((m) => m.kind === 'image');
  for (const [index, media] of images.entries()) {
    if (media.etsyImageId) continue;
    const image = await etsyRequest(userId, {
      method: 'POST',
      path: `${listingPath(shopId, etsyListingId)}/images`,
      form: { alt_text: (listing.content.altTexts?.[index] || '').slice(0, 250) },
      file: {
        field: 'image',
        buffer: await fs.readFile(media.absolutePath),
        type: media.mime || 'image/jpeg',
        filename: path.basename(media.absolutePath),
      },
    });
    media.etsyImageId = image.listing_image_id;
  }
}

// Creates or updates the Etsy listing, uploads any new photos, then sets its state.
// `listing` must be hydrated (media items carry absolutePath).
// state: 'draft' keeps it as a draft on Etsy; 'active' publishes it.
export async function pushListingToEtsy(listing, { state }) {
  const userId = listing.userId;
  const conn = await store.getConnection(userId);
  if (!conn?.shopId) throw new EtsyError(400, 'No Etsy shop is linked to your account. Reconnect Etsy in Settings.');
  const { shopId } = conn;
  const fields = listingFormFields(listing);

  let etsyListingId = listing.etsy?.listingId;
  if (etsyListingId) {
    await etsyRequest(userId, { method: 'PATCH', path: listingPath(shopId, etsyListingId), form: fields });
  } else {
    const created = await etsyRequest(userId, { method: 'POST', path: listingPath(shopId), form: fields });
    etsyListingId = created.listing_id;
  }

  await uploadNewImages(userId, shopId, etsyListingId, listing);

  if (state === 'active') {
    await etsyRequest(userId, { method: 'PATCH', path: listingPath(shopId, etsyListingId), form: { state: 'active' } });
  }

  return { listingId: etsyListingId, shopId, url: `https://www.etsy.com/listing/${etsyListingId}` };
}

// ---------- cross-marketplace sync ----------

// Current state on Etsy: { exists, active, quantity, state }. Etsy states: active, inactive,
// sold_out, draft, expired. A deleted listing comes back as a 404.
export async function getEtsyListingState(userId, etsyListingId) {
  let l;
  try {
    l = await etsyRequest(userId, { path: `/application/listings/${etsyListingId}` });
  } catch (err) {
    if (err.status === 404) return { exists: false, active: false, quantity: 0, state: 'removed' };
    throw err;
  }
  const quantity = Number(l.quantity ?? 0);
  return { exists: true, active: l.state === 'active' && quantity > 0, quantity, state: l.state };
}

// Takes the listing off Etsy without deleting it (it can be renewed later from Shop Manager).
export async function deactivateEtsyListing(userId, shopId, etsyListingId) {
  try {
    await etsyRequest(userId, { method: 'PATCH', path: listingPath(shopId, etsyListingId), form: { state: 'inactive' } });
  } catch (err) {
    if (err.status === 404) return; // already gone
    throw err;
  }
}

// Sets the stock of a listing without variations. Listings with variations are left alone.
export async function setEtsyQuantity(userId, etsyListingId, quantity) {
  const inv = await etsyRequest(userId, { path: `/application/listings/${etsyListingId}/inventory` });
  const products = inv?.products || [];
  if (products.length !== 1 || (products[0].offerings || []).length !== 1) return false;
  const [product] = products;
  const [offering] = product.offerings;
  const price = offering.price?.amount != null ? offering.price.amount / (offering.price.divisor || 100) : Number(offering.price);
  await etsyRequest(userId, {
    method: 'PUT',
    path: `/application/listings/${etsyListingId}/inventory`,
    json: {
      products: [{
        sku: product.sku || '',
        property_values: product.property_values || [],
        offerings: [{ price, quantity, is_enabled: offering.is_enabled !== false }],
      }],
      price_on_property: inv.price_on_property || [],
      quantity_on_property: inv.quantity_on_property || [],
      sku_on_property: inv.sku_on_property || [],
    },
  });
  return true;
}
