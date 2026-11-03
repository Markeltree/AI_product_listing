// One shared Redis connection (ioredis), used by the BullMQ queues and the rate-limit store.
// Redis is optional: without REDIS_URL the server runs background work in-process, as before.
import { Redis } from 'ioredis';
import { config } from '../config/index.js';

let client = null;

export const redisEnabled = () => Boolean(config.redisUrl);

export function redis() {
  if (!redisEnabled()) throw new Error('REDIS_URL is not set.');
  if (!client) {
    client = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null, // required by BullMQ: blocking commands must not time out
      family: 0, // IPv4 and IPv6; Railway's private network is IPv6-only
      connectionName: 'velista-api',
    });
    let lastError = '';
    client.on('error', (err) => {
      // Log each distinct failure once instead of on every reconnect attempt.
      if (err.message !== lastError) console.error('[redis]', err.message);
      lastError = err.message;
    });
    client.on('ready', () => {
      lastError = '';
      console.log('[redis] connected');
    });
  }
  return client;
}

export async function redisStatus() {
  if (!redisEnabled()) return 'off';
  try {
    return (await redis().ping()) === 'PONG' ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

export async function closeRedis() {
  if (client) await client.quit().catch(() => client.disconnect());
  client = null;
}
