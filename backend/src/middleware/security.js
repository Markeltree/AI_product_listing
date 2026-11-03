// Secure HTTP headers (Helmet) for a JSON API that is called by the mobile app.
// The API serves no web pages, so the content security policy blocks everything by default.
// The few HTML responses (the invite "connected" page) set their own, slightly wider policy.
import helmet from 'helmet';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  // Photos are fetched by the app (and the Expo web preview on another origin). Sessions are Bearer
  // tokens, not cookies, so letting other origins load a response cannot leak a signed-in user's data.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'no-referrer' },
  // Only takes effect over HTTPS (Railway). 180 days.
  strictTransportSecurity: { maxAge: 15_552_000, includeSubDomains: true },
});

// API responses carry tokens and private listing data, so they must never be cached by a proxy.
// Routes that serve cacheable files (photos) override this.
export function noStore(_req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}
