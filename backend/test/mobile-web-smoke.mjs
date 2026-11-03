// End-to-end smoke test of the Expo app in its web build, against a running Velista server and mock Etsy.
// Requires: npm i -D playwright && npx playwright install chromium (or a system Chromium).
// Steps:
//   1. Server:  CORS_ORIGINS=http://localhost:8090 ETSY_API_KEY=testkey ETSY_API_BASE=http://localhost:4010/v3 \
//               ETSY_AUTHORIZE_URL=http://localhost:4010/oauth/connect ETSY_TOKEN_URL=http://localhost:4010/v3/public/oauth/token npm start
//   2. Mock:    npm run mock:etsy
//   3. Web app: cd mobile && EXPO_PUBLIC_API_URL=http://localhost:3000 npm run export:web, then serve mobile/dist with SPA fallback on :8090
//   4. Run:     node test/mobile-web-smoke.mjs
// The server URL is http://localhost:3000 by default; change API and APP below if yours differ.
import { chromium } from 'playwright';
import fs from 'node:fs';
// Test photos: replace these with any two JPG files on your machine.
const API = process.env.API_URL || 'http://localhost:3100', APP = process.env.APP_URL || 'http://localhost:8090', MOCK = 'http://localhost:4010';
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`);
const email = `mobile${Date.now()}@example.com`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts|ERR_TUNNEL|401|Failed to load resource|agent-proxy/i.test(m.text())) errors.push('CONSOLE ' + m.text()); });

try {
await page.goto(APP + '/', { waitUntil: 'networkidle' });
await page.getByText('Welcome back').waitFor({ timeout: 15000 });
check('login screen renders signed out', true);

// Create account
await page.getByText('Create account', { exact: true }).first().click();
await page.getByPlaceholder('Ayesha Khan').fill('Mobile Seller');
await page.getByPlaceholder('you@shop.com').fill(email);
await page.getByPlaceholder('At least 8 characters').fill('Sup3r-secure-pass');
await page.getByRole('button', { name: 'Create account' }).last().click();
await page.getByText('No listings yet').waitFor({ timeout: 15000 });
check('signup lands on empty Listings tab', true);

const token = await page.evaluate(() => localStorage.getItem('velista_session'));
check('session token stored', !!token && token.length > 50);
const auth = { Authorization: `Bearer ${token}` };

// Create a listing via API (photos + name), like a phone upload would
const form = new FormData();
form.append('product', JSON.stringify({ name: 'Linen Market Basket', type: 'Basket', price: null, quantity: 3, materials: 'linen', tone: 'warm', language: 'English' }));
form.append('images', new Blob([fs.readFileSync(process.env.PHOTO || '/tmp/vtest/a.jpg')], { type: 'image/jpeg' }), 'basket.jpg');
const created = await (await fetch(API + '/api/listings', { method: 'POST', headers: auth, body: form })).json();
const listingId = created.listing.id;

// Connect Etsy through the same ticket flow the phone uses (server side, redirects followed manually)
const ticketRes = await (await fetch(API + '/api/etsy/connect-url', { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ returnTo: 'velista://settings' }) })).json();
const r1 = await fetch(ticketRes.url, { redirect: 'manual' });
const r2 = await fetch(r1.headers.get('location'), { redirect: 'manual' });
const r3 = await fetch(r2.headers.get('location'), { redirect: 'manual' });
check('Etsy OAuth returns to the app deep link', (r3.headers.get('location') || '').startsWith('velista://settings?etsy=connected'), r3.headers.get('location'));

// Wait for the listing to finish generating, then reload to show the card
await new Promise((r) => setTimeout(r, 2500));
await page.reload({ waitUntil: 'networkidle' });
await page.getByText('Linen Market Basket').first().waitFor({ timeout: 15000 });
check('listing card appears on Listings tab', true);

// Open the editor
await page.getByText('Linen Market Basket').first().click();
await page.getByText('Edit listing').first().waitFor({ timeout: 15000 }).catch(() => {});
await page.getByLabel('Title').first().waitFor({ timeout: 15000 });
check('editor opens with the listing', true);

// Edit title and save
await page.getByLabel('Title').first().fill('Woven Linen Market Basket, Handmade');
await page.getByRole('button', { name: 'Save' }).first().click();
await page.getByText('Changes saved.').waitFor({ timeout: 10000 });
const saved = await (await fetch(API + `/api/listings/${listingId}`, { headers: auth })).json();
check('edited title saved to server', saved.listing.content.title === 'Woven Linen Market Basket, Handmade', saved.listing.content.title);

// Publish without category/shipping: validation should block it
await page.getByRole('button', { name: 'Publish to Etsy' }).first().click();
await page.getByText(/Fix \d+ items? first/).waitFor({ timeout: 10000 });
check('publish blocked until category and shipping are chosen', true);

// Choose a category
await page.getByLabel('Choose Etsy category').first().click();
await page.getByLabel('Search Etsy categories').first().fill('neck');
await page.getByText('Necklaces', { exact: true }).first().waitFor({ timeout: 10000 });
await page.getByText('Necklaces', { exact: true }).first().click();
check('category selected from Etsy taxonomy', true);

const readyVal = await page.getByLabel('Readiness state ID').first().inputValue();
check('readiness field is empty, not 0', readyVal === '', `value=${JSON.stringify(readyVal)}`);

// Choose shipping profile from the sheet
await page.getByLabel('Shipping profile').first().click();
await page.getByText('Standard shipping (PK)').first().waitFor({ timeout: 10000 });
await page.getByText('Standard shipping (PK)').first().click();

// Price is required too
await page.getByLabel('Price (USD)').first().fill('38');

// Publish
await page.getByRole('button', { name: 'Publish to Etsy' }).first().click();
await page.getByText('Live on Etsy').waitFor({ timeout: 20000 });
check('publish shows Live on Etsy', true);
const mock = await (await fetch(MOCK + '/__state')).json();
const ml = mock.listings.find((l) => l.title === 'Woven Linen Market Basket, Handmade');
check('Etsy received active listing with price and shipping', !!ml && ml.state === 'active' && String(ml.price) === '38.00' && String(ml.shipping_profile_id) === '7001', JSON.stringify({ state: ml?.state, price: ml?.price, ship: ml?.shipping_profile_id }));
check('Etsy received the photo', !!ml && ml.images.length === 1);

// Back from the editor to the tabs, then open Settings
await page.goBack();
await page.getByText('Settings', { exact: true }).last().click();
await page.getByText('Velista Test Shop').first().waitFor({ timeout: 10000 });
check('settings shows connected Etsy shop', true);

// Sign out. React Native Web's Alert is a no-op, so the confirm dialog is device-only.
// Verify the outcome instead: with the session cleared, the app must show the login screen.
await page.evaluate(() => localStorage.removeItem('velista_session'));
await page.reload({ waitUntil: 'networkidle' });
await page.getByText('Welcome back').waitFor({ timeout: 10000 }).catch(() => {});
check('cleared session returns to login', (await page.getByText('Welcome back').count()) > 0);
} catch (e) {
  check('FLOW STOPPED: ' + e.message.split('\n')[0].slice(0, 160), false);
  await page.screenshot({ path: 'artifacts/mobile-fail.png' });
}
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/mobile-smoke.txt', results.join('\n'));
console.log(results.join('\n'));
console.log('ERRORS:', JSON.stringify(errors.slice(0, 8), null, 1));
await browser.close();
