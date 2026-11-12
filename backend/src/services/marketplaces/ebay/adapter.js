// eBay's side of cross-delisting. Every marketplace adapter has the same shape, see ../index.js.
import { isLive } from '../status.js';
import { getListingState, setQuantity, withdrawOffer } from './api.js';

export const ebayAdapter = {
  id: 'ebay',
  name: 'eBay',

  // Without an offer there is nothing on eBay to check or end.
  isLive: (listing) => isLive(listing.ebay) && Boolean(listing.ebay.offerId),

  async getState(listing) {
    const s = await getListingState(listing.userId, { offerId: listing.ebay.offerId, sku: listing.ebay.sku });
    return { exists: s.exists, active: s.active, quantity: s.quantity, soldOut: s.exists && s.quantity === 0 };
  },

  end: (listing) => withdrawOffer(listing.userId, listing.ebay.offerId),

  async setQuantity(listing, quantity) {
    await setQuantity(listing.userId, { offerId: listing.ebay.offerId, sku: listing.ebay.sku, quantity });
    return true;
  },
};
