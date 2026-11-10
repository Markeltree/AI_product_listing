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
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'no-referrer' },
  // Only takes effect over HTTPS (Railway). 180 days.
  strictTransportSecurity: { maxAge: 15_552_000, includeSubDomains: true },
});

export function noStore(_req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}
