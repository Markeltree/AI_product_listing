// Multi-marketplace actions: publish to eBay, end a listing on one or all marketplaces, and the
// cross-delist sync that ends the copy on the other marketplace when an item sells or ends on one.
import { notifyUser } from './notifications.service.js';
import { config } from '../config/index.js';
import { LISTING_STATUS } from '../config/constants.js';
import { store } from '../db/index.js';
import { HttpError, badRequest, conflict, notFound } from '../utils/errors.js';
import { now } from '../utils/parse.js';
import { validateListing } from '../validators/listing.validator.js';
import { deactivateEtsyListing, getEtsyListingState, setEtsyQuantity } from './etsy/index.js';
import {
  ebayConfigured, getListingState, pushListingToEbay, setQuantity, withdrawOffer,
} from './ebay/index.js';
import { hydrate } from './media.service.js';
import { assertNotGenerating, getListingOrThrow, updateListing } from './listing.repository.js';
import { log } from '../utils/logger.js';

// A marketplace copy is "live" once it was published there and has not been ended since.
// Older Etsy records have no `state`, so a publish date stands in for it.
export const isLive = (info) => Boolean(info?.listingId) && (info.state ? info.state === 'active' : Boolean(info.publishedAt));
const anyLive = (l) => isLive(l.etsy) || isLive(l.ebay);

// ---------- publish to eBay ----------

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

// ---------- ending listings ----------

async function endOnEtsy(listing) {
  const conn = await store.getConnection(listing.userId);
  if (!conn?.shopId) throw conflict('Etsy is not connected, so the Etsy copy could not be ended. Reconnect Etsy in Settings.');
  await deactivateEtsyListing(listing.userId, listing.etsy.shopId || conn.shopId, listing.etsy.listingId);
}

const endOnEbay = (listing) => withdrawOffer(listing.userId, listing.ebay.offerId);

// Marks the marketplace copies as ended and the listing as ended once nothing is live.
function recordEnded(l, { ended, reason, endedOn }) {
  const time = now();
  for (const ch of ended) l[ch] = { ...(l[ch] || {}), state: 'ended', endedAt: time };
  l.sync = { ...(l.sync || {}), endedAt: time, reason, endedOn };
  if (!anyLive(l)) l.status = LISTING_STATUS.ENDED;
}

// Manual "End listing": channel is 'etsy', 'ebay' or 'all'. With 'all' (or when ending one of two
// live copies is requested) only the named copies are ended.
export async function delistListing(userId, listingId, { channel = 'all' } = {}) {
  if (!['etsy', 'ebay', 'all'].includes(channel)) throw badRequest('Choose etsy, ebay or all.');
  const listing = await getListingOrThrow(userId, listingId);
  const targets = (channel === 'all' ? ['etsy', 'ebay'] : [channel]).filter((ch) => isLive(listing[ch]));
  if (!targets.length) throw conflict('This listing is not live there.');

  const ended = [];
  const errors = [];
  for (const ch of targets) {
    try {
      await (ch === 'etsy' ? endOnEtsy(listing) : endOnEbay(listing));
      ended.push(ch);
    } catch (err) {
      errors.push(`${ch === 'etsy' ? 'Etsy' : 'eBay'}: ${err.message}`);
    }
  }
  const saved = await updateListing(userId, listingId, (l) => {
    if (ended.length) recordEnded(l, { ended, reason: 'Ended by you in Velista', endedOn: 'velista' });
  });
  if (errors.length) throw new HttpError(502, `Could not end every copy. ${errors.join(' ')}`, { listing: saved });
  return { listing: saved };
}

// ---------- cross-delist sync ----------

const MARKETPLACE = { etsy: 'Etsy', ebay: 'eBay' };

function endReason(channel, state) {
  const where = MARKETPLACE[channel];
  if (!state.exists) return `Deleted on ${where}`;
  if (channel === 'etsy' && state.state === 'sold_out') return `Sold on ${where}`;
  if (channel === 'ebay' && state.quantity === 0) return `Sold on ${where}`;
  return `Ended on ${where}`;
}

// Checks one listing that is live on both marketplaces and fixes the other side when one changed.
// Returns a short description of what happened, or null when nothing changed.
export async function syncListing(listing) {
  const { userId } = listing;
  const [etsy, ebay] = await Promise.all([
    getEtsyListingState(userId, listing.etsy.listingId),
    getListingState(userId, { offerId: listing.ebay.offerId, sku: listing.ebay.sku }),
  ]);

  let action = null;
  let ended = [];
  let reason = null;
  let endedOn = null;
  let quantity = Number(listing.sync?.quantity ?? listing.product?.quantity ?? 1);

  if (!etsy.active && !ebay.active) {
    ended = ['etsy', 'ebay'];
    endedOn = 'both';
    reason = `${endReason('etsy', etsy)} and ${endReason('ebay', ebay)}`;
    action = reason;
  } else if (!etsy.active) {
    await endOnEbay(listing);
    ended = ['etsy', 'ebay'];
    endedOn = 'etsy';
    reason = endReason('etsy', etsy);
    action = `${reason}, so the eBay listing was ended`;
  } else if (!ebay.active) {
    await endOnEtsy(listing);
    ended = ['etsy', 'ebay'];
    endedOn = 'ebay';
    reason = endReason('ebay', ebay);
    action = `${reason}, so the Etsy listing was deactivated`;
  } else if (etsy.quantity < quantity && ebay.quantity > etsy.quantity) {
    // Some (not all) stock sold on Etsy: lower eBay to match.
    await setQuantity(userId, { offerId: listing.ebay.offerId, sku: listing.ebay.sku, quantity: etsy.quantity });
    quantity = etsy.quantity;
    action = `Sold on Etsy, eBay quantity set to ${quantity}`;
  } else if (ebay.quantity < quantity && etsy.quantity > ebay.quantity) {
    const updated = await setEtsyQuantity(userId, listing.etsy.listingId, ebay.quantity);
    quantity = ebay.quantity;
    action = updated ? `Sold on eBay, Etsy quantity set to ${quantity}` : null;
  } else if (etsy.quantity === ebay.quantity && etsy.quantity !== quantity) {
    quantity = etsy.quantity; // restocked on both
  }

  await updateListing(userId, listing.id, (l) => {
    l.sync = { ...(l.sync || {}), checkedAt: now(), quantity, lastError: null };
    if (l.product) l.product.quantity = Math.max(1, quantity);
    if (ended.length) recordEnded(l, { ended, reason, endedOn });
  });
  return action;
}

const bothLive = (l) => isLive(l.etsy) && isLive(l.ebay) && l.ebay?.offerId;

// Runs the sync for every listing live on both marketplaces (or only one user's). Never throws.
export async function runSync({ userId = null } = {}) {
  const listings = await store.listListingsByStatus(LISTING_STATUS.PUBLISHED, userId);
  const results = [];
  for (const listing of listings.filter(bothLive)) {
    try {
      const action = await syncListing(listing);
      if (action) {
        log.info('sync', action, { listingId: listing.id });
        await notifyUser(listing.userId, { title: listing.content?.title || 'Listing update', body: action, data: { listingId: listing.id } });
        results.push({ id: listing.id, title: listing.content?.title, action });
      }
    } catch (err) {
      log.error('sync', 'Listing check failed', { listingId: listing.id, err });
      await updateListing(listing.userId, listing.id, (l) => {
        l.sync = { ...(l.sync || {}), checkedAt: now(), lastError: err.message };
      }).catch(() => {});
      results.push({ id: listing.id, title: listing.content?.title, error: err.message });
    }
  }
  return { checked: listings.filter(bothLive).length, changes: results };
}

let timer = null;
let running = false;

// Background loop. Overlapping runs are skipped, so a slow marketplace cannot pile them up.
export function startSyncLoop() {
  if (!config.syncIntervalMs || timer) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runSync();
    } catch (err) {
      log.error('sync', 'Sync run failed', { err });
    } finally {
      running = false;
    }
  };
  timer = setInterval(tick, config.syncIntervalMs);
  timer.unref?.();
  setTimeout(tick, 15_000).unref?.();
  log.info('sync', `Cross-delist check every ${Math.round(config.syncIntervalMs / 60000)} min`);
}
