import { Router } from 'express';
import * as ebay from '../controllers/ebay.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Browser redirects (no JSON): the OAuth start page and eBay's callback.
router.get('/connect', asyncHandler(ebay.authenticateConnect), asyncHandler(ebay.connect));
router.get('/callback', asyncHandler(ebay.callback));

router.get('/status', requireAuth, asyncHandler(ebay.status));
router.post('/connect-url', requireAuth, ebay.connectUrl);
router.get('/setup', requireAuth, asyncHandler(ebay.setup));
router.put('/prefs', requireAuth, asyncHandler(ebay.updatePrefs));
router.post('/disconnect', requireAuth, asyncHandler(ebay.disconnect));
router.get('/categories', requireAuth, asyncHandler(ebay.categories));

export default router;
