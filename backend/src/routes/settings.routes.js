import { Router } from 'express';
import * as settings from '../controllers/settings.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { settingsBody } from '../validators/schemas.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(settings.get));
router.put('/', validate({ body: settingsBody }), asyncHandler(settings.update));

export default router;
