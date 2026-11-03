// Signed session tokens (HMAC-SHA256). The mobile app sends its token as a Bearer header.
import crypto from 'node:crypto';
import { config } from '../config/index.js';

const sign = (payload) =>
  crypto.createHmac('sha256', config.sessionSecret).update(payload).digest('base64url');

// Tokens carry an optional purpose so short-lived tickets (for example the Etsy connect ticket)
// cannot be used as full sessions.
export function createSessionToken(userId, { ttlMs = config.sessionMaxAgeMs, purpose = null } = {}) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + ttlMs, purpose })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readTokenData(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

// Full sessions only: tokens with a purpose are rejected here.
export function readSessionToken(token) {
  const data = readTokenData(token);
  return data && !data.purpose ? data.uid : null;
}

export function tokenFromRequest(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}
