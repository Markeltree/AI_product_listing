// Logging for the whole server. Production writes one JSON object per line, so Railway can filter by
// level or requestId; development writes readable text. Secrets in `extra` are masked.
//   log.info('sync', 'Ended the eBay copy', { listingId });
//   log.error('etsy', 'Callback failed', { err });
import { AsyncLocalStorage } from 'node:async_hooks';

const requestContext = new AsyncLocalStorage();
const SECRET_KEY = /(token|secret|password|authorization|cookie|ticket|verifier)$/i;

export const runWithRequestId = (requestId, fn) => requestContext.run({ requestId }, fn);
export const currentRequestId = () => requestContext.getStore()?.requestId;

const describeError = (err) => ({ message: err.message, status: err.status, stack: err.status < 500 ? undefined : err.stack });

export function maskSecrets(extra = {}) {
  return Object.fromEntries(Object.entries(extra).map(([key, value]) => {
    if (value instanceof Error) return [key, describeError(value)];
    return [key, SECRET_KEY.test(key) && value ? '[hidden]' : value];
  }));
}

function write(level, scope, message, extra) {
  const requestId = currentRequestId();
  const fields = maskSecrets(extra);
  const toConsole = level === 'info' ? console.log : console.error;
  if (process.env.NODE_ENV === 'production') {
    toConsole(JSON.stringify({ level, time: new Date().toISOString(), scope, message, requestId, ...fields }));
    return;
  }
  const details = Object.keys(fields).length ? ` ${JSON.stringify(fields)}` : '';
  toConsole(`[${scope}] ${message}${requestId ? ` (${requestId})` : ''}${details}`);
}

export const log = {
  info: (scope, message, extra) => write('info', scope, message, extra),
  warn: (scope, message, extra) => write('warn', scope, message, extra),
  error: (scope, message, extra) => write('error', scope, message, extra),
};
