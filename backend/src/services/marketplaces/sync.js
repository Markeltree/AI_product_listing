// Cross-delisting: when an item sells or ends on one marketplace, Velista ends it on the others, or
// lowers their stock when only some sold. Works for any number of marketplaces, see ./index.js.
import { config } from '../../config/index.js';
import { LISTING_STATUS } from '../../config/constants.js';
import { store } from '../../db/index.js';
import { now } from '../../utils/parse.js';
import { log } from '../../utils/logger.js';
import { updateListing } from '../listing.repository.js';
import { notifyUser } from '../notifications.service.js';
import { joinNames, liveOn, recordEnded } from './index.js';

function endReason(m, state) {
  if (!state.exists) return `Deleted on ${m.name}`;
  if (state.soldOut) return `Sold on ${m.name}`;
  return `Ended on ${m.name}`;
}

// Checks one listing that is live on two or more marketplaces and fixes the others when one changed.
// Returns a short description of what happened, or null when nothing changed.
export async function syncListing(listing) {
  const live = liveOn(listing);
  const states = await Promise.all(live.map((m) => m.getState(listing)));
  const seen = live.map((m, i) => ({ m, state: states[i] }));
  const stopped = seen.filter((s) => !s.state.active);
  const selling = seen.filter((s) => s.state.active);

  let action = null;
  let ended = [];
  let reason = null;
  let endedOn = null;
  let quantity = Number(listing.sync?.quantity ?? listing.product?.quantity ?? 1);

  if (stopped.length) {
    // Sold, ended or deleted somewhere: end it everywhere else.
    for (const { m } of selling) await m.end(listing);
    ended = live.map((m) => m.id);
    endedOn = stopped.length === 1 ? stopped[0].m.id : 'all';
    reason = joinNames(stopped.map(({ m, state }) => endReason(m, state)));
    action = selling.length ? `${reason}, so it was ended on ${joinNames(selling.map((s) => s.m.name))}` : reason;
  } else {
    const lowest = seen.reduce((a, b) => (b.state.quantity < a.state.quantity ? b : a));
    const min = lowest.state.quantity;
    if (min < quantity) {
      // Some (not all) stock sold on one marketplace: lower the others to match.
      const changed = [];
      for (const { m, state } of seen) {
        if (state.quantity > min && (await m.setQuantity(listing, min)) !== false) changed.push(m.name);
      }
      quantity = min;
      action = changed.length ? `Sold on ${lowest.m.name}, quantity set to ${min} on ${joinNames(changed)}` : null;
    } else if (seen.every((s) => s.state.quantity === min) && min !== quantity) {
      quantity = min; // restocked everywhere
    }
  }

  await updateListing(listing.userId, listing.id, (l) => {
    l.sync = { ...(l.sync || {}), checkedAt: now(), quantity, lastError: null };
    if (l.product) l.product.quantity = Math.max(1, quantity);
    if (ended.length) recordEnded(l, { ended, reason, endedOn });
  });
  return action;
}

const onSeveral = (l) => liveOn(l).length >= 2;

// Runs the sync for every listing live on two or more marketplaces (or only one user's). Never throws.
export async function runSync({ userId = null } = {}) {
  const listings = (await store.listListingsByStatus(LISTING_STATUS.PUBLISHED, userId)).filter(onSeveral);
  const results = [];
  for (const listing of listings) {
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
  return { checked: listings.length, changes: results };
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
