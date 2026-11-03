// Shared plumbing for "Connect Etsy" / "Connect eBay": short-lived tickets for the mobile app,
// safe return targets, OAuth state that carries the return target, and reachability checks.
import { randomBytes } from 'node:crypto';
import { config } from '../config/index.js';
import { ETSY_CONNECT_TICKET_TTL_MS } from '../config/constants.js';
import { store } from '../db/index.js';
import { HttpError, conflict } from '../utils/errors.js';
import { createSessionToken, readTokenData } from '../utils/session.js';

const LOOPBACK = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/i;
const isLoopbackHost = (host) => LOOPBACK.test(String(host || '').replace(/:\d+$/, ''));

// The address the caller actually reached this server on (for example http://192.168.1.20:3000 from a
// phone). Used when APP_URL is localhost, because "localhost" on a phone is the phone itself.
export function publicOrigin(req) {
  const app = new URL(config.appUrl);
  const host = req?.get?.('host');
  if (!host || !isLoopbackHost(app.host) || isLoopbackHost(host)) return config.appUrl;
  return `${req.protocol}://${host}`;
}

// A phone cannot finish OAuth when the marketplace sends it back to a localhost callback.
// Throws a 409 that explains the fix instead of letting the browser open a dead page.
export function assertCallbackReachable(req, callbackUrl, marketplace) {
  if (!isLoopbackHost(new URL(callbackUrl).host) || isLoopbackHost(req.get('host'))) return;
  throw conflict(
    `${marketplace} sends you back to ${callbackUrl} after you approve, and your phone cannot open "localhost". `
    + 'Set APP_URL in the server .env to an address your phone can reach (an HTTPS tunnel such as ngrok, or your deployed URL), '
    + `add <APP_URL>/api/${marketplace.toLowerCase()}/callback to your ${marketplace} app settings, restart the server, and try again.`,
    { code: 'callback_unreachable' },
  );
}

// Plain "you're connected" page for sellers who connect through an emailed invite link
// (they have no Velista app to return to).
export const DONE_PATH = '/api/connect/done';
export const donePageUrl = () => `${config.appUrl}${DONE_PATH}`;

// `returnTo` is limited to the mobile deep link scheme and our own done page, so it cannot be an open redirect.
export function safeReturnTo(value) {
  const v = String(value || '');
  return v.startsWith(`${config.mobileScheme}://`) || v === donePageUrl() ? v : null;
}

// Where to send the browser after connecting: back into the app's Settings screen.
export function returnUrl(returnTo, query) {
  const target = returnTo || `${config.mobileScheme}://settings`;
  return `${target}${target.includes('?') ? '&' : '?'}${query}`;
}

// ---------- mobile tickets ----------

// A ticket for the OAuth start page. The mobile app opens it in an in-app browser (5 minutes), so the
// long-lived session token never appears in a URL. Invite links for a seller last longer (ttlMs).
export function createTicketUrl({ origin, path, purpose, userId, returnTo, ttlMs = ETSY_CONNECT_TICKET_TTL_MS }) {
  const url = new URL(`${origin}${path}`);
  url.searchParams.set('ticket', createSessionToken(userId, { ttlMs, purpose }));
  const safe = safeReturnTo(returnTo);
  if (safe) url.searchParams.set('return', safe);
  return url.toString();
}

export async function userFromTicket(ticket, purpose) {
  const data = readTokenData(String(ticket));
  if (!data || data.purpose !== purpose) throw new HttpError(401, 'This connection link has expired or is not valid. Ask for a new link.');
  const user = await store.findUserById(data.uid);
  if (!user) throw new HttpError(401, 'Account not found.');
  return user;
}

// ---------- OAuth state ----------

// The state carries the return target (base64url after a dot) so the callback knows where to send the user.
export const encodeState = (returnTo) => {
  const nonce = randomBytes(24).toString('base64url');
  return returnTo ? `${nonce}.${Buffer.from(returnTo).toString('base64url')}` : nonce;
};

export function returnToFromState(state) {
  const dot = state.indexOf('.');
  if (dot === -1) return null;
  return safeReturnTo(Buffer.from(state.slice(dot + 1), 'base64url').toString('utf8'));
}
