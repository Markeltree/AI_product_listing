import { Router } from 'express';
import * as hauls from '../controllers/haul.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { haulCreateBody, listingParams } from '../validators/schemas.js';

const router = Router();
const params = validate({ params: listingParams });

// Authorised by the ticket in its URL, so it comes before requireAuth.
router.put('/:id/upload', params, asyncHandler(hauls.upload));

router.use(requireAuth);

router.get('/', asyncHandler(hauls.list));
router.post('/', aiLimiter, validate({ body: haulCreateBody }), asyncHandler(hauls.create));
router.get('/:id', params, asyncHandler(hauls.get));
router.post('/:id/complete', params, asyncHandler(hauls.complete));
router.delete('/:id', params, asyncHandler(hauls.remove));

export default router;
