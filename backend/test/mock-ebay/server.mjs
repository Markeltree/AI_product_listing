// Local stand-in for the eBay Sell APIs (OAuth, Identity, Account, Inventory, Taxonomy, Media),
// used to test connect, publish and the cross-delist sync offline. Started by npm run dev:mock.
//   GET  /__state                 what eBay would hold
//   POST /__sell?sku=...&qty=1    simulate a buyer purchasing `qty` units
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';

const PORT = Number(process.env.MOCK_EBAY_PORT || 4020);
const ACCEPT_URL = process.env.MOCK_EBAY_ACCEPT_URL || 'http://localhost:3000/api/ebay/callback';
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const state = {
  codes: new Set(), tokens: new Set(), refresh: new Set(), images: new Map(), items: new Map(), offers: new Map(),
  locations: new Map(), nextOffer: 5000, nextListing: 110000000001, calls: [],
};
const log = (entry) => state.calls.push({ at: new Date().toISOString(), ...entry });
const fail = (res, status, errorId, message) => res.status(status).json({ errors: [{ errorId, message, longMessage: message }] });

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!state.tokens.has(token)) return fail(res, 401, 1001, 'Invalid access token');
  next();
}

app.get('/__state', (_req, res) => res.json({
  items: Object.fromEntries(state.items), offers: [...state.offers.values()], calls: state.calls.slice(-100),
}));
app.post('/__sell', (req, res) => {
  const item = state.items.get(req.query.sku);
  if (!item) return res.status(404).json({ error: 'no such sku' });
  const q = item.availability.shipToLocationAvailability;
  q.quantity = Math.max(0, q.quantity - Number(req.query.qty || 1));
  const offer = [...state.offers.values()].find((o) => o.sku === req.query.sku);
  if (offer && q.quantity === 0 && offer.listing) offer.listing.listingStatus = 'OUT_OF_STOCK';
  res.json({ quantity: q.quantity });
});

// ---------- OAuth ----------
app.get('/oauth2/authorize', (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state: st } = req.query;
  if (response_type !== 'code' || !client_id || !redirect_uri || !scope) return res.status(400).send('bad authorize request');
  const code = crypto.randomBytes(12).toString('hex');
  state.codes.add(code);
  const back = new URL(ACCEPT_URL); // eBay maps the RuName to its "auth accepted URL"
  back.searchParams.set('state', st);
  back.searchParams.set('code', code);
  log({ route: 'authorize', ruName: redirect_uri });
  res.redirect(back.toString());
});

app.post('/identity/v1/oauth2/token', (req, res) => {
  if (!String(req.headers.authorization || '').startsWith('Basic ')) return res.status(401).json({ error: 'invalid_client' });
  const { grant_type } = req.body;
  if (grant_type === 'authorization_code' && !state.codes.delete(req.body.code)) return res.status(400).json({ error: 'invalid_grant' });
  if (grant_type === 'refresh_token' && !state.refresh.has(req.body.refresh_token)) return res.status(400).json({ error: 'invalid_grant' });
  const access = `v^1.1#${crypto.randomBytes(16).toString('hex')}`;
  state.tokens.add(access);
  const out = { access_token: access, expires_in: 7200, token_type: 'User Access Token' };
  if (grant_type === 'authorization_code') {
    out.refresh_token = crypto.randomBytes(16).toString('hex');
    out.refresh_token_expires_in = 47304000;
    state.refresh.add(out.refresh_token);
  }
  log({ route: 'token', grant_type });
  res.json(out);
});

app.get('/commerce/identity/v1/user/', auth, (_req, res) => res.json({ userId: 'u-777', username: 'velista_test_seller' }));

// ---------- account ----------
const policies = {
  fulfillment_policy: { fulfillmentPolicies: [{ fulfillmentPolicyId: '6100', name: 'USPS Ground Advantage' }] },
  payment_policy: { paymentPolicies: [{ paymentPolicyId: '6200', name: 'eBay managed payments' }] },
  return_policy: { returnPolicies: [{ returnPolicyId: '6300', name: '30 days returns' }, { returnPolicyId: '6301', name: 'No returns' }] },
};
for (const [p, body] of Object.entries(policies)) app.get(`/sell/account/v1/${p}`, auth, (_req, res) => res.json(body));
app.post('/sell/account/v1/program/opt_in', auth, (_req, res) => res.json({}));

// ---------- inventory: locations ----------
app.get('/sell/inventory/v1/location', auth, (_req, res) => res.json({ locations: [...state.locations.values()] }));
app.post('/sell/inventory/v1/location/:key', auth, (req, res) => {
  if (state.locations.has(req.params.key)) return fail(res, 409, 25803, 'Location already exists');
  if (!req.body.location?.address?.postalCode) return fail(res, 400, 25802, 'postalCode is required');
  state.locations.set(req.params.key, { merchantLocationKey: req.params.key, ...req.body });
  res.status(204).end();
});
app.post('/sell/inventory/v1/location/:key/update_location_details', auth, (req, res) => {
  const loc = state.locations.get(req.params.key);
  if (!loc) return fail(res, 404, 25804, 'Location not found');
  Object.assign(loc, req.body);
  res.status(204).end();
});

// ---------- taxonomy (application token is fine) ----------
app.get('/commerce/taxonomy/v1/get_default_category_tree_id', auth, (_req, res) => res.json({ categoryTreeId: '0' }));
app.get('/commerce/taxonomy/v1/category_tree/0/get_category_suggestions', auth, (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const mug = q.includes('mug') || q.includes('cup');
  res.json({ categorySuggestions: [{
    category: mug ? { categoryId: '20625', categoryName: 'Mugs' } : { categoryId: '99', categoryName: 'Other Crafts' },
    categoryTreeNodeAncestors: mug
      ? [{ categoryName: 'Kitchen, Dining & Bar' }, { categoryName: 'Home & Garden' }]
      : [{ categoryName: 'Crafts' }],
  }] });
});
app.get('/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category', auth, (_req, res) => res.json({ aspects: [
  { localizedAspectName: 'Brand', aspectConstraint: { aspectRequired: true, aspectMode: 'FREE_TEXT' } },
  { localizedAspectName: 'Type', aspectConstraint: { aspectRequired: true, aspectMode: 'FREE_TEXT' } },
  { localizedAspectName: 'Color', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', itemToAspectCardinality: 'MULTI' } },
  { localizedAspectName: 'Material', aspectConstraint: { aspectRequired: true, aspectMode: 'SELECTION_ONLY' },
    aspectValues: [{ localizedValue: 'Ceramic' }, { localizedValue: 'Glass' }, { localizedValue: 'Does Not Apply' }] },
] }));

// ---------- media ----------
app.post('/commerce/media/v1_beta/image/create_image_from_file', auth, upload.single('image'), (req, res) => {
  if (!req.file) return fail(res, 400, 190000, 'image file is required');
  const id = `img-${crypto.randomBytes(6).toString('hex')}`;
  state.images.set(id, { bytes: req.file.size, type: req.file.mimetype });
  res.status(201).location(`http://localhost:${PORT}/commerce/media/v1_beta/image/${id}`).end();
});
app.get('/commerce/media/v1_beta/image/:id', auth, (req, res) => {
  if (!state.images.has(req.params.id)) return fail(res, 404, 190002, 'image not found');
  res.json({ imageUrl: `https://i.ebayimg.example/images/${req.params.id}/s-l1600.jpg` });
});

// ---------- inventory items and offers ----------
app.put('/sell/inventory/v1/inventory_item/:sku', auth, (req, res) => {
  const b = req.body;
  if (!req.headers['content-language']) return fail(res, 400, 25709, 'Content-Language header is required');
  if (!b.product?.title || b.product.title.length > 80) return fail(res, 400, 25005, 'title must be 1-80 characters');
  if (!b.product.imageUrls?.length) return fail(res, 400, 25005, 'at least one image is required');
  state.items.set(req.params.sku, b);
  log({ route: 'createOrReplaceInventoryItem', sku: req.params.sku, aspects: b.product.aspects });
  res.status(204).end();
});
app.get('/sell/inventory/v1/inventory_item/:sku', auth, (req, res) => {
  const item = state.items.get(req.params.sku);
  return item ? res.json({ sku: req.params.sku, ...item }) : fail(res, 404, 25710, 'not found');
});

function checkOffer(b) {
  for (const k of ['sku', 'marketplaceId', 'format', 'categoryId', 'merchantLocationKey']) if (!b[k]) return `${k} is required`;
  const lp = b.listingPolicies || {};
  if (!lp.fulfillmentPolicyId || !lp.paymentPolicyId || !lp.returnPolicyId) return 'listingPolicies are required';
  if (!(Number(b.pricingSummary?.price?.value) > 0)) return 'price is required';
  return null;
}
app.get('/sell/inventory/v1/offer', auth, (req, res) => {
  const offers = [...state.offers.values()].filter((o) => o.sku === req.query.sku);
  return offers.length ? res.json({ offers }) : fail(res, 404, 25713, 'no offers');
});
app.post('/sell/inventory/v1/offer', auth, (req, res) => {
  const problem = checkOffer(req.body);
  if (problem) return fail(res, 400, 25002, problem);
  if ([...state.offers.values()].some((o) => o.sku === req.body.sku)) return fail(res, 400, 25002, 'Offer entity already exists');
  const offerId = String(state.nextOffer++);
  state.offers.set(offerId, { offerId, status: 'UNPUBLISHED', ...req.body });
  log({ route: 'createOffer', offerId });
  res.status(201).json({ offerId });
});
app.put('/sell/inventory/v1/offer/:id', auth, (req, res) => {
  const offer = state.offers.get(req.params.id);
  if (!offer) return fail(res, 404, 25713, 'offer not found');
  const problem = checkOffer(req.body);
  if (problem) return fail(res, 400, 25002, problem);
  Object.assign(offer, req.body);
  res.status(204).end();
});
app.get('/sell/inventory/v1/offer/:id', auth, (req, res) => {
  const offer = state.offers.get(req.params.id);
  return offer ? res.json(offer) : fail(res, 404, 25713, 'offer not found');
});
app.post('/sell/inventory/v1/offer/:id/publish', auth, (req, res) => {
  const offer = state.offers.get(req.params.id);
  if (!offer) return fail(res, 404, 25713, 'offer not found');
  const item = state.items.get(offer.sku);
  const missing = ['Brand', 'Type', 'Material'].filter((a) => !item?.product?.aspects?.[a]?.length);
  if (missing.length) return fail(res, 400, 25002, `Missing item specific: ${missing.join(', ')}`);
  if (!offer.listing || offer.listing.listingStatus !== 'ACTIVE') {
    offer.listing = { listingId: String(state.nextListing++), listingStatus: 'ACTIVE' };
  }
  offer.status = 'PUBLISHED';
  log({ route: 'publishOffer', offerId: offer.offerId, listingId: offer.listing.listingId });
  res.json({ listingId: offer.listing.listingId });
});
app.post('/sell/inventory/v1/offer/:id/withdraw', auth, (req, res) => {
  const offer = state.offers.get(req.params.id);
  if (!offer) return fail(res, 404, 25713, 'offer not found');
  offer.status = 'UNPUBLISHED';
  if (offer.listing) offer.listing.listingStatus = 'ENDED';
  log({ route: 'withdrawOffer', offerId: offer.offerId });
  res.json({ listingId: offer.listing?.listingId });
});
app.post('/sell/inventory/v1/bulk_update_price_quantity', auth, (req, res) => {
  for (const r of req.body.requests || []) {
    const item = state.items.get(r.sku);
    if (item && r.shipToLocationAvailability) item.availability.shipToLocationAvailability.quantity = r.shipToLocationAvailability.quantity;
    for (const o of r.offers || []) if (state.offers.get(o.offerId)) state.offers.get(o.offerId).availableQuantity = o.availableQuantity;
  }
  log({ route: 'bulkUpdatePriceQuantity', body: req.body });
  res.json({ responses: [] });
});

app.use((req, res) => fail(res, 404, 2002, `mock eBay: no route ${req.method} ${req.path}`));
app.listen(PORT, () => console.log(`Mock eBay API on http://localhost:${PORT}`));
