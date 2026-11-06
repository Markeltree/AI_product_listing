// Etsy OAuth 2.0 with PKCE: authorize URL, code exchange and token refresh.
// Docs: https://developers.etsy.com/documentation/essentials/authentication
import crypto from 'node:crypto';
import { config } from '../../config/index.js';
import { HttpError } from '../../utils/errors.js';
import { fetchWithRetry } from '../../utils/http.js';

export class EtsyError extends HttpError {}

export const etsyConfigured = () => Boolean(config.etsy.apiKey);

export function assertEtsyConfigured() {
  if (!etsyConfigured()) throw new EtsyError(503, 'Etsy is not configured. Add ETSY_API_KEY to your .env file.');
}

// fetchWithRetry() that reports network failures as a 502 the user can read.
export async function etsyFetch(url, options) {
  try {
    return await fetchWithRetry(url, options, { service: 'etsy' });
  } catch (err) {
    throw new EtsyError(502, `Could not reach Etsy: ${err.cause?.message || err.message}`);
  }
}

export function createPkcePair() {
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function buildAuthorizeUrl({ state, challenge }) {
  const url = new URL(config.etsy.authorizeUrl);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.etsy.apiKey,
    redirect_uri: config.etsy.redirectUri,
    scope: config.etsy.scopes,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

async function tokenRequest(params) {
  const res = await etsyFetch(config.etsy.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.etsy.apiKey, ...params }),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok || !json?.access_token) {
    const err = new EtsyError(res.status || 502, `Etsy rejected the token request: ${json?.error_description || json?.error || text.slice(0, 200)}`);
    err.oauthError = json?.error;
    throw err;
  }
  return json;
}

export const exchangeCodeForTokens = (code, verifier) =>
  tokenRequest({ grant_type: 'authorization_code', redirect_uri: config.etsy.redirectUri, code, code_verifier: verifier });

export const refreshTokens = (refreshToken) =>
  tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });

// Maps an Etsy token response onto a stored connection.
export const tokensToConnection = (tokens, previous = {}) => ({
  ...previous,
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token || previous.refreshToken,
  expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000,
});
