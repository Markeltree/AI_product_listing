// Shared rule for a listing's copy on any marketplace (listing.etsy, listing.ebay, ...).

// A copy is "live" once it was published there and has not been ended since.
// Older Etsy records have no `state`, so a publish date stands in for it.
export const isLive = (info) => Boolean(info?.listingId) && (info.state ? info.state === 'active' : Boolean(info.publishedAt));
