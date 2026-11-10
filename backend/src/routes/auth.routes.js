import { Router } from "express";
import * as auth from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { loginLimiter, signupLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { loginBody, signupBody } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post(
  "/signup",
  signupLimiter,
  validate({ body: signupBody }),
  asyncHandler(auth.signup),
);
router.post(
  "/login",
  loginLimiter,
  validate({ body: loginBody }),
  asyncHandler(auth.login),
);
router.post("/logout", auth.logout);
router.get("/me", requireAuth, auth.me);

export default router;
