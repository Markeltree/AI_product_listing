// Haul uploads, object storage signing, database upgrades and listing pages.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'velista-haul-'));
Object.assign(process.env, {
  DATA_DIR: path.join(tmp, 'data'), UPLOAD_DIR: path.join(tmp, 'uploads'), SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
  ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', SYNC_INTERVAL_MINUTES: '0', REDIS_URL: '', SESSION_SECRET: 'haul-test', S3_BUCKET: '', ALLOWED_SIGNUP_EMAILS: '',
});

// A database from before hauls existed, to prove an upgrade keeps its rows.
fs.mkdirSync(process.env.DATA_DIR, { recursive: true });
const oldDb = new DatabaseSync(path.join(process.env.DATA_DIR, 'velista.db'));
oldDb.exec(`CREATE TABLE listings (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, status TEXT NOT NULL, title TEXT,
  data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
oldDb.prepare('INSERT INTO listings VALUES (?, ?, ?, ?, ?, ?, ?)').run('old-listing', 'old-user', 'draft', 'Old', JSON.stringify({
  id: 'old-listing', userId: 'old-user', status: 'draft', product: { name: 'Old mug', price: 12 }, content: { title: 'Old mug' }, media: [],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
}), '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
oldDb.close();

const { createApp } = await import('../src/app.js');
const { initStore, store } = await import('../src/db/index.js');
const { listSummaries } = await import('../src/services/listing.service.js');
const { s3Storage } = await import('../src/storage/s3.js');
const { MAX_HAUL_VIDEO_BYTES } = await import('../src/config/constants.js');

let server;
let base;
let token;

const api = async (method, p, { body, auth = token } = {}) => {
  const headers = {};
  if (auth) headers.authorization = `Bearer ${auth}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${base}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};
const newHaul = () => api('POST', '/api/hauls', { body: { mime: 'video/mp4', size: 1000 } });

before(async () => {
  await initStore();
  server = createApp().listen(0);
  base = `http://localhost:${server.address().port}`;
  const res = await api('POST', '/api/auth/signup', { auth: null, body: { name: 'Seller', email: 'haul@example.com', password: 'Sup3r-secure-pass' } });
  token = res.json.token;
});
after(() => server.close());

test('a haul goes from uploading to queued', async () => {
  const { status, json } = await newHaul();
  assert.equal(status, 201);
  assert.equal(json.haul.status, 'uploading');
  assert.equal(json.haul.sourceKey, undefined);

  const early = await api('POST', `/api/hauls/${json.haul.id}/complete`);
  assert.equal(early.status, 409);

  const put = await fetch(json.upload.url.replace(/^https?:\/\/[^/]+/, base), { method: json.upload.method, headers: json.upload.headers, body: Buffer.alloc(1000, 1) });
  assert.equal(put.status, 204);

  const done = await api('POST', `/api/hauls/${json.haul.id}/complete`);
  assert.equal(done.json.haul.status, 'queued');
  assert.equal(done.json.haul.sourceSize, 1000);

  const again = await api('POST', `/api/hauls/${json.haul.id}/complete`);
  assert.equal(again.status, 200);
  assert.equal((await api('GET', '/api/hauls')).json.hauls.length, 1);
});

test('an upload ticket works for its own haul only, and cannot sign in', async () => {
  const first = (await newHaul()).json;
  const second = (await newHaul()).json;
  const ticket = new URL(first.upload.url).searchParams.get('ticket');

  const wrongHaul = await fetch(`${base}/api/hauls/${second.haul.id}/upload?ticket=${encodeURIComponent(ticket)}`, { method: 'PUT', headers: { 'content-type': 'video/mp4' }, body: 'x' });
  assert.equal(wrongHaul.status, 401);
  assert.equal((await api('GET', '/api/hauls', { auth: ticket })).status, 401);
  const noTicket = await fetch(`${base}/api/hauls/${first.haul.id}/upload`, { method: 'PUT', headers: { 'content-type': 'video/mp4' }, body: 'x' });
  assert.equal(noTicket.status, 401);
});

test('other sellers cannot see or delete a haul', async () => {
  const { haul } = (await newHaul()).json;
  const other = await api('POST', '/api/auth/signup', { auth: null, body: { name: 'Other', email: 'other@example.com', password: 'Sup3r-secure-pass' } });
  assert.equal((await api('GET', `/api/hauls/${haul.id}`, { auth: other.json.token })).status, 404);
  assert.equal((await api('DELETE', `/api/hauls/${haul.id}`, { auth: other.json.token })).status, 404);
  assert.equal((await api('GET', `/api/hauls/${haul.id}`)).status, 200);
});

test('wrong file types and oversized videos are refused', async () => {
  assert.equal((await api('POST', '/api/hauls', { body: { mime: 'image/png', size: 1000 } })).status, 400);
  assert.equal((await api('POST', '/api/hauls', { body: { mime: 'video/mp4', size: MAX_HAUL_VIDEO_BYTES + 1 } })).status, 413);
  assert.equal((await api('POST', '/api/hauls', { auth: null, body: { mime: 'video/mp4', size: 1000 } })).status, 401);
});

test('deleting a haul removes its video', async () => {
  const { haul, upload } = (await newHaul()).json;
  await fetch(upload.url.replace(/^https?:\/\/[^/]+/, base), { method: 'PUT', headers: upload.headers, body: 'video' });
  const stored = await store.getHaul((await store.findUserByEmail('haul@example.com')).id, haul.id);
  const file = path.join(process.env.UPLOAD_DIR, stored.sourceKey);
  assert.ok(fs.existsSync(file));
  assert.equal((await api('DELETE', `/api/hauls/${haul.id}`)).status, 204);
  assert.ok(!fs.existsSync(file));
});

test('s3 storage signs uploads and reads file sizes', async () => {
  const requests = [];
  const bucket = http.createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, auth: req.headers.authorization });
    if (req.url.includes('missing')) res.writeHead(404);
    else res.writeHead(200, { 'content-length': '42' });
    res.end();
  });
  await new Promise((resolve) => { bucket.listen(0, resolve); });
  try {
    const s3 = s3Storage({ endpoint: `http://localhost:${bucket.address().port}/`, bucket: 'velista', accessKeyId: 'key', secretAccessKey: 'secret' });
    const upload = await s3.createUpload({ key: 'u/hauls/h/source.mp4', mime: 'video/mp4' });
    const url = new URL(upload.url);
    assert.equal(url.pathname, '/velista/u/hauls/h/source.mp4');
    assert.equal(url.searchParams.get('X-Amz-Expires'), '3600');
    assert.ok(url.searchParams.get('X-Amz-Signature'));
    assert.ok(!upload.url.includes('secret'));

    assert.deepEqual(await s3.stat('present.mp4'), { size: 42 });
    assert.equal(await s3.stat('missing.mp4'), null);
    assert.ok(requests[0].auth.startsWith('AWS4-HMAC-SHA256'));
  } finally {
    bucket.close();
  }
});

test('an old database upgrades and keeps its listings', async () => {
  const { listings } = await listSummaries('old-user');
  assert.equal(listings.length, 1);
  assert.equal(listings[0].title, 'Old mug');
  assert.equal(listings[0].price, 12);
});

test('listings come back in pages, newest first', async () => {
  const userId = 'page-user';
  for (let i = 0; i < 5; i += 1) {
    const stamp = `2026-02-0${i + 1}T00:00:00.000Z`;
    await store.saveListing({ id: `page-${i}`, userId, status: 'draft', product: { name: `Item ${i}` }, content: {}, media: [], createdAt: stamp, updatedAt: stamp });
  }
  const first = await listSummaries(userId, { limit: 2 });
  assert.deepEqual(first.listings.map((l) => l.id), ['page-4', 'page-3']);
  assert.equal(first.hasMore, true);
  const last = await listSummaries(userId, { limit: 2, offset: 4 });
  assert.deepEqual(last.listings.map((l) => l.id), ['page-0']);
  assert.equal(last.hasMore, false);
});

// ---------- pipeline ----------

const { runHaul } = await import('../src/services/haulPipeline.js');
const { sanitizeHaulItems } = await import('../src/validators/listing.sanitizer.js');
const { config } = await import('../src/config/index.js');
const { execFile } = await import('node:child_process');
const { randomUUID } = await import('node:crypto');
const { promisify } = await import('node:util');

async function queuedHaul(userId) {
  const id = randomUUID();
  const sourceKey = `${userId}/hauls/${id}/source.mp4`;
  const file = path.join(process.env.UPLOAD_DIR, sourceKey);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await promisify(execFile)(config.ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x240:rate=10', file]);
  const at = new Date().toISOString();
  await store.saveHaul({ id, userId, status: 'queued', sourceKey, sourceMime: 'video/mp4', itemCount: 0, createdAt: at, updatedAt: at });
  return { id, file };
}

const item = (name, frames) => ({
  name, type: 'Art', colors: 'Teal', materials: '', brand: '', dimensions: '', notes: '', frames, origins: { name: 'observed', size: 'missing' },
});
const haulUser = async () => (await store.findUserByEmail('haul@example.com')).id;

test('a haul video becomes one draft listing per product, then the video is removed', async () => {
  const userId = await haulUser();
  const { id, file } = await queuedHaul(userId);
  let sent = 0;
  await runHaul(userId, id, { detect: async (frames) => { sent = frames.length; return [item('Matchstick art', [0, 3]), item('Wire canvas', [5])]; } });

  const haul = await store.getHaul(userId, id);
  assert.equal(haul.status, 'review');
  assert.equal(haul.itemCount, 2);
  assert.ok(sent >= 12, `only ${sent} frames were sent`);
  assert.ok(!fs.existsSync(file));

  const rows = await store.listListingSummariesByHaul(userId, id);
  assert.equal(rows.length, 2);
  const listings = await Promise.all(rows.map((r) => store.getListing(userId, r.id)));
  const art = listings.find((l) => l.product.name === 'Matchstick art');
  assert.equal(art.haulId, id);
  assert.equal(art.origins.name, 'observed');
  assert.equal(art.media.length, 2);
  for (const m of art.media) assert.ok(fs.statSync(path.join(process.env.UPLOAD_DIR, m.path)).size > 0);

  const res = await api('GET', `/api/hauls/${id}`);
  assert.equal(res.json.haul.listings.length, 2);
  assert.equal(res.json.haul.sourceKey, undefined);
});

test('a video with no products fails with a clear message', async () => {
  const userId = await haulUser();
  const { id } = await queuedHaul(userId);
  await runHaul(userId, id, { detect: async () => [] });
  const haul = await store.getHaul(userId, id);
  assert.equal(haul.status, 'failed');
  assert.match(haul.error, /could not find any products/);
});

test('a temporary failure goes back to the queue, and a retry leaves no duplicates', async () => {
  const userId = await haulUser();
  const { id } = await queuedHaul(userId);
  await assert.rejects(runHaul(userId, id, { finalAttempt: false, detect: async () => { throw new Error('AI is down'); } }), /AI is down/);
  assert.equal((await store.getHaul(userId, id)).status, 'processing');

  await runHaul(userId, id, { finalAttempt: false, detect: async () => { throw new Error('AI is down'); } }).catch(() => {});
  await runHaul(userId, id, { detect: async () => [item('One', [0])] });
  assert.equal((await store.getHaul(userId, id)).status, 'review');
  assert.equal((await store.listListingSummariesByHaul(userId, id)).length, 1);
});

test('a broken video fails without showing technical errors', async () => {
  const userId = await haulUser();
  const { id, file } = await queuedHaul(userId);
  fs.writeFileSync(file, 'not a video');
  await runHaul(userId, id, { detect: async () => [item('One', [0])] });
  const haul = await store.getHaul(userId, id);
  assert.equal(haul.status, 'failed');
  assert.match(haul.error, /could not read this video/);
});

test('AI haul output is cleaned', () => {
  const items = sanitizeHaulItems({
    items: [
      { name: 'Good', frames: [1, 1, 99, 'x', 2, 3], size: '4x6', origins: { name: 'observed', size: 'inferred', colors: 'made-up' } },
      { name: 'Said size', frames: [0], size: '4x6 inches', origins: { size: 'spoken' } },
      { name: 'No usable frame', frames: [99] },
      { name: '', frames: [0] },
    ],
  }, 5);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0].frames, [1, 2]);
  assert.equal(items[0].dimensions, '');
  assert.equal(items[0].origins.colors, 'missing');
  assert.equal(items[1].dimensions, '4x6 inches');
  assert.deepEqual(sanitizeHaulItems({ items: 'nope' }, 5), []);
});
