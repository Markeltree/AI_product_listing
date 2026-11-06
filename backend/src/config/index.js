// Runtime configuration, read once from the environment (.env).
import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const port = Number(process.env.PORT || 3000);
const appUrl = (process.env.APP_URL || `http://localhost:${port}`).replace(/\/$/, '');

const list = (value) => String(value || '').split(',').map((v) => v.trim()).filter(Boolean);

if (!process.env.SESSION_SECRET) {
  console.warn('[config] SESSION_SECRET is not set; using a random secret. Users will be signed out on restart.');
}

export const config = {
  root,
  port,
  appUrl,
  dataDir: process.env.DATA_DIR || path.join(root, 'data'),
  uploadDir: process.env.UPLOAD_DIR || path.join(root, 'uploads'),
  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  sessionMaxAgeMs: 1000 * 60 * 60 * 24 * 14,

  // Proxies in front of the server whose X-Forwarded-For can be trusted for the client IP (rate limits).
  // Railway has one. Set TRUST_PROXY=0 when the server is reached directly.
  trustProxy: Number(process.env.TRUST_PROXY ?? 1),

  // Origins allowed to call the API from a browser (for example the Expo web preview). Native apps do not need it.
  corsOrigins: list(process.env.CORS_ORIGINS),

  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1',
  },

  etsy: {
    // Advanced: override these only for a proxy or the local mock server (npm run mock:etsy).
    apiBase: process.env.ETSY_API_BASE || 'https://api.etsy.com/v3',
    authorizeUrl: process.env.ETSY_AUTHORIZE_URL || 'https://www.etsy.com/oauth/connect',
    tokenUrl: process.env.ETSY_TOKEN_URL || 'https://api.etsy.com/v3/public/oauth/token',
    // Keystring from your Etsy app. Keep ETSY_SHARED_SECRET separate if your app shows one.
    apiKey: process.env.ETSY_API_KEY || '',
    sharedSecret: process.env.ETSY_SHARED_SECRET || '',
    redirectUri: process.env.ETSY_REDIRECT_URI || `${appUrl}/api/etsy/callback`,
    scopes: process.env.ETSY_SCOPES || 'email_r shops_r listings_r listings_w',
  },

  // eBay Sell APIs (Inventory, Account, Taxonomy, Media). Docs: https://developer.ebay.com/develop/apis
  ebay: (() => {
    const sandbox = (process.env.EBAY_ENV || 'production').toLowerCase() === 'sandbox';
    const host = (sub) => `https://${sub}.${sandbox ? 'sandbox.' : ''}ebay.com`;
    return {
      sandbox,
      clientId: process.env.EBAY_CLIENT_ID || '',
      clientSecret: process.env.EBAY_CLIENT_SECRET || '',
      // eBay does not take a redirect URL: it takes the RuName from your developer account, whose
      // "auth accepted URL" must point at APP_URL + /api/ebay/callback (HTTPS).
      ruName: process.env.EBAY_RUNAME || '',
      marketplaceId: process.env.EBAY_MARKETPLACE_ID || 'EBAY_US',
      currency: process.env.EBAY_CURRENCY || 'USD',
      contentLanguage: process.env.EBAY_CONTENT_LANGUAGE || 'en-US',
      scopes: process.env.EBAY_SCOPES || [
        'https://api.ebay.com/oauth/api_scope',
        'https://api.ebay.com/oauth/api_scope/sell.inventory',
        'https://api.ebay.com/oauth/api_scope/sell.account',
        'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
      ].join(' '),
      // Advanced: override for a proxy or the local mock server (npm run dev:mock).
      apiBase: process.env.EBAY_API_BASE || host('api'),
      mediaBase: process.env.EBAY_MEDIA_BASE || host('apim'),
      identityBase: process.env.EBAY_IDENTITY_BASE || host('apiz'),
      authorizeUrl: process.env.EBAY_AUTHORIZE_URL || `${host('auth')}/oauth2/authorize`,
      tokenUrl: process.env.EBAY_TOKEN_URL || `${host('api')}/identity/v1/oauth2/token`,
      itemUrlBase: process.env.EBAY_ITEM_URL_BASE || `${sandbox ? 'https://sandbox.ebay.com' : 'https://www.ebay.com'}/itm/`,
    };
  })(),

  // Encrypts Etsy and eBay tokens in the database. Keep it safe: if it is lost, sellers must reconnect.
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || '',
  // Comma-separated emails allowed to sign up. Empty means anyone can.
  signupAllowlist: (process.env.ALLOWED_SIGNUP_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),

  // Redis (optional). When set, generation and the cross-delist sync run on BullMQ queues and rate-limit
  // counters are shared between servers. Railway: use the Redis service's REDIS_URL reference variable.
  redisUrl: process.env.REDIS_URL || '',
  // Key prefix for the BullMQ queues, so several environments can share one Redis.
  queuePrefix: process.env.QUEUE_PREFIX || 'velista',
  // Listings written at the same time by one server (each is one AI call).
  generationConcurrency: Math.max(1, Number(process.env.GENERATION_CONCURRENCY || 2)),

  // How often listings live on both Etsy and eBay are checked, so a sale or end on one
  // marketplace ends the copy on the other. 0 turns the background check off.
  syncIntervalMs: Math.max(0, Number(process.env.SYNC_INTERVAL_MINUTES ?? 3)) * 60 * 1000,

  // URL scheme used by the mobile app for deep links (velista://settings).
  mobileScheme: process.env.MOBILE_SCHEME || 'velista',

  // Bundled binaries (ffmpeg-static / ffprobe-static) are used unless a path is set in .env.
  ffmpeg: process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg',
  ffprobe: process.env.FFPROBE_PATH || ffprobeStatic?.path || 'ffprobe',
};

export const integrations = () => ({
  database: config.supabase.url && config.supabase.serviceKey ? 'supabase' : 'local-sqlite',
  anthropic: Boolean(config.anthropic.apiKey),
  openai: Boolean(config.openai.apiKey),
  etsy: Boolean(config.etsy.apiKey),
  ebay: Boolean(config.ebay.clientId && config.ebay.clientSecret && config.ebay.ruName),
  queue: config.redisUrl ? 'bullmq' : 'in-process',
  tokenEncryption: Boolean(config.tokenEncryptionKey),
});
