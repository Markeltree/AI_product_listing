import * as etsyConnection from '../services/etsyConnection.service.js';
import { etsyConfigured, searchTaxonomy } from '../services/etsy/index.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config/index.js';
import { assertCallbackReachable, publicOrigin } from '../services/connectLinks.js';

export async function status(req, res) {
  res.json(await etsyConnection.getStatus(req.user.id));
}

// Mobile: returns a one-time link to the connect page, on the address the phone reached us on.
export function connectUrl(req, res) {
  assertCallbackReachable(req, config.etsy.redirectUri, 'Etsy');
  res.json({ url: etsyConnection.createConnectUrl(req.user.id, req.body?.returnTo, publicOrigin(req)) });
}

// Opened by the app's in-app browser with a one-time ticket (or a Bearer token). Errors are plain text.
// Errors here are plain text: the user sees this page directly, not through the app.
export async function authenticateConnect(req, res, next) {
  if (!req.query.ticket) return requireAuth(req, res, next);
  try {
    req.user = await etsyConnection.userFromTicket(req.query.ticket);
  } catch (err) {
    return res.status(err.status || 401).send(err.message);
  }
  req.returnTo = etsyConnection.safeReturnTo(req.query.return);
  next();
}

export async function connect(req, res) {
  if (!etsyConfigured()) {
    const message = encodeURIComponent('Add ETSY_API_KEY to your .env file first.');
    return res.redirect(etsyConnection.returnUrl(req.returnTo, `etsy=error&message=${message}`));
  }
  res.redirect(await etsyConnection.startConnect(req.user.id, req.returnTo));
}

// Etsy redirects here after the user approves (or declines). Always redirects back to the app.
export async function callback(req, res) {
  const state = String(req.query.state || '');
  const returnTo = etsyConnection.returnToFromState(state);
  const back = (query) => res.redirect(etsyConnection.returnUrl(returnTo, query));
  const fail = (message) => back(`etsy=error&message=${encodeURIComponent(message)}`);

  if (req.query.error) return fail(String(req.query.error_description || req.query.error));
  try {
    const warning = await etsyConnection.completeConnect(state, String(req.query.code || ''));
    back(warning ? `etsy=connected&warning=${encodeURIComponent(warning)}` : 'etsy=connected');
  } catch (err) {
    console.error('[etsy callback]', err);
    fail(err.message || 'Could not connect to Etsy.');
  }
}

export async function disconnect(req, res) {
  await etsyConnection.disconnect(req.user.id);
  res.json({ ok: true });
}

export async function refresh(req, res) {
  const shop = await etsyConnection.refreshShop(req.user.id);
  res.json({ ok: true, shopId: shop.shopId, shopName: shop.shopName });
}

export async function shippingProfiles(req, res) {
  res.json({ profiles: await etsyConnection.getShippingProfiles(req.user.id) });
}

export async function taxonomy(req, res) {
  res.json({ results: await searchTaxonomy(req.query.q, 20) });
}
