// fetch() for calling marketplaces: every attempt has a time limit, and temporary failures are retried.
import { log } from './logger.js';

const TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const MAX_WAIT_MS = 30_000;
const SAFE_TO_REPEAT = new Set(['GET', 'HEAD', 'PUT']);

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Retry-After is in seconds or an HTTP date. Returns null when the header is missing or unreadable.
function retryAfterMs(res) {
  const value = res.headers.get('retry-after');
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

const backoffMs = (attempt) => BASE_DELAY_MS * 2 ** (attempt - 1) * (0.75 + Math.random() / 2);

// A 429 means the request was refused, so it is always safe to send again. After a 5xx or a lost
// connection a POST may already have worked, and repeating it could create a duplicate listing.
export async function fetchWithRetry(url, options = {}, { service = 'http', timeoutMs = TIMEOUT_MS, attempts = MAX_ATTEMPTS, sleep = wait } = {}) {
  const repeatable = SAFE_TO_REPEAT.has((options.method || 'GET').toUpperCase());
  for (let attempt = 1; ; attempt += 1) {
    const lastAttempt = attempt >= attempts;
    let res;
    try {
      res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      if (lastAttempt || !repeatable) throw err;
      log.warn(service, 'Request failed, retrying', { attempt, reason: err.cause?.message || err.message });
      await sleep(backoffMs(attempt));
      continue;
    }
    const retryable = res.status === 429 || (res.status >= 500 && repeatable);
    if (!retryable || lastAttempt) return res;
    const delay = retryAfterMs(res) ?? backoffMs(attempt);
    if (delay > MAX_WAIT_MS) return res;
    log.warn(service, 'Temporary error, retrying', { attempt, status: res.status, delayMs: Math.round(delay) });
    await res.body?.cancel();
    await sleep(delay);
  }
}
