import { integrations } from '../config/index.js';
import { redisStatus } from '../queue/redis.js';
import { aiStatus } from '../services/ai/index.js';
import { now } from '../utils/parse.js';

// Public health check (Railway uses it). Reports Redis as 'ok', 'error' or 'off'.
export async function health(_req, res) {
  const redis = await redisStatus();
  res.json({ ok: redis !== 'error', integrations: { ...integrations(), redis }, ai: aiStatus(), time: now() });
}
