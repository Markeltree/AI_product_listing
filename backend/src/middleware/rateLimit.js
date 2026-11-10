import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis, redisEnabled } from "../queue/redis.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const byUserOrIp = (req) =>
  req.user ? `user:${req.user.id}` : `ip:${ipKeyGenerator(req.ip)}`;

function limiter({
  name,
  windowMs,
  limit,
  message,
  key = byUserOrIp,
  skipSuccessfulRequests = false,
}) {
  const store = redisEnabled()
    ? new RedisStore({
        prefix: `velista:rl:${name}:`,
        sendCommand: (command, ...args) => redis().call(command, ...args),
      })
    : undefined;
  return rateLimit({
    store,
    passOnStoreError: true,
    windowMs,
    limit,
    keyGenerator: key,
    skipSuccessfulRequests,
    standardHeaders: "draft-8", // RateLimit and RateLimit-Policy headers tell the app when to retry
    legacyHeaders: false,
    handler: (_req, res, _next, options) => {
      res.setHeader("Retry-After", Math.ceil(options.windowMs / 1000));
      res.status(429).json({ error: message, code: "rate_limited" });
    },
  });
}

// Every API call. Generous: the app polls while a listing is being written and loads thumbnails.
export const apiLimiter = limiter({
  name: "api",
  windowMs: MINUTE,
  limit: 1000,
  key: (req) => ipKeyGenerator(req.ip),
  message: "Too many requests. Please slow down and try again in a minute.",
});

// Sign-in: failed attempts only, per IP and email, so one attacker cannot lock out everyone.
export const loginLimiter = limiter({
  name: "login",
  windowMs: 15 * MINUTE,
  limit: 10,
  skipSuccessfulRequests: true,
  key: (req) =>
    `${ipKeyGenerator(req.ip)}:${String(req.body?.email || "")
      .trim()
      .toLowerCase()}`,
  message: "Too many sign-in attempts. Please wait 15 minutes and try again.",
});

export const signupLimiter = limiter({
  name: "signup",
  windowMs: HOUR,
  limit: 5,
  key: (req) => ipKeyGenerator(req.ip),
  message:
    "Too many accounts created from this network. Please try again later.",
});

// Calls that spend AI credits: new listings, bulk upload, photo analysis, regenerate.
export const aiLimiter = limiter({
  name: "ai",
  windowMs: HOUR,
  limit: 60,
  message:
    "You have reached the hourly limit for AI listings. Please try again later.",
});

// Calls to Etsy and eBay (publish, end, connect). Keeps us well inside the marketplaces' own limits.
export const marketplaceLimiter = limiter({
  name: "marketplace",
  windowMs: 10 * MINUTE,
  limit: 60,
  message:
    "Too many marketplace actions. Please wait a few minutes and try again.",
});

// "Check sales now" runs a full sync for the user.
export const syncLimiter = limiter({
  name: "sync",
  windowMs: MINUTE,
  limit: 6,
  message:
    "Sales were just checked. Please wait a minute before checking again.",
});
