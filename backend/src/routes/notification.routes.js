import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { store } from '../db/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pushTokenBody } from '../validators/schemas.js';

const router = Router();
router.use(requireAuth);

// A phone moves to the newest account signed in on it.
router.post('/token', validate({ body: pushTokenBody }), asyncHandler(async (req, res) => {
  await store.savePushToken({ token: req.body.token, userId: req.user.id, platform: req.body.platform });
  res.status(204).end();
}));

router.delete('/token', validate({ body: pushTokenBody }), asyncHandler(async (req, res) => {
  await store.deletePushToken(req.body.token, req.user.id);
  res.status(204).end();
}));

export default router;
