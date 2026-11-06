// Shared rules for renewing marketplace access tokens.
const refreshing = new Map();

// Only a rejected grant means the seller must reconnect. Timeouts, 5xx and rate limits are temporary,
// and a wrong client secret is our mistake, so none of them may remove a seller's connection.
export const isGrantRejected = (err) => err?.oauthError === 'invalid_grant';

// Refresh tokens can be single-use. Publishing and the sync may need a new token at the same moment,
// so callers for one seller share a single refresh.
export function refreshOnce(key, refresh) {
  if (!refreshing.has(key)) {
    refreshing.set(key, refresh().finally(() => refreshing.delete(key)));
  }
  return refreshing.get(key);
}
