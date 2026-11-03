import { integrations } from '../config/index.js';
import { aiStatus } from '../services/ai/index.js';
import { now } from '../utils/parse.js';

export function health(_req, res) {
  res.json({ ok: true, integrations: integrations(), ai: aiStatus(), time: now() });
}
