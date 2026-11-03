// Local stand-in for the Etsy Open API v3, used to test the full OAuth + publish flow offline.
// Run:  npm run mock:etsy   (port 4010)
// Then start the app with:
//   ETSY_API_KEY=testkey ETSY_API_BASE=http://localhost:4010/v3 \
//   ETSY_AUTHORIZE_URL=http://localhost:4010/oauth/connect ETSY_TOKEN_URL=http://localhost:4010/v3/public/oauth/token
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';

const PORT = Number(process.env.MOCK_ETSY_PORT || 4010);
const EXPIRES_IN = Number(process.env.MOCK_EXPIRES_IN || 3600);
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
app.use(express.urlencoded({ extended: true }));

const WHO = ['i_did', 'collective', 'someone_else'];
const WHEN = new Set(['made_to_order', '2020_2025', '2010_2019', '2000_2009', '1990s', '1980s', '1970s', '1960s', '1950s', '1940s', '1930s', '1920s', '1910s', '1900s', '1800s', '1700s', 'before_1700']);

const state = { codes: new Map(), tokens: new Map(), refresh: new Map(), listings: new Map(), nextListing: 123456, nextImage: 900, calls: [] };
const log = (entry) => state.calls.push({ at: new Date().toISOString(), ...entry });
const err = (res, status, error) => res.status(status).json({ error });

function requireKey(req, res, next) {
  if (!req.headers['x-api-key']) return err(res, 403, 'x-api-key header is required');
  next();
}
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const entry = state.tokens.get(token);
  if (!entry || entry.exp < Date.now()) return err(res, 401, 'invalid_token');
  req.user = entry;
  next();
}

app.get('/__state', (_req, res) => res.json({ listings: [...state.listings.values()], calls: state.calls.slice(-200) }));
app.post('/__reset', (_req, res) => {
  state.listings.clear(); state.calls = []; res.json({ ok: true });
});

// Authorize: auto-approves and redirects back with a code bound to the PKCE challenge.
app.get('/oauth/connect', (req, res) => {
  const { client_id, redirect_uri, scope, state: st, code_challenge, code_challenge_method, response_type } = req.query;
  if (response_type !== 'code' || !client_id || !code_challenge || code_challenge_method !== 'S256') return res.status(400).send('bad authorize request');
  const code = crypto.randomBytes(12).toString('hex');
  state.codes.set(code, { challenge: code_challenge, client_id, scope });
  const back = new URL(redirect_uri);
  back.searchParams.set('code', code);
  back.searchParams.set('state', st);
  log({ route: 'authorize', scope });
  res.redirect(back.toString());
});

app.post('/v3/public/oauth/token', (req, res) => {
  const { grant_type } = req.body;
  if (grant_type === 'authorization_code') {
    const entry = state.codes.get(req.body.code);
    if (!entry) return err(res, 400, 'invalid_grant');
    const challenge = crypto.createHash('sha256').update(req.body.code_verifier || '').digest('base64url');
    if (challenge !== entry.challenge) return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verifier mismatch' });
    state.codes.delete(req.body.code);
  } else if (grant_type === 'refresh_token') {
    if (!state.refresh.has(req.body.refresh_token)) return res.status(400).json({ error: 'invalid_grant' });
  } else {
    return err(res, 400, 'unsupported_grant_type');
  }
  const access = crypto.randomBytes(20).toString('hex');
  const refresh = crypto.randomBytes(20).toString('hex');
  state.tokens.set(access, { exp: Date.now() + EXPIRES_IN * 1000 });
  state.refresh.set(refresh, true);
  log({ route: 'token', grant_type });
  res.json({ access_token: `${access}`, refresh_token: refresh, expires_in: EXPIRES_IN, token_type: 'Bearer' });
});

const APP = express.Router();
APP.use(requireKey);
APP.get('/application/seller-taxonomy/nodes', (req, res) => {
  res.json({
    results: [
      { id: 68, name: 'Jewelry', level: 1, children: [
        { id: 69, name: 'Necklaces', level: 2, children: [] },
        { id: 70, name: 'Earrings', level: 2, children: [] },
      ] },
      { id: 1, name: 'Home & Living', level: 1, children: [
        { id: 1366, name: 'Mugs', level: 2, children: [] },
        { id: 1367, name: 'Candles', level: 2, children: [] },
      ] },
    ],
  });
});

APP.use(requireAuth);
APP.get('/application/users/me', (req, res) => res.json({ user_id: 555, shop_id: 9001 }));
APP.get('/application/users/:uid/shops', (req, res) => res.json({ shop_id: 9001, shop_name: 'Velista Test Shop' }));
APP.get('/application/shops/:sid/shipping-profiles', (req, res) => res.json({
  count: 2,
  results: [
    { shipping_profile_id: 7001, title: 'Standard shipping (PK)', origin_country_iso: 'PK' },
    { shipping_profile_id: 7002, title: 'Express worldwide', origin_country_iso: 'PK' },
  ],
}));

function validateListingFields(b, { creating }) {
  if (creating) {
    for (const k of ['quantity', 'title', 'description', 'price', 'who_made', 'when_made', 'taxonomy_id']) {
      if (b[k] === undefined || b[k] === '') return `${k} is required`;
    }
  }
  if (b.title !== undefined && String(b.title).length > 140) return 'title must be 140 characters or fewer';
  if (b.title !== undefined && /FAIL/.test(b.title)) return 'title contains a banned word (test)';
  if (b.who_made !== undefined && !WHO.includes(b.who_made)) return 'who_made is invalid';
  if (b.when_made !== undefined && !WHEN.has(b.when_made)) return 'when_made is invalid';
  if (b.price !== undefined && !(Number(b.price) >= 0.2)) return 'price must be at least 0.20';
  if (b.tags !== undefined && String(b.tags).split(',').some((t) => t.length > 20)) return 'tags must be 20 characters or fewer';
  if (b.tags !== undefined && String(b.tags).split(',').filter(Boolean).length > 13) return 'at most 13 tags';
  return null;
}

APP.post('/application/shops/:sid/listings', (req, res) => {
  const problem = validateListingFields(req.body, { creating: true });
  if (problem) return err(res, 400, problem);
  const id = state.nextListing++;
  state.listings.set(id, { listing_id: id, shop_id: Number(req.params.sid), state: 'draft', images: [], ...req.body });
  log({ route: 'createDraftListing', body: req.body });
  res.status(201).json({ listing_id: id, state: 'draft' });
});

APP.patch('/application/shops/:sid/listings/:lid', (req, res) => {
  const l = state.listings.get(Number(req.params.lid));
  if (!l) return err(res, 404, 'listing not found');
  const problem = validateListingFields(req.body, { creating: false });
  if (problem) return err(res, 400, problem);
  if (req.body.state === 'active' && !l.images.length) return err(res, 400, 'an active listing needs at least one image');
  if (req.body.state === 'active' && !l.shipping_profile_id) return err(res, 400, 'shipping_profile_id is required for physical listings');
  Object.assign(l, req.body);
  log({ route: 'updateListing', listing: l.listing_id, body: req.body });
  res.json({ listing_id: l.listing_id, state: l.state });
});

APP.post('/application/shops/:sid/listings/:lid/images', upload.single('image'), (req, res) => {
  const l = state.listings.get(Number(req.params.lid));
  if (!l) return err(res, 404, 'listing not found');
  if (!req.file) return err(res, 400, 'image file is required');
  const imageId = state.nextImage++;
  l.images.push({ listing_image_id: imageId, bytes: req.file.size, type: req.file.mimetype, alt_text: req.body.alt_text || '' });
  log({ route: 'uploadListingImage', listing: l.listing_id, bytes: req.file.size, alt: req.body.alt_text });
  res.status(201).json({ listing_image_id: imageId });
});

// Listing state and inventory, used by the cross-delist sync.
APP.get('/application/listings/:lid', (req, res) => {
  const l = state.listings.get(Number(req.params.lid));
  if (!l) return err(res, 404, 'listing not found');
  res.json({ listing_id: l.listing_id, state: l.state, quantity: Number(l.quantity) });
});
APP.get('/application/listings/:lid/inventory', (req, res) => {
  const l = state.listings.get(Number(req.params.lid));
  if (!l) return err(res, 404, 'listing not found');
  res.json({
    products: [{ sku: '', property_values: [], offerings: [{ price: { amount: Math.round(Number(l.price) * 100), divisor: 100 }, quantity: Number(l.quantity), is_enabled: true }] }],
    price_on_property: [], quantity_on_property: [], sku_on_property: [],
  });
});
APP.put('/application/listings/:lid/inventory', express.json(), (req, res) => {
  const l = state.listings.get(Number(req.params.lid));
  if (!l) return err(res, 404, 'listing not found');
  const offering = req.body?.products?.[0]?.offerings?.[0];
  if (!offering || !(Number(offering.price) > 0)) return err(res, 400, 'products[0].offerings[0].price is required');
  l.quantity = offering.quantity;
  if (Number(l.quantity) === 0) l.state = 'sold_out';
  log({ route: 'updateListingInventory', listing: l.listing_id, quantity: l.quantity });
  res.json(req.body);
});

// Simulates a buyer purchasing `qty` units on Etsy.
app.post('/__sell', (req, res) => {
  const l = state.listings.get(Number(req.query.listing));
  if (!l) return err(res, 404, 'listing not found');
  l.quantity = Math.max(0, Number(l.quantity) - Number(req.query.qty || 1));
  if (l.quantity === 0) l.state = 'sold_out';
  res.json({ quantity: l.quantity, state: l.state });
});

app.use('/v3', APP);
app.use((_req, res) => err(res, 404, 'not found'));

app.listen(PORT, () => console.log(`Mock Etsy API on http://localhost:${PORT}  (expires_in=${EXPIRES_IN}s)`));
