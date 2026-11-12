// Connecting a user's Etsy shop: OAuth start and callback, mobile tickets, status and shop refresh.
import { config } from '../../../config/index.js';
import { OAUTH_STATE_TTL_MS } from '../../../config/constants.js';
import { store } from '../../../db/index.js';
import { conflict } from '../../../utils/errors.js';
import { now } from '../../../utils/parse.js';
import { createTicketUrl, donePageUrl, encodeState, userFromTicket as userFromTicketFor } from '../../connectLinks.js';
import {
  buildAuthorizeUrl, createPkcePair, etsyConfigured, exchangeCodeForTokens, fetchShippingProfiles, fetchShopForUser,
  tokensToConnection,
} from './index.js';

const TICKET_PURPOSE = 'etsy-connect';

// Return targets, tickets and state encoding are shared with eBay (connectLinks.js).
export { returnToFromState, returnUrl, safeReturnTo } from '../../connectLinks.js';

// ---------- mobile ticket ----------

export const createConnectUrl = (userId, returnTo, origin = config.appUrl) =>
  createTicketUrl({ origin, path: '/api/etsy/connect', purpose: TICKET_PURPOSE, userId, returnTo });

export const userFromTicket = (ticket) => userFromTicketFor(ticket, TICKET_PURPOSE);

// A link to send to a shop owner (for example a beta tester) so their Etsy shop is connected to the
// Velista account `userId`. They need no Velista login; after approving they see a plain done page.
export const createInviteUrl = (userId, hours = 48) => createTicketUrl({
  origin: config.appUrl, path: '/api/etsy/connect', purpose: TICKET_PURPOSE, userId, returnTo: donePageUrl(), ttlMs: hours * 3600_000,
});

// ---------- OAuth ----------

// Saves the PKCE verifier and returns Etsy's authorize URL.
export async function startConnect(userId, returnTo) {
  const { verifier, challenge } = createPkcePair();
  const state = encodeState(returnTo);
  await store.saveOAuthState({ state, userId, verifier, createdAt: now() });
  return buildAuthorizeUrl({ state, challenge });
}

// Exchanges the authorization code, stores the tokens and looks up the shop.
// Returns a warning message when the account has no shop. Throws with a user-facing message on failure.
export async function completeConnect(state, code) {
  const row = await store.takeOAuthState(state);
  if (!row || Date.now() - new Date(row.createdAt).getTime() > OAUTH_STATE_TTL_MS) {
    throw new Error('This connection request expired. Please try connecting again.');
  }
  if (!code) throw new Error('Etsy did not return an authorization code.');

  const tokens = await exchangeCodeForTokens(code, row.verifier);
  await store.saveConnection({ userId: row.userId, ...tokensToConnection(tokens) });
  const shop = await fetchShopForUser(row.userId);
  const conn = await store.getConnection(row.userId);
  await store.saveConnection({ ...conn, ...shop });
  return shop.shopId ? null : 'Connected, but no shop was found on this Etsy account.';
}

// ---------- status and shop data ----------

export async function getStatus(userId) {
  const conn = await store.getConnection(userId);
  return {
    configured: etsyConfigured(),
    connected: Boolean(conn),
    shopId: conn?.shopId ?? null,
    shopName: conn?.shopName ?? null,
    hasShop: Boolean(conn?.shopId),
    expiresAt: conn?.expiresAt ?? null,
    redirectUri: config.etsy.redirectUri,
  };
}

export async function refreshShop(userId) {
  const conn = await store.getConnection(userId);
  if (!conn) throw conflict('Connect Etsy first.');
  const shop = await fetchShopForUser(userId);
  await store.saveConnection({ ...conn, ...shop });
  return shop;
}

export async function getShippingProfiles(userId) {
  const conn = await store.getConnection(userId);
  if (!conn?.shopId) throw conflict('Connect your Etsy shop first.');
  return fetchShippingProfiles(userId, conn.shopId);
}

export const disconnect = (userId) => store.deleteConnection(userId);
