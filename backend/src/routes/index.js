// All API routes, mounted under /api by app.js.
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { health } from '../controllers/health.controller.js';
import { connectDone } from '../controllers/connectDone.controller.js';
import authRoutes from './auth.routes.js';
import ebayRoutes from './ebay.routes.js';
import etsyRoutes from './etsy.routes.js';
import listingRoutes from './listing.routes.js';
import settingsRoutes from './settings.routes.js';

const router = Router();

router.get('/health', asyncHandler(health));
router.get('/connect/done', connectDone); // after connecting through an invite link
router.use('/auth', authRoutes);
router.use('/listings', listingRoutes);
router.use('/etsy', etsyRoutes);
router.use('/ebay', ebayRoutes);
router.use('/settings', settingsRoutes);

export default router;
