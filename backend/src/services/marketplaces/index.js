// Every marketplace Velista lists on. Sync and "End listing" work through this list only, so adding
// a marketplace means adding its folder (api, oauth, connection, publish, adapter) and one line here.
//
// An adapter has this shape:
//   id, name                   'etsy', 'Etsy'. The listing keeps its details for it under listing[id].
//   isLive(listing)            true while the listing's copy there is for sale
//   getState(listing)          { exists, active, quantity, soldOut } as the marketplace sees it now
//   end(listing)               takes the copy off sale; succeeds when it is already gone
//   setQuantity(listing, qty)  returns false when the copy cannot be changed safely
import { LISTING_STATUS } from '../../config/constants.js';
import { now } from '../../utils/parse.js';
import { ebayAdapter } from './ebay/adapter.js';
import { etsyAdapter } from './etsy/adapter.js';

export { isLive } from './status.js';

export const MARKETPLACES = [etsyAdapter, ebayAdapter];

export const findMarketplace = (id) => MARKETPLACES.find((m) => m.id === id);

// The marketplaces where this listing is for sale right now.
export const liveOn = (listing) => MARKETPLACES.filter((m) => m.isLive(listing));

// "Etsy", "Etsy and eBay", "Etsy, eBay and Depop"
export const joinNames = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

// Marks the named copies as ended, and the listing as ended once nothing is live.
export function recordEnded(listing, { ended, reason, endedOn }) {
  const time = now();
  for (const id of ended) listing[id] = { ...(listing[id] || {}), state: 'ended', endedAt: time };
  listing.sync = { ...(listing.sync || {}), endedAt: time, reason, endedOn };
  if (!liveOn(listing).length) listing.status = LISTING_STATUS.ENDED;
}
