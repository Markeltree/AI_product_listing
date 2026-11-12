import * as ebayConnection from '../services/marketplaces/ebay/connection.js';
import { assertCallbackReachable, publicOrigin, returnToFromState, returnUrl, safeReturnTo } from '../services/connectLinks.js';
import { ebayConfigured, suggestCategories } from '../services/marketplaces/ebay/index.js';
import { requireAuth } from '../middleware/auth.js';
import { log } from '../utils/logger.js';

export async function status(req, res) {
  res.json(await ebayConnection.getStatus(req.user.id));
}

// Mobile: a one-time link to the connect page, on the address the phone reached us on.
export function connectUrl(req, res) {
  assertCallbackReachable(req, ebayConnection.callbackUrl(), 'eBay');
  res.json({ url: ebayConnection.createConnectUrl(req.user.id, req.body?.returnTo, publicOrigin(req)) });
}

// Opened by the app's in-app browser with a one-time ticket (or a Bearer token). Errors are plain text.
export async function authenticateConnect(req, res, next) {
  if (!req.query.ticket) return requireAuth(req, res, next);
  try {
    req.user = await ebayConnection.userFromTicket(req.query.ticket);
  } catch (err) {
    return res.status(err.status || 401).send(err.message);
  }
  req.returnTo = safeReturnTo(req.query.return);
  next();
}

export async function connect(req, res) {
  if (!ebayConfigured()) {
    const message = encodeURIComponent('Add EBAY_CLIENT_ID, EBAY_CLIENT_SECRET and EBAY_RUNAME to your .env file first.');
    return res.redirect(returnUrl(req.returnTo, `ebay=error&message=${message}`));
  }
  res.redirect(await ebayConnection.startConnect(req.user.id, req.returnTo));
}

// eBay redirects here (the RuName's accepted and declined URLs). Always redirects back to the app.
export async function callback(req, res) {
  const state = String(req.query.state || '');
  const back = (query) => res.redirect(returnUrl(returnToFromState(state), query));
  const fail = (message) => back(`ebay=error&message=${encodeURIComponent(message)}`);

  if (req.query.error) return fail(String(req.query.error_description || req.query.error));
  if (!req.query.code) return fail('eBay access was not granted.');
  try {
    const problem = await ebayConnection.completeConnect(state, String(req.query.code));
    back(problem ? `ebay=connected&warning=${encodeURIComponent(problem)}` : 'ebay=connected');
  } catch (err) {
    log.error('ebay', 'Connect callback failed', { err });
    fail(err.message || 'Could not connect to eBay.');
  }
}

export async function setup(req, res) {
  res.json(await ebayConnection.getSetup(req.user.id));
}

export async function updatePrefs(req, res) {
  res.json(await ebayConnection.updatePrefs(req.user.id, req.body || {}));
}

export async function disconnect(req, res) {
  await ebayConnection.disconnect(req.user.id);
  res.json({ ok: true });
}

export async function categories(req, res) {
  res.json({ results: req.query.q ? await suggestCategories(req.query.q) : [] });
}
