// Security behaviour over real HTTP: Helmet headers, input validation, XSS stripping and rate limits.
// Runs the app on a random port with a throwaway SQLite database and no AI keys.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'velista-sec-'));
Object.assign(process.env, {
  DATA_DIR: path.join(tmp, 'data'), UPLOAD_DIR: path.join(tmp, 'uploads'), SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
  ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', SYNC_INTERVAL_MINUTES: '0', REDIS_URL: '', SESSION_SECRET: 'security-test', TRUST_PROXY: '1',
});
const { createApp } = await import('../src/app.js');
const { initStore } = await import('../src/db/index.js');
const { stripHtml, clean, cleanMultiline } = await import('../src/utils/text.js');

let server;
let base;
before(async () => {
  fs.mkdirSync(process.env.DATA_DIR, { recursive: true });
  await initStore();
  server = createApp().listen(0);
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

// Each test uses its own fake client IP, so rate limits from one test do not affect another.
let ipCounter = 10;
const newIp = () => `203.0.113.${ipCounter++}`;
async function call(method, p, { body, token, ip = '198.51.100.1', form } = {}) {
  const headers = { 'x-forwarded-for': ip };
  if (token) headers.authorization = `Bearer ${token}`;
  let payload = form;
  if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`${base}${p}`, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, headers: res.headers };
}
async function signup(ip = newIp()) {
  const email = `u${Date.now()}${Math.random().toString(36).slice(2, 6)}@test.dev`;
  const res = await call('POST', '/api/auth/signup', { ip, body: { name: 'Tester', email, password: 'correct-horse-9' } });
  assert.equal(res.status, 201, JSON.stringify(res.json));
  return { token: res.json.token, email };
}

// ---------- Helmet ----------

test('secure headers are set on API responses', async () => {
  const { headers } = await call('GET', '/api/health');
  assert.match(headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.match(headers.get('strict-transport-security'), /max-age=15552000/);
  assert.equal(headers.get('referrer-policy'), 'no-referrer');
  assert.equal(headers.get('cache-control'), 'no-store');
  assert.equal(headers.get('x-powered-by'), null);
});

// ---------- input validation ----------

test('signup rejects bad input with a readable message', async () => {
  const ip = newIp();
  let res = await call('POST', '/api/auth/signup', { ip, body: { name: 'A B', email: 'not-an-email', password: 'correct-horse-9' } });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'Enter a valid email address.');
  res = await call('POST', '/api/auth/signup', { ip, body: { name: 'A B', email: 'a@b.co', password: 'x'.repeat(500) } });
  assert.equal(res.status, 400);
  assert.match(res.json.error, /at most 128/);
  res = await call('POST', '/api/auth/signup', { ip, body: ['not', 'an', 'object'] });
  assert.equal(res.status, 400);
});

test('emails are normalised before sign-in', async () => {
  const { email } = await signup();
  const res = await call('POST', '/api/auth/login', { ip: newIp(), body: { email: `  ${email.toUpperCase()} `, password: 'correct-horse-9' } });
  assert.equal(res.status, 200);
});

test('malformed ids and bodies are rejected before reaching the database', async () => {
  const { token } = await signup();
  let res = await call('GET', '/api/listings/not-a-uuid', { token });
  assert.equal(res.status, 404);
  res = await call('GET', '/api/listings/..%2F..%2Fetc/media/x', { token });
  assert.equal(res.status, 404);
  res = await call('POST', '/api/listings/7f1d7c8e-1d1c-4b8e-9f4e-0f8f5c1a2b3c/publish', { token, body: { state: 'hacked' } });
  assert.equal(res.status, 400);
  assert.equal(res.json.field, 'state');
  res = await call('PUT', '/api/listings/7f1d7c8e-1d1c-4b8e-9f4e-0f8f5c1a2b3c', { token, body: { content: { title: 42 } } });
  assert.equal(res.status, 400);
  assert.equal(res.json.field, 'content.title');
  res = await call('PUT', '/api/ebay/prefs', { token, body: { condition: 'BROKEN' } });
  assert.equal(res.status, 400);
});

// ---------- XSS ----------

test('HTML and scripts are stripped from text, ordinary symbols are kept', () => {
  assert.equal(clean('<script>alert(1)</script>Sage <b>green</b> mug<img src=x onerror=alert(1)>'), 'Sage green mug');
  assert.equal(clean('Fits cups < 5 cm & loved <3'), 'Fits cups < 5 cm & loved <3');
  assert.equal(stripHtml('a\u0000b\u0007c'), 'abc');
  assert.equal(cleanMultiline('Line one  \n\n\n\n<iframe src=evil></iframe>- Item <i>two</i>'), 'Line one\n\n- Item two');
});

test('listing text saved through the API is stored without HTML', async () => {
  const { token } = await signup();
  const form = new FormData();
  form.append('product', JSON.stringify({ name: 'Mug <script>x()</script>', type: 'Mug', price: 20 }));
  form.append('images', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])], { type: 'image/jpeg' }), 'a.jpg');
  const created = await call('POST', '/api/listings', { token, form });
  assert.equal(created.status, 202, JSON.stringify(created.json));
  const { id } = created.json.listing;
  for (let i = 0; i < 50; i++) {
    if ((await call('GET', `/api/listings/${id}`, { token })).json.listing.status !== 'generating') break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const res = await call('PUT', `/api/listings/${id}`, {
    token,
    body: { content: { title: 'Handmade <img src=x onerror=alert(1)>mug', description: '<script>steal()</script>Lovely mug.\n- Ceramic' } },
  });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.listing.content.title, 'Handmade mug');
  assert.equal(res.json.listing.content.description, 'Lovely mug.\n- Ceramic');
  assert.equal(res.json.listing.product.name, 'Mug');
});

// ---------- rate limits ----------

test('repeated failed sign-ins are blocked, per client', async () => {
  const ip = newIp();
  const { email } = await signup();
  let last;
  for (let i = 0; i < 11; i++) last = await call('POST', '/api/auth/login', { ip, body: { email, password: 'wrong-password' } });
  assert.equal(last.status, 429);
  assert.equal(last.json.code, 'rate_limited');
  assert.ok(last.headers.get('retry-after'));
  assert.ok(last.headers.get('ratelimit-policy'));
  // Another client (a different forwarded IP) is not affected.
  const other = await call('POST', '/api/auth/login', { ip: newIp(), body: { email, password: 'correct-horse-9' } });
  assert.equal(other.status, 200);
});

test('signups are limited per network', async () => {
  const ip = newIp();
  const statuses = [];
  for (let i = 0; i < 6; i++) {
    statuses.push((await call('POST', '/api/auth/signup', { ip, body: { name: 'Spam', email: `s${i}${Date.now()}@t.dev`, password: 'correct-horse-9' } })).status);
  }
  assert.deepEqual(statuses, [201, 201, 201, 201, 201, 429]);
});
