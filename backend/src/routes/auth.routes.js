import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/signup', rateLimit({ max: 10 }), asyncHandler(auth.signup));
router.post('/login', rateLimit({ max: 15 }), asyncHandler(auth.login));
router.post('/logout', auth.logout);
router.get('/me', requireAuth, auth.me);

export default router;
