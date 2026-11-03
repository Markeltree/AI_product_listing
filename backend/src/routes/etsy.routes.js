import { Router } from 'express';
import * as etsy from '../controllers/etsy.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Browser redirects (no JSON): the OAuth start page and Etsy's callback.
router.get('/connect', asyncHandler(etsy.authenticateConnect), asyncHandler(etsy.connect));
router.get('/callback', asyncHandler(etsy.callback));

router.get('/status', requireAuth, asyncHandler(etsy.status));
router.post('/connect-url', requireAuth, etsy.connectUrl);
router.post('/disconnect', requireAuth, asyncHandler(etsy.disconnect));
router.post('/refresh', requireAuth, asyncHandler(etsy.refresh));
router.get('/shipping-profiles', requireAuth, asyncHandler(etsy.shippingProfiles));
router.get('/taxonomy', requireAuth, asyncHandler(etsy.taxonomy));

export default router;
