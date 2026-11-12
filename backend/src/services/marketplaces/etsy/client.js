// Generic Etsy Open API v3 request helper. Refreshes the user's access token when it is about to expire.
import { config } from '../../../config/index.js';
import { store } from '../../../db/index.js';
import { isGrantRejected, refreshOnce } from '../../tokenRefresh.js';
import {
  EtsyError, assertEtsyConfigured, etsyFetch, refreshTokens, tokensToConnection,
} from './oauth.js';

const REFRESH_MARGIN_MS = 60_000;

const apiKeyHeader = () =>
  config.etsy.sharedSecret ? `${config.etsy.apiKey}:${config.etsy.sharedSecret}` : config.etsy.apiKey;

const defined = (entries) => entries.filter(([, v]) => v !== undefined && v !== null && v !== '');

async function freshConnection(userId) {
  const conn = await store.getConnection(userId);
  if (!conn) throw new EtsyError(401, 'Etsy is not connected. Connect your shop in Settings first.');
  if (conn.expiresAt - Date.now() > REFRESH_MARGIN_MS) return conn;
  return refreshOnce(`etsy:${userId}`, () => renewConnection(userId, conn));
}

async function renewConnection(userId, conn) {
  let tokens;
  try {
    tokens = await refreshTokens(conn.refreshToken);
  } catch (err) {
    if (!isGrantRejected(err)) throw new EtsyError(503, 'Etsy could not be reached just now. Your shop is still connected, so please try again.');
    // Another server may have just renewed this token. Use its copy instead of disconnecting the shop.
    const latest = await store.getConnection(userId);
    if (latest && latest.refreshToken !== conn.refreshToken) return latest;
    await store.deleteConnection(userId);
    throw new EtsyError(401, 'Your Etsy connection has expired. Reconnect your shop in Settings.');
  }
  const updated = tokensToConnection(tokens, conn);
  await store.saveConnection(updated);
  return updated;
}

function buildBody({ form, file, json }, headers) {
  if (json !== undefined) {
    headers['content-type'] = 'application/json';
    return JSON.stringify(json);
  }
  if (file) {
    const body = new FormData();
    for (const [k, v] of defined(Object.entries(form || {}))) body.append(k, String(v));
    body.append(file.field, new Blob([file.buffer], { type: file.type }), file.filename);
    return body;
  }
  if (form) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    return new URLSearchParams(defined(Object.entries(form)).map(([k, v]) => [k, String(v)]));
  }
  return undefined;
}

// options: { method, path, query, form, json, file: { field, buffer, type, filename }, auth }
// Set auth: false for public endpoints (no user token needed).
export async function etsyRequest(userId, { method = 'GET', path, query, form, json: jsonBody, file, auth = true }) {
  assertEtsyConfigured();
  const headers = { 'x-api-key': apiKeyHeader() };
  if (auth) headers.Authorization = `Bearer ${(await freshConnection(userId)).accessToken}`;

  const url = new URL(`${config.etsy.apiBase}${path}`);
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));

  const res = await etsyFetch(url, { method, headers, body: buildBody({ form, file, json: jsonBody }, headers) });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!res.ok) {
    const detail = json?.error || json?.message || text.slice(0, 300) || res.statusText;
    throw new EtsyError(res.status, `Etsy API ${res.status}: ${detail}`);
  }
  return json;
}
