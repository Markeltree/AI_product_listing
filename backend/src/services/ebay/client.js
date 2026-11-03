// Generic eBay REST request helper. Refreshes the seller's access token when it is about to expire.
import { config } from '../../config/index.js';
import { store } from '../../db/index.js';
import {
  EbayError, assertEbayConfigured, ebayFetch, getAppToken, refreshTokens, tokensToConnection,
} from './oauth.js';

const REFRESH_MARGIN_MS = 60_000;

export async function freshEbayConnection(userId) {
  const conn = await store.getEbayConnection(userId);
  if (!conn) throw new EbayError(409, 'eBay is not connected. Connect your eBay account in Settings first.');
  if (conn.expiresAt - Date.now() > REFRESH_MARGIN_MS) return conn;
  let tokens;
  try {
    tokens = await refreshTokens(conn.refreshToken);
  } catch {
    // The grant was revoked or expired (refresh tokens last about 18 months). Ask the user to reconnect.
    await store.deleteEbayConnection(userId);
    throw new EbayError(401, 'Your eBay connection has expired. Reconnect eBay in Settings.');
  }
  const updated = tokensToConnection(tokens, conn);
  await store.saveEbayConnection(updated);
  return updated;
}

// eBay errors come as { errors: [{ errorId, message, longMessage, parameters }] }.
function errorDetail(json, text, statusText) {
  const first = json?.errors?.[0];
  if (first) {
    const extra = first.parameters?.map((p) => p.value).filter(Boolean).join(', ');
    return `${first.longMessage || first.message}${extra && !(first.longMessage || '').includes(extra) ? ` (${extra})` : ''}`;
  }
  return json?.error_description || json?.message || text.slice(0, 300) || statusText;
}

// options: { method, path, base, query, body (JSON), form (FormData), auth: 'user' | 'app', headers }
// Returns { status, json, headers }. Throws EbayError on a non-2xx response.
export async function ebayRequest(userId, {
  method = 'GET', path, base = config.ebay.apiBase, query, body, form, auth = 'user', headers: extra = {},
}) {
  assertEbayConfigured();
  const token = auth === 'app' ? await getAppToken() : (await freshEbayConnection(userId)).accessToken;
  const headers = {
    authorization: `Bearer ${token}`,
    accept: 'application/json',
    'accept-language': config.ebay.contentLanguage,
    'x-ebay-c-marketplace-id': config.ebay.marketplaceId,
    ...extra,
  };
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    headers['content-language'] = config.ebay.contentLanguage;
    payload = JSON.stringify(body);
  }

  const url = new URL(`${base}${path}`);
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));

  const res = await ebayFetch(url, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!res.ok) {
    const err = new EbayError(res.status, `eBay ${res.status}: ${errorDetail(json, text, res.statusText)}`);
    err.ebayErrors = json?.errors || [];
    throw err;
  }
  return { status: res.status, json, headers: res.headers };
}
