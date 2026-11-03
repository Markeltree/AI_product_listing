// Very small in-memory limiter for sign-in and sign-up endpoints. Per process only:
// use a shared store (for example Redis) if you run more than one server instance.
const hits = new Map();

// Drop expired entries now and then so the map does not grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
}, 5 * 60_000).unref();

export function rateLimit({ windowMs = 60_000, max = 15 } = {}) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const current = hits.get(key);
    const entry = current && current.reset > now ? current : { count: 0, reset: now + windowMs };
    entry.count += 1;
    hits.set(key, entry);
    if (entry.count > max) {
      return res.status(429).json({ error: 'Too many attempts. Please wait a minute and try again.' });
    }
    next();
  };
}
