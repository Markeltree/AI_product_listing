// Read and write listings through the store. Shared by every listing-related service.
import { LISTING_STATUS } from '../config/constants.js';
import { store } from '../db/index.js';
import { conflict, notFound } from '../utils/errors.js';
import { now } from '../utils/parse.js';
import { dehydrate } from './media.service.js';

export const findListing = (userId, listingId) => store.getListing(userId, listingId);

export async function getListingOrThrow(userId, listingId) {
  const listing = await store.getListing(userId, listingId);
  if (!listing) throw notFound();
  return listing;
}

export function assertNotGenerating(listing, message = 'Wait for generation to finish first.') {
  if (listing.status === LISTING_STATUS.GENERATING) throw conflict(message);
}

// Stamps updatedAt and saves. Hydrated fields (absolutePath) are stripped before writing.
export async function saveListing(listing) {
  listing.updatedAt = now();
  await store.saveListing(dehydrate(listing));
  return listing;
}

// Re-reads the listing, applies `change` to it and saves. Use this for background updates so
// edits made in between are not overwritten with a stale copy. Returns null if it was deleted.
export async function updateListing(userId, listingId, change) {
  const listing = await store.getListing(userId, listingId);
  if (!listing) return null;
  change(listing);
  return saveListing(listing);
}
