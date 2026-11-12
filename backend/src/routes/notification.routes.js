import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { store } from "../db/index.js";
import { syncLimiter } from "../middleware/rateLimit.js";
import { notifyUser } from "../services/notifications.service.js";
import { HttpError } from "../utils/errors.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { pushTokenBody } from "../validators/schemas.js";

const router = Router();
router.use(requireAuth);

// A phone moves to the newest account signed in on it.
router.post(
  "/token",
  validate({ body: pushTokenBody }),
  asyncHandler(async (req, res) => {
    await store.savePushToken({
      token: req.body.token,
      userId: req.user.id,
      platform: req.body.platform,
    });
    res.status(204).end();
  }),
);

router.delete(
  "/token",
  validate({ body: pushTokenBody }),
  asyncHandler(async (req, res) => {
    await store.deletePushToken(req.body.token, req.user.id);
    res.status(204).end();
  }),
);

// Sends a test alert to every phone of this seller, so notifications can be checked without publishing.
router.post(
  "/test",
  syncLimiter,
  asyncHandler(async (req, res) => {
    const { devices, problems } = await notifyUser(req.user.id, {
      title: "Velista notifications work",
      body: "You will get alerts like this when a listing is ready or an item sells.",
    });
    if (!devices)
      throw new HttpError(
        409,
        "This phone is not set up for notifications yet. Tap Turn on notifications first.",
      );
    if (problems.length)
      throw new HttpError(
        502,
        `The notification was not delivered: ${problems.join(", ")}`,
      );
    res.json({ devices });
  }),
);

export default router;
