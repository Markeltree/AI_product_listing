// Sends a listing to Etsy, either as a draft or published (active).
import { LISTING_STATUS } from '../config/constants.js';
import { store } from '../db/index.js';
import { HttpError, conflict, notFound } from '../utils/errors.js';
import { now } from '../utils/parse.js';
import { hasBlockingIssues, validateListing } from '../validators/listing.validator.js';
import { etsyConfigured, pushListingToEtsy } from './etsy/index.js';
import { hydrate } from './media.service.js';
import { assertNotGenerating, getListingOrThrow, updateListing } from './listing.repository.js';
import { isLive } from './marketplace.service.js';

// Copies Etsy image IDs from the pushed copy, so a retry does not upload the same photos again.
function keepEtsyImageIds(listing, pushed) {
  listing.media = listing.media.map((m) => {
    const sent = pushed.media.find((x) => x.id === m.id);
    return sent?.etsyImageId ? { ...m, etsyImageId: sent.etsyImageId } : m;
  });
}

async function assertReadyToPublish(userId) {
  if (!etsyConfigured()) {
    throw new HttpError(503, 'Etsy is not configured yet. Add ETSY_API_KEY to your .env file, then connect your shop.');
  }
  const conn = await store.getConnection(userId);
  if (!conn?.shopId) throw conflict('Connect your Etsy shop in Settings before publishing.', { code: 'etsy_not_connected' });
}

// state: 'active' publishes, anything else saves a draft on Etsy.
// Validation problems throw a 422; an Etsy failure is recorded on the listing and thrown as a 502.
export async function publishListing(userId, listingId, { state }) {
  const listing = await getListingOrThrow(userId, listingId);
  assertNotGenerating(listing, 'Wait for generation to finish before publishing.');
  await assertReadyToPublish(userId);

  const isPublish = state === 'active';
  const issues = validateListing(listing, { forPublish: isPublish, forEtsyDraft: !isPublish });
  if (hasBlockingIssues(issues)) throw new HttpError(422, 'Fix the highlighted fields before publishing.', { issues });

  const pushed = hydrate(listing);
  let result;
  try {
    result = await pushListingToEtsy(pushed, { state });
  } catch (err) {
    const failed = await updateListing(userId, listingId, (l) => {
      // Keep IDs of photos that uploaded before the failure.
      keepEtsyImageIds(l, pushed);
      l.etsy = { ...(l.etsy || {}), lastError: err.message, lastAttemptAt: now() };
      // A copy live on eBay keeps the listing published, so the cross-delist sync keeps watching it.
      if (!isLive(l.ebay)) l.status = LISTING_STATUS.FAILED;
      l.error = `Etsy publish failed: ${err.message}`;
    });
    throw new HttpError(502, err.message, { listing: failed });
  }

  const saved = await updateListing(userId, listingId, (l) => {
    keepEtsyImageIds(l, pushed);
    const time = now();
    l.etsy = {
      listingId: result.listingId,
      shopId: result.shopId,
      url: result.url,
      lastSyncedAt: time,
      publishedAt: isPublish ? time : (l.etsy?.publishedAt ?? null),
      state: isPublish || isLive(l.etsy) ? 'active' : 'draft',
      lastError: null,
    };
    if (isPublish) l.sync = { ...(l.sync || {}), quantity: Number(l.product.quantity) || 1, endedAt: null, reason: null, endedOn: null };
    l.status = isPublish || l.status === LISTING_STATUS.PUBLISHED ? LISTING_STATUS.PUBLISHED : LISTING_STATUS.DRAFT;
    l.error = null;
  });
  if (!saved) throw notFound();
  return { listing: saved, issues: validateListing(saved, { forPublish: saved.status === LISTING_STATUS.PUBLISHED }) };
}
