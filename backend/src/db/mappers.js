import { config } from '../config/index.js';
import { decryptSecret, encryptSecret } from '../utils/secrets.js';

const reveal = (value) => decryptSecret(value, config.tokenEncryptionKey);
const protect = (value) => encryptSecret(value, config.tokenEncryptionKey);

const parseJson = (value, fallback) => (typeof value === 'string' ? JSON.parse(value || 'null') ?? fallback : value ?? fallback);

export const toUser = (r) =>
  r && {
    id: r.id,
    email: r.email,
    name: r.name,
    passwordHash: r.password_hash,
    settings: parseJson(r.settings, {}),
    createdAt: r.created_at,
  };

export const toListing = (r) => r && parseJson(r.data, null);

// The fields shown in the Listings tab. Saved beside the full listing so that tab never has to load it.
export function toListingSummary(l) {
  const images = (l.media || []).filter((m) => m.kind === 'image');
  return {
    id: l.id,
    status: l.status,
    step: l.step,
    error: l.error,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    title: l.content?.title || l.product?.name || 'Untitled listing',
    price: l.product?.price ?? null,
    quantity: l.product?.quantity ?? null,
    thumbnailId: images[0]?.id || null,
    mediaCount: images.length,
    etsyUrl: l.etsy?.url || null,
    ebayUrl: l.ebay?.url || null,
    channels: {
      etsy: l.etsy?.listingId ? (l.etsy.state || (l.etsy.publishedAt ? 'active' : 'draft')) : null,
      ebay: l.ebay?.offerId ? l.ebay.state || 'draft' : null,
    },
    endedReason: l.sync?.endedAt ? l.sync.reason : null,
  };
}

export const toSummaryRow = (r) => ({ id: r.id, summary: parseJson(r.summary, null) });

export const toHaul = (r) =>
  r && {
    id: r.id,
    userId: r.user_id,
    status: r.status,
    step: r.step ?? null,
    error: r.error ?? null,
    sourceKey: r.source_key,
    sourceMime: r.source_mime,
    sourceSize: r.source_size == null ? null : Number(r.source_size),
    itemCount: Number(r.item_count ?? 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };

export const toConnection = (r) =>
  r && {
    userId: r.user_id,
    accessToken: reveal(r.access_token),
    refreshToken: reveal(r.refresh_token),
    expiresAt: Number(r.expires_at),
    etsyUserId: r.etsy_user_id == null ? null : Number(r.etsy_user_id),
    shopId: r.shop_id == null ? null : Number(r.shop_id),
    shopName: r.shop_name || null,
    updatedAt: r.updated_at,
  };

export const toEbayConnection = (r) =>
  r && {
    userId: r.user_id,
    accessToken: reveal(r.access_token),
    refreshToken: reveal(r.refresh_token),
    expiresAt: Number(r.expires_at),
    refreshExpiresAt: r.refresh_expires_at == null ? null : Number(r.refresh_expires_at),
    ebayUserId: r.ebay_user_id || null,
    username: r.username || null,
    prefs: parseJson(r.prefs, {}),
    updatedAt: r.updated_at,
  };

export const toOAuthState = (r) =>
  r && { state: r.state, userId: r.user_id, verifier: r.verifier, createdAt: r.created_at };

// ---------- app object -> row ----------
// JSON columns are passed as objects; the SQLite store stringifies them before writing.

export const userRow = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  password_hash: u.passwordHash,
  settings: u.settings || {},
  created_at: u.createdAt,
});

export const listingRow = (l) => ({
  id: l.id,
  user_id: l.userId,
  status: l.status,
  title: l.content?.title || l.product?.name || '',
  haul_id: l.haulId ?? null,
  summary: toListingSummary(l),
  data: l,
  created_at: l.createdAt,
  updated_at: l.updatedAt,
});

export const haulRow = (h) => ({
  id: h.id,
  user_id: h.userId,
  status: h.status,
  step: h.step ?? null,
  error: h.error ?? null,
  source_key: h.sourceKey,
  source_mime: h.sourceMime,
  source_size: h.sourceSize ?? null,
  item_count: h.itemCount ?? 0,
  created_at: h.createdAt,
  updated_at: h.updatedAt,
});

export const connectionRow = (c) => ({
  user_id: c.userId,
  access_token: protect(c.accessToken),
  refresh_token: protect(c.refreshToken),
  expires_at: c.expiresAt,
  etsy_user_id: c.etsyUserId ?? null,
  shop_id: c.shopId ?? null,
  shop_name: c.shopName ?? null,
  updated_at: new Date().toISOString(),
});

export const ebayConnectionRow = (c) => ({
  user_id: c.userId,
  access_token: protect(c.accessToken),
  refresh_token: protect(c.refreshToken),
  expires_at: c.expiresAt,
  refresh_expires_at: c.refreshExpiresAt ?? null,
  ebay_user_id: c.ebayUserId ?? null,
  username: c.username ?? null,
  prefs: c.prefs || {},
  updated_at: new Date().toISOString(),
});

export const oauthStateRow = (s) => ({
  state: s.state,
  user_id: s.userId,
  verifier: s.verifier,
  created_at: s.createdAt,
});
