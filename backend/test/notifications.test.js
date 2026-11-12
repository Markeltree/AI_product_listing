// Push notifications: registering phones, what triggers an alert, and failures staying harmless.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

// A stand-in for Expo's push service. `tickets` decides the reply to the next request.
let sent = [];
let tickets = null;
let failWith = null;
const expo = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    if (failWith) { res.writeHead(failWith); res.end(); return; }
    const messages = JSON.parse(raw);
    sent.push(...messages);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ data: tickets ?? messages.map(() => ({ status: 'ok', id: 'x' })) }));
  });
});
await new Promise((resolve) => { expo.listen(0, resolve); });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'velista-push-'));
Object.assign(process.env, {
  DATA_DIR: path.join(tmp, 'data'), UPLOAD_DIR: path.join(tmp, 'uploads'), SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
  ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', SYNC_INTERVAL_MINUTES: '0', REDIS_URL: '', SESSION_SECRET: 'push-test', ALLOWED_SIGNUP_EMAILS: '',
  EXPO_PUSH_URL: `http://localhost:${expo.address().port}/send`,
});
fs.mkdirSync(process.env.DATA_DIR, { recursive: true });

const { createApp } = await import('../src/app.js');
const { config } = await import('../src/config/index.js');
const { initStore, store } = await import('../src/db/index.js');
const { notifyUser } = await import('../src/services/notifications.service.js');

const TOKEN = 'ExponentPushToken[abc123]';
let server;
let base;
let auth;
let userId;

const call = (method, p, body) => fetch(`${base}${p}`, {
  method, headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body),
});

async function waitFor(check) {
  for (let i = 0; i < 100; i += 1) {
    if (await check()) return;
    await new Promise((resolve) => { setTimeout(resolve, 50); });
  }
  throw new Error('Timed out.');
}

before(async () => {
  await initStore();
  server = createApp().listen(0);
  base = `http://localhost:${server.address().port}`;
  const res = await fetch(`${base}/api/auth/signup`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Seller', email: 'push@example.com', password: 'Sup3r-secure-pass' }),
  });
  ({ token: auth } = await res.json());
  userId = (await store.findUserByEmail('push@example.com')).id;
});
after(() => { server.close(); expo.close(); });
beforeEach(async () => {
  sent = []; tickets = null; failWith = null;
  await store.deletePushToken(TOKEN);
});

test('a phone can register, and only real Expo tokens are accepted', async () => {
  assert.equal((await call('POST', '/api/notifications/token', { token: TOKEN, platform: 'android' })).status, 204);
  assert.deepEqual(await store.listPushTokens(userId), [TOKEN]);
  assert.equal((await call('POST', '/api/notifications/token', { token: 'hello', platform: 'android' })).status, 400);
  assert.equal((await fetch(`${base}/api/notifications/token`, { method: 'POST' })).status, 401);
});

test('signing out removes the phone', async () => {
  await store.savePushToken({ token: TOKEN, userId, platform: 'android' });
  assert.equal((await call('DELETE', '/api/notifications/token', { token: TOKEN, platform: 'android' })).status, 204);
  assert.deepEqual(await store.listPushTokens(userId), []);
});

test('a phone moves to the account signed in last, and another seller cannot remove it', async () => {
  await store.savePushToken({ token: TOKEN, userId: 'someone-else', platform: 'android' });
  await store.deletePushToken(TOKEN, userId);
  assert.deepEqual(await store.listPushTokens('someone-else'), [TOKEN]);
  await store.savePushToken({ token: TOKEN, userId, platform: 'android' });
  assert.deepEqual(await store.listPushTokens('someone-else'), []);
  assert.deepEqual(await store.listPushTokens(userId), [TOKEN]);
});

test('the notification carries the listing to open', async () => {
  await store.savePushToken({ token: TOKEN, userId, platform: 'android' });
  await notifyUser(userId, { title: 'Hi', body: 'There', data: { listingId: 'l1' } });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, TOKEN);
  assert.equal(sent[0].channelId, 'default');
  assert.deepEqual(sent[0].data, { listingId: 'l1' });
});

test('a phone that removed the app is forgotten', async () => {
  await store.savePushToken({ token: TOKEN, userId, platform: 'android' });
  tickets = [{ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }];
  await notifyUser(userId, { title: 'Hi', body: 'There' });
  assert.deepEqual(await store.listPushTokens(userId), []);
});

test('a push service failure never throws', async () => {
  await store.savePushToken({ token: TOKEN, userId, platform: 'android' });
  failWith = 400;
  await notifyUser(userId, { title: 'Hi', body: 'There' });
  assert.deepEqual(await store.listPushTokens(userId), [TOKEN]);
});

async function testVideo() {
  const file = path.join(tmp, 'product.mp4');
  if (!fs.existsSync(file)) await promisify(execFile)(config.ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x240:rate=10', file]);
  return fs.readFileSync(file);
}

test('a scan sends one alert when ready, and a rewrite does not send another', async () => {
  await store.savePushToken({ token: TOKEN, userId, platform: 'android' });
  const form = new FormData();
  form.append('video', new Blob([await testVideo()], { type: 'video/mp4' }), 'scan.mp4');
  const res = await fetch(`${base}/api/listings/scan`, { method: 'POST', headers: { authorization: `Bearer ${auth}` }, body: form });
  const { listing } = await res.json();

  await waitFor(() => sent.length === 1);
  assert.equal(sent[0].title, 'Your listing is ready');
  assert.equal(sent[0].data.listingId, listing.id);

  await call('POST', `/api/listings/${listing.id}/regenerate`);
  await waitFor(async () => (await store.getListing(userId, listing.id)).status === 'draft');
  await new Promise((resolve) => { setTimeout(resolve, 200); });
  assert.equal(sent.length, 1);
});

test('a failed scan tells the seller', async () => {
  await store.savePushToken({ token: TOKEN, userId, platform: 'android' });
  const form = new FormData();
  form.append('video', new Blob(['not a video'], { type: 'video/mp4' }), 'scan.mp4');
  await fetch(`${base}/api/listings/scan`, { method: 'POST', headers: { authorization: `Bearer ${auth}` }, body: form });
  await waitFor(() => sent.length === 1);
  assert.equal(sent[0].title, 'We could not create your listing');
});

test('bulk uploads stay quiet', async () => {
  await store.savePushToken({ token: TOKEN, userId, platform: 'android' });
  const form = new FormData();
  const jpg = path.join(tmp, 'a.jpg');
  await promisify(execFile)(config.ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=64x64', '-frames:v', '1', jpg]);
  form.append('images', new Blob([fs.readFileSync(jpg)], { type: 'image/jpeg' }), 'one.jpg');
  form.append('defaults', '{}');
  const res = await fetch(`${base}/api/listings/bulk`, { method: 'POST', headers: { authorization: `Bearer ${auth}` }, body: form });
  const { listings } = await res.json();
  await waitFor(async () => (await store.getListing(userId, listings[0].id)).status === 'draft');
  await new Promise((resolve) => { setTimeout(resolve, 200); });
  assert.equal(sent.length, 0);
});

test('the test button sends to this seller only, and explains problems', async () => {
  assert.equal((await call('POST', '/api/notifications/test')).status, 409);
  await store.savePushToken({ token: TOKEN, userId, platform: 'android' });
  const ok = await call('POST', '/api/notifications/test');
  assert.equal(ok.status, 200);
  assert.equal(sent.at(-1).title, 'Velista notifications work');
  tickets = [{ status: 'error', message: 'bad', details: { error: 'InvalidCredentials' } }];
  const bad = await call('POST', '/api/notifications/test');
  assert.equal(bad.status, 502);
  assert.match((await bad.json()).error, /InvalidCredentials/);
});
