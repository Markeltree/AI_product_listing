// Convert between database rows (snake_case) and app objects (camelCase). Shared by both stores.
// Listings are stored as one JSON document plus indexed columns (status, title, updated_at).

const parseJson = (value, fallback) => (typeof value === 'string' ? JSON.parse(value || 'null') ?? fallback : value ?? fallback);

// ---------- row -> app object ----------

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

export const toConnection = (r) =>
  r && {
    userId: r.user_id,
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: Number(r.expires_at),
    etsyUserId: r.etsy_user_id == null ? null : Number(r.etsy_user_id),
    shopId: r.shop_id == null ? null : Number(r.shop_id),
    shopName: r.shop_name || null,
    updatedAt: r.updated_at,
  };

export const toEbayConnection = (r) =>
  r && {
    userId: r.user_id,
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
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
  data: l,
  created_at: l.createdAt,
  updated_at: l.updatedAt,
});

export const connectionRow = (c) => ({
  user_id: c.userId,
  access_token: c.accessToken,
  refresh_token: c.refreshToken,
  expires_at: c.expiresAt,
  etsy_user_id: c.etsyUserId ?? null,
  shop_id: c.shopId ?? null,
  shop_name: c.shopName ?? null,
  updated_at: new Date().toISOString(),
});

export const ebayConnectionRow = (c) => ({
  user_id: c.userId,
  access_token: c.accessToken,
  refresh_token: c.refreshToken,
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
