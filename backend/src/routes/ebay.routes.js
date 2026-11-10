import { Router } from "express";
import * as ebay from "../controllers/ebay.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { marketplaceLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  connectUrlBody,
  ebayPrefsBody,
  searchQuery,
} from "../validators/schemas.js";

const router = Router();

router.get(
  "/connect",
  asyncHandler(ebay.authenticateConnect),
  asyncHandler(ebay.connect),
);
router.get("/callback", asyncHandler(ebay.callback));

router.get("/status", requireAuth, asyncHandler(ebay.status));
router.post(
  "/connect-url",
  requireAuth,
  marketplaceLimiter,
  validate({ body: connectUrlBody }),
  ebay.connectUrl,
);
router.get("/setup", requireAuth, marketplaceLimiter, asyncHandler(ebay.setup));
router.put(
  "/prefs",
  requireAuth,
  marketplaceLimiter,
  validate({ body: ebayPrefsBody }),
  asyncHandler(ebay.updatePrefs),
);
router.post("/disconnect", requireAuth, asyncHandler(ebay.disconnect));
router.get(
  "/categories",
  requireAuth,
  validate({ query: searchQuery }),
  asyncHandler(ebay.categories),
);

export default router;
