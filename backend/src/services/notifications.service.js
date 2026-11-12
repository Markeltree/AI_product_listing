// Push notifications to the seller's phones through Expo's push service. A notification is a courtesy,
// so a failure here is logged and never stops the listing or sale work that triggered it.
import { config } from '../config/index.js';
import { store } from '../db/index.js';
import { fetchWithRetry } from '../utils/http.js';
import { log } from '../utils/logger.js';

const BATCH_SIZE = 100;

// Expo answers with one ticket per message, in the same order. Returns the problems it reported.
async function sendBatch(tokens, message) {
  const res = await fetchWithRetry(config.expoPushUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(tokens.map((to) => ({ to, sound: 'default', channelId: 'default', ...message }))),
  }, { service: 'push' });
  if (!res.ok) throw new Error(`Expo push returned ${res.status}.`);
  const { data: tickets = [] } = await res.json();
  const problems = [];
  await Promise.all(tickets.map(async (ticket, i) => {
    if (ticket.status === 'ok') return;
    const reason = ticket.details?.error || ticket.message;
    problems.push(reason);
    log.warn('push', 'A notification was not accepted', { reason });
    // The app was removed from that phone, so its token will never work again.
    if (ticket.details?.error === 'DeviceNotRegistered') await store.deletePushToken(tokens[i]);
  }));
  return problems;
}

// message: { title, body, data }. Never throws. Returns { devices, problems } for the test button.
export async function notifyUser(userId, message) {
  const problems = [];
  let tokens = [];
  try {
    tokens = await store.listPushTokens(userId);
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) problems.push(...await sendBatch(tokens.slice(i, i + BATCH_SIZE), message));
  } catch (err) {
    log.error('push', 'Could not send a notification', { userId, err });
    problems.push(err.message);
  }
  return { devices: tokens.length, problems };
}
