// eBay OAuth 2.0 (authorization code grant): authorize URL, code exchange, refresh, and the
// application token used for public APIs such as Taxonomy.
// Docs: https://developer.ebay.com/api-docs/static/oauth-authorization-code-grant.html
import { config } from '../../config/index.js';
import { HttpError } from '../../utils/errors.js';

export class EbayError extends HttpError {}

export const ebayConfigured = () => Boolean(config.ebay.clientId && config.ebay.clientSecret && config.ebay.ruName);

export function assertEbayConfigured() {
  if (!ebayConfigured()) {
    throw new EbayError(503, 'eBay is not configured. Add EBAY_CLIENT_ID, EBAY_CLIENT_SECRET and EBAY_RUNAME to your .env file.');
  }
}

// fetch() that reports network failures as a 502 the user can read.
export async function ebayFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch (err) {
    throw new EbayError(502, `Could not reach eBay: ${err.cause?.message || err.message}`);
  }
}

export function buildAuthorizeUrl({ state }) {
  const url = new URL(config.ebay.authorizeUrl);
  url.search = new URLSearchParams({
    client_id: config.ebay.clientId,
    redirect_uri: config.ebay.ruName,
    response_type: 'code',
    scope: config.ebay.scopes,
    state,
  }).toString();
  return url.toString();
}

const basicAuth = () => `Basic ${Buffer.from(`${config.ebay.clientId}:${config.ebay.clientSecret}`).toString('base64')}`;

async function tokenRequest(params) {
  const res = await ebayFetch(config.ebay.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: basicAuth() },
    body: new URLSearchParams(params),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok || !json?.access_token) {
    throw new EbayError(res.status || 502, `eBay rejected the token request: ${json?.error_description || json?.error || text.slice(0, 200)}`);
  }
  return json;
}

export const exchangeCodeForTokens = (code) =>
  tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: config.ebay.ruName });

export const refreshTokens = (refreshToken) =>
  tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken, scope: config.ebay.scopes });

// Maps an eBay token response onto a stored connection.
export const tokensToConnection = (tokens, previous = {}) => ({
  ...previous,
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token || previous.refreshToken,
  expiresAt: Date.now() + Number(tokens.expires_in || 7200) * 1000,
  refreshExpiresAt: tokens.refresh_token_expires_in
    ? Date.now() + Number(tokens.refresh_token_expires_in) * 1000
    : previous.refreshExpiresAt ?? null,
});

// Application token (client credentials) for APIs that are not tied to a seller, cached until expiry.
let appToken = { value: null, expiresAt: 0 };
export async function getAppToken() {
  if (appToken.value && appToken.expiresAt - Date.now() > 60_000) return appToken.value;
  const json = await tokenRequest({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' });
  appToken = { value: json.access_token, expiresAt: Date.now() + Number(json.expires_in || 7200) * 1000 };
  return appToken.value;
}
