// Listing lifecycle: create (single or bulk) -> generate in the background -> edit -> delete.
// Publishing lives in publish.service.js.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { LISTING_STATUS, MAX_IMAGES } from '../config/constants.js';
import { store } from '../db/index.js';
import { badRequest } from '../utils/errors.js';
import { now } from '../utils/parse.js';
import { clean } from '../utils/text.js';
import { sanitizeContent, sanitizeProduct } from '../validators/listing.sanitizer.js';
import { enqueueGeneration } from '../queue/jobs.js';
import {
  imagesOf, listingDir, mediaFromUploads, removeFile, reorderImages, toMediaRecord,
} from './media.service.js';
import { assertNotGenerating, getListingOrThrow, saveListing } from './listing.repository.js';
import { getUserSettings } from './settings.service.js';

export const EMPTY_CONTENT = {
  title: '', description: '', tags: [], category: '', attributes: [], altTexts: [], suggestedPrice: null, pricingNote: '',
};

function newListing({ id = randomUUID(), userId, product, media }) {
  const createdAt = now();
  return {
    id,
    userId,
    status: LISTING_STATUS.GENERATING,
    step: 'Queued',
    error: null,
    createdAt,
    updatedAt: createdAt,
    product,
    content: { ...EMPTY_CONTENT },
    media,
    analysis: null,
    etsy: null,
    ebay: null,
    sync: null,
  };
}

// "blue_linen-pouch.jpg" -> "Blue linen pouch"
function nameFromFilename(filename) {
  const base = path.basename(filename, path.extname(filename));
  return clean(base.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase()), 140) || 'Handmade item';
}

// Short form used by the dashboard list.
function toSummary(l) {
  const images = imagesOf(l);
  return {
    id: l.id,
    status: l.status,
    step: l.step,
    error: l.error,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    title: l.content?.title || l.product?.name || 'Untitled listing',
    price: l.product?.price ?? null,
    quantity: l.product?.quantity ?? null,
    thumbnailId: images[0]?.id || null,
    mediaCount: images.length,
    etsyUrl: l.etsy?.url || null,
    ebayUrl: l.ebay?.url || null,
    channels: {
      etsy: l.etsy?.listingId ? (l.etsy.state || (l.etsy.publishedAt ? 'active' : 'draft')) : null,
      ebay: l.ebay?.offerId ? l.ebay.state || 'draft' : null,
    },
    endedReason: l.sync?.endedAt ? l.sync.reason : null,
  };
}

export async function listSummaries(userId) {
  return (await store.listListings(userId)).map(toSummary);
}

// Creates the listing record from uploaded files and starts generation in the background.
export async function createListing({ user, product, files }) {
  const settings = await getUserSettings(user.id);
  const listing = newListing({
    userId: user.id,
    product: sanitizeProduct(product, settings),
    media: mediaFromUploads(files),
  });
  await saveListing(listing);
  await enqueueGeneration(user.id, listing.id);
  return listing;
}

// Bulk: one listing per uploaded photo. Shared defaults (price, quantity, materials...) apply to every item.
// Each photo is moved out of the temporary upload folder into its own listing folder.
export async function createBulkListings({ user, files, defaults }) {
  const settings = await getUserSettings(user.id);
  const shared = sanitizeProduct(defaults || {}, settings);
  const created = [];
  for (const file of files) {
    const id = randomUUID();
    const dir = listingDir(user.id, id);
    await fs.mkdir(dir, { recursive: true });
    const dest = path.join(dir, `${randomUUID()}${path.extname(file.path) || '.jpg'}`);
    await fs.rename(file.path, dest);

    const listing = newListing({
      id,
      userId: user.id,
      product: { ...shared, name: nameFromFilename(file.originalname), type: shared.type || '' },
      media: [toMediaRecord(file, { kind: 'image', filePath: dest })],
    });
    await saveListing(listing);
    await enqueueGeneration(user.id, id);
    created.push(listing);
  }
  return created;
}

// Applies an editor update: product facts, generated content and/or photo order.
export async function updateListing(userId, listingId, { product, content, mediaOrder } = {}) {
  const listing = await getListingOrThrow(userId, listingId);
  assertNotGenerating(listing, 'Wait for generation to finish before editing.');
  if (product) listing.product = sanitizeProduct({ ...listing.product, ...product }, await getUserSettings(userId));
  if (content) listing.content = sanitizeContent(content, listing.content);
  if (Array.isArray(mediaOrder)) listing.media = reorderImages(listing.media, mediaOrder);
  return saveListing(listing);
}

export async function startRegeneration(userId, listingId) {
  const listing = await getListingOrThrow(userId, listingId);
  listing.status = LISTING_STATUS.GENERATING;
  listing.step = 'Queued';
  listing.error = null;
  await saveListing(listing);
  await enqueueGeneration(userId, listingId);
  return listing;
}

export async function deleteListing(userId, listingId) {
  await getListingOrThrow(userId, listingId);
  await store.deleteListing(userId, listingId);
  await fs.rm(listingDir(userId, listingId), { recursive: true, force: true });
}

// ---------- media on an existing listing ----------

export async function getMedia(userId, listingId, mediaId) {
  const listing = await getListingOrThrow(userId, listingId);
  return listing.media.find((m) => m.id === mediaId) || null;
}

// Checked before the upload starts, so files are not written for a listing that cannot take them.
export async function assertCanAddPhotos(userId, listingId) {
  const listing = await getListingOrThrow(userId, listingId);
  assertNotGenerating(listing);
  if (imagesOf(listing).length >= MAX_IMAGES) throw badRequest(`A listing can have up to ${MAX_IMAGES} photos.`);
  return listing;
}

export async function addPhotos(userId, listingId, files) {
  const listing = await getListingOrThrow(userId, listingId);
  if (!files.length) throw badRequest('Choose at least one photo to add.');
  const room = MAX_IMAGES - imagesOf(listing).length;
  if (files.length > room) {
    throw badRequest(`You can add ${room} more photo${room === 1 ? '' : 's'} to this listing.`);
  }
  listing.media.push(...files.map((f) => toMediaRecord(f, { kind: 'image' })));
  // Keep alt text aligned with photo order; new photos get an empty slot to fill in.
  listing.content.altTexts = [...(listing.content.altTexts || []), ...files.map(() => '')].slice(0, MAX_IMAGES);
  return saveListing(listing);
}

export async function removeMedia(userId, listingId, mediaId) {
  const listing = await getListingOrThrow(userId, listingId);
  assertNotGenerating(listing);
  const target = listing.media.find((m) => m.id === mediaId);
  if (!target) return listing;
  listing.media = listing.media.filter((m) => m.id !== mediaId);
  await removeFile(target);
  return saveListing(listing);
}
