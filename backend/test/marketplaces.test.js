// Cross-delisting works for any number of marketplaces: a third, fake marketplace is added here.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'velista-markets-'));
Object.assign(process.env, {
  DATA_DIR: path.join(tmp, 'data'), UPLOAD_DIR: path.join(tmp, 'uploads'), SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
  ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', SYNC_INTERVAL_MINUTES: '0', REDIS_URL: '', SESSION_SECRET: 'markets-test',
  ALLOWED_SIGNUP_EMAILS: '', EXPO_PUSH_URL: 'http://localhost:9/none',
});
fs.mkdirSync(process.env.DATA_DIR, { recursive: true });

const { initStore, store } = await import('../src/db/index.js');
const { MARKETPLACES } = await import('../src/services/marketplaces/index.js');
const { runSync } = await import('../src/services/marketplaces/sync.js');
const { delistListing } = await import('../src/services/marketplaces/delist.js');
const { isLive } = await import('../src/services/marketplaces/status.js');

// Three stand-in marketplaces. `remote` is what each one reports; `calls` records what Velista asked.
let remote;
let calls;
const fake = (id) => ({
  id,
  name: id.toUpperCase(),
  isLive: (l) => isLive(l[id]),
  getState: async () => ({ exists: true, ...remote[id] }),
  end: async () => { calls.push(`end ${id}`); },
  setQuantity: async (_l, q) => { calls.push(`qty ${id} ${q}`); return true; },
});
const real = [...MARKETPLACES];
let userId;

before(async () => {
  await initStore();
  MARKETPLACES.splice(0, MARKETPLACES.length, fake('a'), fake('b'), fake('c'));
});
after(() => { MARKETPLACES.splice(0, MARKETPLACES.length, ...real); });
// A new seller per test, so one test's listings are not synced in the next.
beforeEach(async () => {
  userId = randomUUID();
  await store.createUser({ id: userId, name: 'S', email: `${userId}@example.com`, passwordHash: 'x', createdAt: new Date().toISOString() });
  calls = [];
  remote = { a: { active: true, quantity: 3 }, b: { active: true, quantity: 3 }, c: { active: true, quantity: 3 } };
});

async function liveListing() {
  const copy = { listingId: 'x', state: 'active', publishedAt: new Date().toISOString() };
  const listing = {
    id: randomUUID(), userId, status: 'published', product: { name: 'Mug', quantity: 3 }, content: { title: 'Mug' },
    media: [], a: copy, b: copy, c: copy, sync: { quantity: 3 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  await store.saveListing(listing);
  return listing.id;
}

test('a sale on one marketplace lowers the stock on the other two', async () => {
  const id = await liveListing();
  remote.b.quantity = 2;
  const { changes } = await runSync({ userId });
  assert.deepEqual(calls.sort(), ['qty a 2', 'qty c 2']);
  assert.equal(changes.find((c) => c.id === id).action, 'Sold on B, quantity set to 2 on A and C');
  assert.equal((await store.getListing(userId, id)).sync.quantity, 2);
});

test('selling out on one marketplace ends it on the other two', async () => {
  const id = await liveListing();
  remote.c = { active: false, quantity: 0, soldOut: true };
  await runSync({ userId });
  assert.deepEqual(calls.sort(), ['end a', 'end b']);
  const saved = await store.getListing(userId, id);
  assert.equal(saved.status, 'ended');
  assert.equal(saved.sync.reason, 'Sold on C');
  assert.equal(saved.sync.endedOn, 'c');
});

test('End listing works on one or every marketplace, and rejects unknown ones', async () => {
  const id = await liveListing();
  await delistListing(userId, id, { channel: 'b' });
  assert.deepEqual(calls, ['end b']);
  assert.equal((await store.getListing(userId, id)).status, 'published');
  await delistListing(userId, id, { channel: 'all' });
  assert.deepEqual(calls, ['end b', 'end a', 'end c']);
  assert.equal((await store.getListing(userId, id)).status, 'ended');
  await assert.rejects(delistListing(userId, id, { channel: 'mercari' }), /Choose a, b, c or all/);
});
