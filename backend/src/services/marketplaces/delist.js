// Manual "End listing": takes the listing off one marketplace, or off every marketplace it is live on.
import { HttpError, badRequest, conflict } from '../../utils/errors.js';
import { getListingOrThrow, updateListing } from '../listing.repository.js';
import { MARKETPLACES, findMarketplace, liveOn, recordEnded } from './index.js';

// channel: a marketplace id ('etsy', 'ebay', ...) or 'all'.
export async function delistListing(userId, listingId, { channel = 'all' } = {}) {
  if (channel !== 'all' && !findMarketplace(channel)) {
    throw badRequest(`Choose ${MARKETPLACES.map((m) => m.id).join(', ')} or all.`);
  }
  const listing = await getListingOrThrow(userId, listingId);
  const targets = liveOn(listing).filter((m) => channel === 'all' || m.id === channel);
  if (!targets.length) throw conflict('This listing is not live there.');

  const ended = [];
  const errors = [];
  for (const m of targets) {
    try {
      await m.end(listing);
      ended.push(m.id);
    } catch (err) {
      errors.push(`${m.name}: ${err.message}`);
    }
  }
  const saved = await updateListing(userId, listingId, (l) => {
    if (ended.length) recordEnded(l, { ended, reason: 'Ended by you in Velista', endedOn: 'velista' });
  });
  if (errors.length) throw new HttpError(502, `Could not end every copy. ${errors.join(' ')}`, { listing: saved });
  return { listing: saved };
}
