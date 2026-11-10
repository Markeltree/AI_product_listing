// Scanning a product from a video, database upgrades and listing pages.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'velista-listing-'));
Object.assign(process.env, {
  DATA_DIR: path.join(tmp, 'data'), UPLOAD_DIR: path.join(tmp, 'uploads'), SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
  ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', SYNC_INTERVAL_MINUTES: '0', REDIS_URL: '', SESSION_SECRET: 'listing-test', ALLOWED_SIGNUP_EMAILS: '',
});

// A database from before summaries existed, to prove an upgrade keeps its rows.
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
const { config } = await import('../src/config/index.js');
const { initStore, store } = await import('../src/db/index.js');
const { listSummaries } = await import('../src/services/listing.service.js');

let server;
let base;
let token;

async function scan(file, name = 'scan.mp4') {
  const form = new FormData();
  if (file) form.append('video', new Blob([file], { type: 'video/mp4' }), name);
  const res = await fetch(`${base}/api/listings/scan`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, json: await res.json() };
}

async function finished(id) {
  for (let i = 0; i < 100; i += 1) {
    const res = await fetch(`${base}/api/listings/${id}`, { headers: { authorization: `Bearer ${token}` } });
    const { listing } = await res.json();
    if (listing.status !== 'generating') return listing;
    await new Promise((resolve) => { setTimeout(resolve, 100); });
  }
  throw new Error('The listing did not finish.');
}

before(async () => {
  await initStore();
  server = createApp().listen(0);
  base = `http://localhost:${server.address().port}`;
  const res = await fetch(`${base}/api/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Seller', email: 'scan@example.com', password: 'Sup3r-secure-pass' }),
  });
  token = (await res.json()).token;
});
after(() => server.close());

test('a scanned video becomes a listing with photos, and the video is removed', async () => {
  const file = path.join(tmp, 'product.mp4');
  await promisify(execFile)(config.ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=4:size=320x240:rate=10', file]);

  const { status, json } = await scan(fs.readFileSync(file));
  assert.equal(status, 202);
  assert.equal(json.listing.status, 'generating');

  const listing = await finished(json.listing.id);
  assert.equal(listing.status, 'draft');
  assert.equal(listing.media.filter((m) => m.kind === 'image').length, 4);
  assert.equal(listing.media.filter((m) => m.kind === 'video').length, 0);
  for (const m of listing.media) assert.ok(fs.statSync(path.join(process.env.UPLOAD_DIR, m.path)).size > 0);

  const folder = path.join(process.env.UPLOAD_DIR, listing.userId, listing.id);
  assert.ok(!fs.readdirSync(folder).some((f) => f.endsWith('.mp4')));
});

test('a file that is not a real video ends as failed, with the reason', async () => {
  const { json } = await scan(Buffer.from('not a video'));
  const listing = await finished(json.listing.id);
  assert.equal(listing.status, 'failed');
  assert.match(listing.error, /No photos could be read/);
});

test('a scan needs a video and a signed-in seller', async () => {
  assert.equal((await scan(null)).status, 400);
  const res = await fetch(`${base}/api/listings/scan`, { method: 'POST' });
  assert.equal(res.status, 401);
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
