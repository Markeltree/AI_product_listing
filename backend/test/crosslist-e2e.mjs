// End-to-end check of Etsy + eBay cross-listing against the local mocks, in a throwaway database:
// connect both marketplaces, publish to both, then simulate sales and run the cross-delist sync.
// Run: node test/crosslist-e2e.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const PORT = 3999;
const APP = `http://localhost:${PORT}`;
const ETSY = 'http://localhost:4011';
const EBAY = 'http://localhost:4021';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'velista-e2e-'));

// Isolated server: temporary SQLite + uploads, no AI keys (template copy), no background timer.
Object.assign(process.env, {
  PORT: String(PORT), APP_URL: APP, DATA_DIR: path.join(tmp, 'data'), UPLOAD_DIR: path.join(tmp, 'uploads'),
  SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', SYNC_INTERVAL_MINUTES: '0', REDIS_URL: '',
  ETSY_REDIRECT_URI: '', MOCK_ETSY_PORT: '4011', MOCK_EBAY_PORT: '4021', MOCK_EBAY_ACCEPT_URL: `${APP}/api/ebay/callback`,
  SESSION_SECRET: 'e2e-secret',
});
await import('./mock-etsy/dev.mjs');
await new Promise((r) => setTimeout(r, 300));

let token = '';
async function call(method, p, body, { form } = {}) {
  const headers = { authorization: `Bearer ${token}` };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`${APP}${p}`, { method, headers, body: payload, redirect: 'manual' });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, location: res.headers.get('location') };
}
// Follows an OAuth redirect chain (app -> mock -> app callback -> velista:// deep link) and returns the final URL.
async function followOAuth(start) {
  let url = start;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url, { redirect: 'manual', headers: url.startsWith(APP) ? { authorization: `Bearer ${token}` } : {} });
    const next = res.headers.get('location');
    if (!next) return url;
    url = new URL(next, url).toString();
    if (url.startsWith('velista://')) return url;
  }
  return url;
}
const step = (msg) => console.log(`\n✔ ${msg}`);

// ---------- account ----------
const signup = await call('POST', '/api/auth/signup', { name: 'E2E', email: `e2e${Date.now()}@test.dev`, password: 'correct-horse-9' });
assert.equal(signup.status, 201, JSON.stringify(signup.json));
token = signup.json.token;

// ---------- phone cannot reach a localhost callback: clear 409 instead of a dead page ----------
const phone = await new Promise((resolve) => {
  const req = http.request({
    host: 'localhost', port: PORT, path: '/api/etsy/connect-url', method: 'POST',
    headers: { host: `192.168.1.50:${PORT}`, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  }, (res) => { let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(d) })); });
  req.end('{"returnTo":"velista://settings"}');
});
assert.equal(phone.status, 409);
assert.equal(phone.json.code, 'callback_unreachable');
step(`phone + localhost callback -> 409: "${phone.json.error.slice(0, 90)}…"`);

// ---------- invite link: a shop owner connects with no Velista login ----------
{
  const { createInviteUrl } = await import('../src/services/etsyConnection.service.js');
  const me = (await call('GET', '/api/auth/me')).json.user;
  let url = createInviteUrl(me.id, 48);
  for (let i = 0; i < 6 && !url.includes('/api/connect/done'); i++) {
    const res = await fetch(url, { redirect: 'manual' }); // no Authorization header: the ticket is enough
    assert.ok(res.headers.get('location'), `no redirect from ${url} (${res.status}: ${await res.text()})`);
    url = new URL(res.headers.get('location'), url).toString();
  }
  assert.match(url, /\/api\/connect\/done\?etsy=connected/, url);
  const page = await (await fetch(url)).text();
  assert.match(page, /Your Etsy shop is connected/);
  assert.equal((await call('GET', '/api/etsy/status')).json.hasShop, true);
  const bad = await fetch(`${APP}/api/etsy/connect?ticket=forged.token`, { redirect: 'manual' });
  assert.equal(bad.status, 401);
  step('invite link: shop connected without a Velista login, done page shown, forged ticket rejected');
}

// ---------- connect Etsy and eBay ----------
const etsyEnd = await followOAuth(`${APP}/api/etsy/connect`);
assert.match(etsyEnd, /etsy=connected/, etsyEnd);
const ebayEnd = await followOAuth(`${APP}/api/ebay/connect`);
assert.match(ebayEnd, /ebay=connected/, ebayEnd);
let ebayStatus = (await call('GET', '/api/ebay/status')).json;
assert.equal(ebayStatus.connected, true);
assert.equal(ebayStatus.username, 'velista_test_seller');
assert.equal(ebayStatus.ready, false, 'two return policies + no location -> setup needed');
step(`connected Etsy and eBay (${ebayStatus.username}); setup needed: ${ebayStatus.setupProblem}`);

const setup = (await call('GET', '/api/ebay/setup')).json;
assert.equal(setup.policies.return.length, 2);
ebayStatus = (await call('PUT', '/api/ebay/prefs', { returnPolicyId: '6300', newLocation: { postalCode: '10001', country: 'us' }, condition: 'NEW' })).json;
assert.equal(ebayStatus.ready, true, JSON.stringify(ebayStatus));
step('eBay setup finished (return policy + ship-from location created)');

// ---------- create a listing ----------
const img = path.join(tmp, 'mug.jpg');
execFileSync((await import('ffmpeg-static')).default, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x88aa99:s=800x800', '-frames:v', '1', img]);
async function createListing(name, quantity) {
  const form = new FormData();
  form.append('product', JSON.stringify({
    name, type: 'Mug', materials: 'ceramic', colors: 'sage green', price: 32, quantity, taxonomyId: 1366, shippingProfileId: 7001,
  }));
  form.append('images', new Blob([fs.readFileSync(img)], { type: 'image/jpeg' }), 'mug.jpg');
  const res = await call('POST', '/api/listings', undefined, { form });
  assert.equal(res.status, 202, JSON.stringify(res.json));
  const { id } = res.json.listing;
  for (let i = 0; i < 50; i++) {
    const l = (await call('GET', `/api/listings/${id}`)).json.listing;
    if (l.status !== 'generating') return l;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('generation did not finish');
}
const a = await createListing('Sage green ceramic coffee mug handmade stoneware with a wide comfortable handle and speckled glaze', 2);
step(`listing generated: "${a.content.title}"`);

// ---------- publish to both ----------
const etsyPub = await call('POST', `/api/listings/${a.id}/publish`, { state: 'active' });
assert.equal(etsyPub.status, 200, JSON.stringify(etsyPub.json));
assert.equal(etsyPub.json.listing.etsy.state, 'active');
const ebayPub = await call('POST', `/api/listings/${a.id}/publish-ebay`, { state: 'active' });
assert.equal(ebayPub.status, 200, JSON.stringify(ebayPub.json));
const { ebay } = ebayPub.json.listing;
assert.ok(ebay.listingId && ebay.url.includes(ebay.listingId));
const ebayState = await (await fetch(`${EBAY}/__state`)).json();
const item = ebayState.items[ebay.sku];
assert.ok(item.product.title.length <= 80, `title ${item.product.title.length} chars`);
assert.deepEqual(item.product.aspects.Brand, ['Unbranded']);
assert.deepEqual(item.product.aspects.Material, ['Ceramic']);
assert.deepEqual(item.product.aspects.Type, ['Mug']);
assert.equal(item.availability.shipToLocationAvailability.quantity, 2);
assert.match(item.product.imageUrls[0], /ebayimg/);
step(`live on Etsy ${etsyPub.json.listing.etsy.url} and eBay ${ebay.url}`);
console.log(`   eBay title (${item.product.title.length}): ${item.product.title}`);
console.log(`   category: ${ebay.categoryPath}; aspects: ${JSON.stringify(item.product.aspects)}`);

// Re-publishing does not upload photos again or create a second offer.
const again = await call('POST', `/api/listings/${a.id}/publish-ebay`, { state: 'active' });
assert.equal(again.json.listing.ebay.offerId, ebay.offerId);
assert.equal(again.json.listing.ebay.listingId, ebay.listingId);

// ---------- 1 of 2 sells on Etsy -> eBay quantity drops to 1 ----------
const etsyId = etsyPub.json.listing.etsy.listingId;
await fetch(`${ETSY}/__sell?listing=${etsyId}&qty=1`, { method: 'POST' });
let sync = (await call('POST', '/api/listings/sync')).json;
assert.equal(sync.changes.length, 1, JSON.stringify(sync));
let ebayNow = await (await fetch(`${EBAY}/__state`)).json();
assert.equal(ebayNow.items[ebay.sku].availability.shipToLocationAvailability.quantity, 1);
step(`sync: ${sync.changes[0].action}`);

// Nothing changed -> sync does nothing.
sync = (await call('POST', '/api/listings/sync')).json;
assert.equal(sync.changes.length, 0);

// ---------- last one sells on eBay -> Etsy listing deactivated, listing ended ----------
await fetch(`${EBAY}/__sell?sku=${ebay.sku}&qty=1`, { method: 'POST' });
sync = (await call('POST', '/api/listings/sync')).json;
assert.equal(sync.changes.length, 1, JSON.stringify(sync));
const etsyNow = await (await fetch(`${ETSY}/__state`)).json();
assert.equal(etsyNow.listings.find((l) => l.listing_id === etsyId).state, 'inactive');
let ended = (await call('GET', `/api/listings/${a.id}`)).json.listing;
assert.equal(ended.status, 'ended');
assert.equal(ended.sync.reason, 'Sold on eBay');
step(`sync: ${sync.changes[0].action} -> status "${ended.status}"`);

// ---------- second listing: sells out on Etsy -> eBay withdrawn ----------
const b = await createListing('Speckled cup', 1);
await call('POST', `/api/listings/${b.id}/publish`, { state: 'active' });
const bEbay = (await call('POST', `/api/listings/${b.id}/publish-ebay`, { state: 'active' })).json.listing.ebay;
const bEtsy = (await call('GET', `/api/listings/${b.id}`)).json.listing.etsy;
await fetch(`${ETSY}/__sell?listing=${bEtsy.listingId}&qty=1`, { method: 'POST' });
sync = (await call('POST', '/api/listings/sync')).json;
ebayNow = await (await fetch(`${EBAY}/__state`)).json();
const bOffer = ebayNow.offers.find((o) => o.offerId === bEbay.offerId);
assert.equal(bOffer.listing.listingStatus, 'ENDED');
ended = (await call('GET', `/api/listings/${b.id}`)).json.listing;
assert.equal(ended.status, 'ended');
step(`sync: ${sync.changes[0].action}`);

// ---------- third listing: manual "end everywhere" ----------
const c = await createListing('Glass tumbler', 1);
await call('POST', `/api/listings/${c.id}/publish`, { state: 'active' });
await call('POST', `/api/listings/${c.id}/publish-ebay`, { state: 'active' });
const manual = await call('POST', `/api/listings/${c.id}/delist`, { channel: 'all' });
assert.equal(manual.status, 200, JSON.stringify(manual.json));
assert.equal(manual.json.listing.status, 'ended');
step('manual end everywhere -> both copies ended');

const summary = (await call('GET', '/api/listings')).json.listings.find((l) => l.id === a.id);
assert.equal(summary.endedReason, 'Sold on eBay');
assert.ok(summary.ebayUrl);

console.log('\nAll cross-listing checks passed.');
process.exit(0);
