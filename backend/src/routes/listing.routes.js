import { Router } from 'express';
import * as listings from '../controllers/listing.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { assignNewListingId, uploadAnalyzeFiles, uploadBulkImages, uploadListingFiles, uploadPhotos } from '../middleware/upload.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(listings.list));
router.post('/', assignNewListingId, uploadListingFiles, asyncHandler(listings.create));
router.post('/bulk', assignNewListingId, uploadBulkImages, asyncHandler(listings.createBulk));
// Photo/video analysis for the wizard (calls the AI, so it is rate limited).
router.post('/analyze', rateLimit({ max: 20 }), assignNewListingId, uploadAnalyzeFiles, asyncHandler(listings.analyze));

router.post('/sync', rateLimit({ max: 10 }), asyncHandler(listings.sync));

router.get('/:id', asyncHandler(listings.get));
router.put('/:id', asyncHandler(listings.update));
router.delete('/:id', asyncHandler(listings.remove));
router.post('/:id/regenerate', asyncHandler(listings.regenerate));
router.post('/:id/publish-ebay', asyncHandler(listings.publishEbay));
router.post('/:id/delist', asyncHandler(listings.delist));
router.post('/:id/publish', asyncHandler(listings.publish));

router.post('/:id/media', asyncHandler(listings.prepareAddPhotos), uploadPhotos, asyncHandler(listings.addPhotos));
router.get('/:id/media/:mediaId', asyncHandler(listings.getMedia));
router.delete('/:id/media/:mediaId', asyncHandler(listings.removeMedia));

export default router;
