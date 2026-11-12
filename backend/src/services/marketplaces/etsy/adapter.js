// Etsy's side of cross-delisting. Every marketplace adapter has the same shape, see ../index.js.
import { store } from '../../../db/index.js';
import { conflict } from '../../../utils/errors.js';
import { isLive } from '../status.js';
import { deactivateEtsyListing, getEtsyListingState, setEtsyQuantity } from './api.js';

export const etsyAdapter = {
  id: 'etsy',
  name: 'Etsy',

  isLive: (listing) => isLive(listing.etsy),

  async getState(listing) {
    const s = await getEtsyListingState(listing.userId, listing.etsy.listingId);
    return { exists: s.exists, active: s.active, quantity: s.quantity, soldOut: s.state === 'sold_out' };
  },

  async end(listing) {
    const conn = await store.getConnection(listing.userId);
    if (!conn?.shopId) throw conflict('Etsy is not connected, so the Etsy copy could not be ended. Reconnect Etsy in Settings.');
    await deactivateEtsyListing(listing.userId, listing.etsy.shopId || conn.shopId, listing.etsy.listingId);
  },

  // Etsy listings with variations are left alone, so this can return false.
  setQuantity: (listing, quantity) => setEtsyQuantity(listing.userId, listing.etsy.listingId, quantity),
};
