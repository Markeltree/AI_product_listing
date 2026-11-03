// Connecting a seller's eBay account: OAuth start and callback, mobile tickets, status, and the
// one-time listing setup (business policies, ship-from location, item condition).
import { config } from '../config/index.js';
import { EBAY_CONDITIONS, OAUTH_STATE_TTL_MS } from '../config/constants.js';
import { store } from '../db/index.js';
import { badRequest, conflict } from '../utils/errors.js';
import { now } from '../utils/parse.js';
import { clean } from '../utils/text.js';
import { createTicketUrl, encodeState, userFromTicket as userFromTicketFor } from './connectLinks.js';
import {
  buildAuthorizeUrl, createLocation, ebayConfigured, exchangeCodeForTokens, fetchEbayUser, fetchLocations, fetchPolicies,
  setupProblem, tokensToConnection,
} from './ebay/index.js';

const TICKET_PURPOSE = 'ebay-connect';
export const callbackUrl = () => `${config.appUrl}/api/ebay/callback`;

// ---------- mobile ticket ----------

export const createConnectUrl = (userId, returnTo, origin = config.appUrl) =>
  createTicketUrl({ origin, path: '/api/ebay/connect', purpose: TICKET_PURPOSE, userId, returnTo });

export const userFromTicket = (ticket) => userFromTicketFor(ticket, TICKET_PURPOSE);

// ---------- OAuth ----------

export async function startConnect(userId, returnTo) {
  const state = encodeState(returnTo);
  // eBay does not use PKCE; the state row only proves the callback belongs to this user.
  await store.saveOAuthState({ state, userId, verifier: 'ebay', createdAt: now() });
  return buildAuthorizeUrl({ state });
}

// Picks a value automatically only when there is exactly one choice (or keeps a still-valid one).
const pick = (current, options, key = 'id') =>
  (options.some((o) => o[key] === current) ? current : options.length === 1 ? options[0][key] : null);

// Fills in whatever setup can be decided without asking the seller.
async function autoSetup(conn) {
  const prefs = { condition: 'NEW', ...(conn.prefs || {}) };
  const [policies, locations] = await Promise.all([fetchPolicies(conn.userId), fetchLocations(conn.userId)]);
  prefs.fulfillmentPolicyId = pick(prefs.fulfillmentPolicyId, policies.fulfillment);
  prefs.paymentPolicyId = pick(prefs.paymentPolicyId, policies.payment);
  prefs.returnPolicyId = pick(prefs.returnPolicyId, policies.return);
  prefs.merchantLocationKey = pick(prefs.merchantLocationKey, locations, 'key') || locations[0]?.key || null;
  return prefs;
}

// Exchanges the code, stores the tokens, reads the account name and does what setup it can.
export async function completeConnect(state, code) {
  const row = await store.takeOAuthState(state);
  if (!row || Date.now() - new Date(row.createdAt).getTime() > OAUTH_STATE_TTL_MS) {
    throw new Error('This connection request expired. Please try connecting again.');
  }
  if (!code) throw new Error('eBay did not return an authorization code.');

  const previous = await store.getEbayConnection(row.userId);
  let conn = { ...tokensToConnection(await exchangeCodeForTokens(code), previous || {}), userId: row.userId };
  await store.saveEbayConnection(conn);
  const who = await fetchEbayUser(row.userId).catch(() => ({}));
  conn = { ...conn, ...who };
  try {
    conn.prefs = await autoSetup(conn);
  } catch (err) {
    console.error('[ebay] auto setup failed:', err.message);
  }
  await store.saveEbayConnection(conn);
  return setupProblem(conn.prefs);
}

// ---------- status and setup ----------

export async function getStatus(userId) {
  const conn = await store.getEbayConnection(userId);
  const problem = conn ? setupProblem(conn.prefs) : null;
  return {
    configured: ebayConfigured(),
    connected: Boolean(conn),
    username: conn?.username ?? null,
    ready: Boolean(conn) && !problem,
    setupProblem: problem,
    prefs: conn?.prefs ?? {},
    sandbox: config.ebay.sandbox,
    callbackUrl: callbackUrl(),
  };
}

async function connectionOrThrow(userId) {
  const conn = await store.getEbayConnection(userId);
  if (!conn) throw conflict('Connect eBay first.', { code: 'ebay_not_connected' });
  return conn;
}

// Everything the Settings screen needs to finish setup.
export async function getSetup(userId) {
  const conn = await connectionOrThrow(userId);
  const [policies, locations] = await Promise.all([fetchPolicies(userId), fetchLocations(userId)]);
  return { prefs: conn.prefs || {}, policies, locations, conditions: EBAY_CONDITIONS, marketplaceId: config.ebay.marketplaceId };
}

const id = (v) => (v === null || v === undefined || v === '' ? null : clean(String(v), 64));

// body: { fulfillmentPolicyId, paymentPolicyId, returnPolicyId, merchantLocationKey, condition,
//         newLocation: { postalCode, country } }
export async function updatePrefs(userId, body = {}) {
  const conn = await connectionOrThrow(userId);
  const prefs = { ...(conn.prefs || {}) };
  for (const key of ['fulfillmentPolicyId', 'paymentPolicyId', 'returnPolicyId', 'merchantLocationKey']) {
    if (key in body) prefs[key] = id(body[key]);
  }
  if ('condition' in body) {
    if (!EBAY_CONDITIONS.includes(body.condition)) throw badRequest('Choose a valid item condition.');
    prefs.condition = body.condition;
  }
  if (body.newLocation) {
    const postalCode = clean(String(body.newLocation.postalCode || ''), 20);
    const country = clean(String(body.newLocation.country || ''), 2).toUpperCase();
    if (!postalCode || !/^[A-Z]{2}$/.test(country)) throw badRequest('Enter a postal code and a 2-letter country code, such as US.');
    prefs.merchantLocationKey = await createLocation(userId, { postalCode, country });
  }
  await store.saveEbayConnection({ ...conn, prefs });
  return getStatus(userId);
}

export const disconnect = (userId) => store.deleteEbayConnection(userId);
