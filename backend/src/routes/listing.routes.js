import { Router } from "express";
import * as listings from "../controllers/listing.controller.js";
import { requireAuth } from "../middleware/auth.js";
import {
  assignNewListingId,
  uploadAnalyzeFiles,
  uploadBulkImages,
  uploadListingFiles,
  uploadPhotos,
} from "../middleware/upload.js";
import {
  aiLimiter,
  marketplaceLimiter,
  syncLimiter,
} from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  delistBody,
  listingPageQuery,
  listingParams,
  listingUpdateBody,
  publishBody,
} from "../validators/schemas.js";

const router = Router();
router.use(requireAuth);

const params = validate({ params: listingParams });

router.get(
  "/",
  validate({ query: listingPageQuery }),
  asyncHandler(listings.list),
);
// These spend AI credits, so they are limited per user.
router.post(
  "/",
  aiLimiter,
  assignNewListingId,
  uploadListingFiles,
  asyncHandler(listings.create),
);
router.post(
  "/scan",
  aiLimiter,
  assignNewListingId,
  uploadListingFiles,
  asyncHandler(listings.scan),
);
router.post(
  "/bulk",
  aiLimiter,
  assignNewListingId,
  uploadBulkImages,
  asyncHandler(listings.createBulk),
);
router.post(
  "/analyze",
  aiLimiter,
  assignNewListingId,
  uploadAnalyzeFiles,
  asyncHandler(listings.analyze),
);

router.post("/sync", syncLimiter, asyncHandler(listings.sync));

router.get("/:id", params, asyncHandler(listings.get));
router.put(
  "/:id",
  params,
  validate({ body: listingUpdateBody }),
  asyncHandler(listings.update),
);
router.delete("/:id", params, asyncHandler(listings.remove));
router.post(
  "/:id/regenerate",
  aiLimiter,
  params,
  asyncHandler(listings.regenerate),
);
router.post(
  "/:id/publish",
  marketplaceLimiter,
  params,
  validate({ body: publishBody }),
  asyncHandler(listings.publish),
);
router.post(
  "/:id/publish-ebay",
  marketplaceLimiter,
  params,
  validate({ body: publishBody }),
  asyncHandler(listings.publishEbay),
);
router.post(
  "/:id/delist",
  marketplaceLimiter,
  params,
  validate({ body: delistBody }),
  asyncHandler(listings.delist),
);

router.post(
  "/:id/media",
  params,
  asyncHandler(listings.prepareAddPhotos),
  uploadPhotos,
  asyncHandler(listings.addPhotos),
);
router.get("/:id/media/:mediaId", params, asyncHandler(listings.getMedia));
router.delete(
  "/:id/media/:mediaId",
  params,
  asyncHandler(listings.removeMedia),
);

export default router;
