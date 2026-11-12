// Reliability rules: token encryption, safe retries, and keeping a seller connected through temporary failures.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

// A small stand-in for Etsy. `replies` decides what the next requests get.
let replies = [];
let requests = [];
const fake = http.createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    requests.push({ method: req.method, url: req.url });
    const { status = 200, body = { ok: true }, headers = {} } = replies.shift() || {};
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(JSON.stringify(body));
  });
});
await new Promise((resolve) => { fake.listen(0, resolve); });
const fakeUrl = `http://localhost:${fake.address().port}`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'velista-rel-'));
Object.assign(process.env, {
  DATA_DIR: path.join(tmp, 'data'), UPLOAD_DIR: path.join(tmp, 'uploads'), SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
  ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', SYNC_INTERVAL_MINUTES: '0', REDIS_URL: '', SESSION_SECRET: 'reliability-test',
  ETSY_API_KEY: 'testkey', ETSY_API_BASE: fakeUrl, ETSY_TOKEN_URL: `${fakeUrl}/token`, TOKEN_ENCRYPTION_KEY: 'test-encryption-key',
});

const { initStore, store } = await import('../src/db/index.js');
const { config } = await import('../src/config/index.js');
const { etsyRequest } = await import('../src/services/marketplaces/etsy/client.js');
const { signup } = await import('../src/services/auth.service.js');
const { encryptSecret, decryptSecret } = await import('../src/utils/secrets.js');
const { fetchWithRetry } = await import('../src/utils/http.js');
const { maskSecrets } = await import('../src/utils/logger.js');
const { createApp } = await import('../src/app.js');

const noWait = { sleep: async () => {} };
const USER = '11111111-1111-4111-8111-111111111111';
const expired = () => ({
  userId: USER, accessToken: 'old-access', refreshToken: 'old-refresh', expiresAt: Date.now() - 1000, etsyUserId: 1, shopId: 2, shopName: 'Test Shop',
});
const newTokens = { body: { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 } };

before(async () => {
  fs.mkdirSync(process.env.DATA_DIR, { recursive: true });
  await initStore();
  await store.createUser({ id: USER, email: 'seller@example.com', name: 'Seller', passwordHash: 'x', settings: {}, createdAt: new Date().toISOString() });
});
after(() => fake.close());
beforeEach(() => { replies = []; requests = []; });

test('secrets: encrypted text reads back, and old plain tokens still work', () => {
  const stored = encryptSecret('my-token', 'key');
  assert.ok(stored.startsWith('enc:v1:'));
  assert.ok(!stored.includes('my-token'));
  assert.equal(decryptSecret(stored, 'key'), 'my-token');
  assert.equal(decryptSecret('plain-token', 'key'), 'plain-token');
  assert.equal(encryptSecret('my-token', ''), 'my-token');
});

test('secrets: a wrong or missing key gives a clear 503 and reveals nothing', () => {
  const stored = encryptSecret('my-token', 'key');
  assert.throws(() => decryptSecret(stored, 'other'), { status: 503 });
  assert.throws(() => decryptSecret(stored, ''), { status: 503 });
});

test('tokens are encrypted in the database', async () => {
  await store.saveConnection({ ...expired(), expiresAt: Date.now() + 3_600_000 });
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path.join(process.env.DATA_DIR, 'velista.db'));
  const row = db.prepare('SELECT access_token, refresh_token FROM etsy_connections WHERE user_id = ?').get(USER);
  db.close();
  assert.ok(row.access_token.startsWith('enc:v1:'));
  assert.ok(row.refresh_token.startsWith('enc:v1:'));
  assert.equal((await store.getConnection(USER)).accessToken, 'old-access');
});

test('logs hide secrets and keep error messages', () => {
  const masked = maskSecrets({ accessToken: 'abc', listingId: 'l1', err: new Error('boom') });
  assert.equal(masked.accessToken, '[hidden]');
  assert.equal(masked.listingId, 'l1');
  assert.equal(masked.err.message, 'boom');
});

test('retry: a GET is repeated after a 503', async () => {
  replies = [{ status: 503 }, { status: 200 }];
  const res = await fetchWithRetry(`${fakeUrl}/x`, {}, noWait);
  assert.equal(res.status, 200);
  assert.equal(requests.length, 2);
});

test('retry: a POST is not repeated after a 503, so no duplicate listing is created', async () => {
  replies = [{ status: 503 }, { status: 200 }];
  const res = await fetchWithRetry(`${fakeUrl}/x`, { method: 'POST' }, noWait);
  assert.equal(res.status, 503);
  assert.equal(requests.length, 1);
});

test('retry: a POST is repeated after a 429, and Retry-After is respected', async () => {
  replies = [{ status: 429, headers: { 'retry-after': '2' } }, { status: 201 }];
  const waits = [];
  const res = await fetchWithRetry(`${fakeUrl}/x`, { method: 'POST' }, { sleep: async (ms) => { waits.push(ms); } });
  assert.equal(res.status, 201);
  assert.deepEqual(waits, [2000]);
});

test('retry: stops waiting when Retry-After is too long', async () => {
  replies = [{ status: 429, headers: { 'retry-after': '3600' } }];
  const res = await fetchWithRetry(`${fakeUrl}/x`, {}, noWait);
  assert.equal(res.status, 429);
  assert.equal(requests.length, 1);
});

test('a temporary token failure keeps the seller connected', async () => {
  await store.saveConnection(expired());
  replies = [{ status: 500, body: { error: 'server_error' } }];
  await assert.rejects(etsyRequest(USER, { path: '/shops' }), { status: 503 });
  assert.ok(await store.getConnection(USER));
});

test('a wrong client secret does not disconnect sellers', async () => {
  await store.saveConnection(expired());
  replies = [{ status: 401, body: { error: 'invalid_client' } }];
  await assert.rejects(etsyRequest(USER, { path: '/shops' }), { status: 503 });
  assert.ok(await store.getConnection(USER));
});

test('a rejected grant asks the seller to reconnect', async () => {
  await store.saveConnection(expired());
  replies = [{ status: 400, body: { error: 'invalid_grant' } }];
  await assert.rejects(etsyRequest(USER, { path: '/shops' }), { status: 401 });
  assert.ok(!(await store.getConnection(USER)));
});

test('two requests at once share one token refresh', async () => {
  await store.saveConnection(expired());
  replies = [newTokens, { body: { a: 1 } }, { body: { a: 2 } }];
  await Promise.all([etsyRequest(USER, { path: '/one' }), etsyRequest(USER, { path: '/two' })]);
  assert.equal(requests.filter((r) => r.url === '/token').length, 1);
  assert.equal((await store.getConnection(USER)).accessToken, 'new-access');
});

test('signup allowlist blocks other emails when it is set', async () => {
  config.signupAllowlist = ['invited@example.com'];
  try {
    await assert.rejects(signup({ name: 'A', email: 'other@example.com', password: 'password123' }), { status: 403 });
    assert.ok(await signup({ name: 'B', email: 'invited@example.com', password: 'password123' }));
  } finally {
    config.signupAllowlist = [];
  }
});

test('every API response carries a request id', async () => {
  const server = createApp().listen(0);
  try {
    const res = await fetch(`http://localhost:${server.address().port}/api/health`);
    assert.match(res.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
  } finally {
    server.close();
  }
});
