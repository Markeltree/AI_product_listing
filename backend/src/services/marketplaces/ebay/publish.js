// Sends a listing to eBay, either as an unpublished offer (draft) or published (active).
import { LISTING_STATUS } from '../../../config/constants.js';
import { store } from '../../../db/index.js';
import { HttpError, conflict, notFound } from '../../../utils/errors.js';
import { now } from '../../../utils/parse.js';
import { validateListing } from '../../../validators/listing.validator.js';
import { hydrate } from '../../media.service.js';
import { assertNotGenerating, getListingOrThrow, updateListing } from '../../listing.repository.js';
import { isLive } from '../status.js';
import { ebayConfigured } from './oauth.js';
import { pushListingToEbay } from './listing.js';

const EBAY_FIELDS = new Set(['title', 'description', 'price', 'quantity']);

function ebayIssues(listing) {
  const issues = validateListing(listing).filter((i) => EBAY_FIELDS.has(i.field) && i.severity === 'error');
  if (!(listing.media || []).some((m) => m.kind === 'image')) {
    issues.push({ field: 'media', message: 'Add at least one photo before listing on eBay.', severity: 'error' });
  }
  return issues;
}

// Copies eBay image URLs from the pushed copy, so a retry does not upload the same photos again.
function keepEbayImageUrls(listing, pushed) {
  listing.media = listing.media.map((m) => {
    const sent = pushed.media.find((x) => x.id === m.id);
    return sent?.ebayImageUrl ? { ...m, ebayImageUrl: sent.ebayImageUrl } : m;
  });
}

// state: 'active' publishes; 'draft' leaves an unpublished offer on eBay.
export async function publishToEbay(userId, listingId, { state }) {
  const listing = await getListingOrThrow(userId, listingId);
  assertNotGenerating(listing, 'Wait for generation to finish before publishing.');
  if (!ebayConfigured()) throw new HttpError(503, 'eBay is not configured on the server yet. Add the eBay keys to the .env file.');
  const conn = await store.getEbayConnection(userId);
  if (!conn) throw conflict('Connect your eBay account in Settings before publishing.', { code: 'ebay_not_connected' });

  const issues = ebayIssues(listing);
  if (issues.length) throw new HttpError(422, 'Fix the highlighted fields before listing on eBay.', { issues });

  const isPublish = state === 'active';
  const pushed = hydrate(listing);
  let result;
  try {
    result = await pushListingToEbay(pushed, { state, prefs: conn.prefs || {} });
  } catch (err) {
    const failed = await updateListing(userId, listingId, (l) => {
      keepEbayImageUrls(l, pushed);
      l.ebay = { ...(l.ebay || {}), lastError: err.message, lastAttemptAt: now() };
    });
    const code = err.status === 409 ? 'ebay_setup' : undefined;
    throw new HttpError(err.status === 409 || err.status === 422 ? err.status : 502, err.message, { listing: failed, code });
  }

  const saved = await updateListing(userId, listingId, (l) => {
    keepEbayImageUrls(l, pushed);
    const time = now();
    const wasLive = isLive(l.ebay);
    l.ebay = {
      ...result,
      state: isPublish ? 'active' : (wasLive ? 'active' : 'draft'),
      listingId: result.listingId,
      publishedAt: isPublish ? time : (l.ebay?.publishedAt ?? null),
      lastSyncedAt: time,
      lastError: null,
    };
    if (isPublish) {
      l.status = LISTING_STATUS.PUBLISHED;
      l.sync = { ...(l.sync || {}), quantity: Number(l.product.quantity) || 1, endedAt: null, reason: null, endedOn: null };
    } else if (l.status !== LISTING_STATUS.PUBLISHED) {
      l.status = LISTING_STATUS.DRAFT;
    }
    l.error = null;
  });
  if (!saved) throw notFound();
  return { listing: saved, issues: validateListing(saved) };
}
