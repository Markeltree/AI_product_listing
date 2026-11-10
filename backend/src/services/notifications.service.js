// Push notifications to the seller's phones through Expo's push service. A notification is a courtesy,
// so a failure here is logged and never stops the listing or sale work that triggered it.
import { config } from '../config/index.js';
import { store } from '../db/index.js';
import { fetchWithRetry } from '../utils/http.js';
import { log } from '../utils/logger.js';

const BATCH_SIZE = 100;

// Expo answers with one ticket per message, in the same order.
async function sendBatch(tokens, message) {
  const res = await fetchWithRetry(config.expoPushUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(tokens.map((to) => ({ to, sound: 'default', channelId: 'default', ...message }))),
  }, { service: 'push' });
  if (!res.ok) throw new Error(`Expo push returned ${res.status}.`);
  const { data: tickets = [] } = await res.json();
  await Promise.all(tickets.map(async (ticket, i) => {
    if (ticket.status === 'ok') return;
    log.warn('push', 'A notification was not accepted', { reason: ticket.details?.error || ticket.message });
    // The app was removed from that phone, so its token will never work again.
    if (ticket.details?.error === 'DeviceNotRegistered') await store.deletePushToken(tokens[i]);
  }));
}

// message: { title, body, data }
export async function notifyUser(userId, message) {
  try {
    const tokens = await store.listPushTokens(userId);
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) await sendBatch(tokens.slice(i, i + BATCH_SIZE), message);
  } catch (err) {
    log.error('push', 'Could not send a notification', { userId, err });
  }
}
