import { Router } from 'express';
import * as settings from '../controllers/settings.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(settings.get));
router.put('/', asyncHandler(settings.update));

export default router;
