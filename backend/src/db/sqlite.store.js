import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { OAUTH_STATE_TTL_MS } from '../config/constants.js';
import {
  connectionRow, ebayConnectionRow, haulRow, listingRow, oauthStateRow, toConnection, toEbayConnection, toHaul, toListing,
  toOAuthState, toSummaryRow, toUser, userRow,
} from './mappers.js';

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    settings TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL,
    title TEXT,
    haul_id TEXT,
    summary TEXT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS listings_user_updated ON listings (user_id, updated_at);
  CREATE INDEX IF NOT EXISTS listings_status ON listings (status);
  CREATE TABLE IF NOT EXISTS hauls (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL,
    step TEXT,
    error TEXT,
    source_key TEXT NOT NULL,
    source_mime TEXT NOT NULL,
    source_size INTEGER,
    item_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS hauls_user_created ON hauls (user_id, created_at);
  CREATE TABLE IF NOT EXISTS etsy_connections (
    user_id TEXT PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    etsy_user_id INTEGER,
    shop_id INTEGER,
    shop_name TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ebay_connections (
    user_id TEXT PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    refresh_expires_at INTEGER,
    ebay_user_id TEXT,
    username TEXT,
    prefs TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    verifier TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`;

// SQLite has no JSON column type, so object values are stored as text.
const serialize = (row) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v !== null && typeof v === 'object' ? JSON.stringify(v) : v]));

export class SqliteStore {
  constructor(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(SCHEMA);
    this.addMissingColumns();
  }

  // CREATE TABLE IF NOT EXISTS leaves an existing table alone, so older databases get new columns here.
  addMissingColumns() {
    const columns = this.all('PRAGMA table_info(listings)').map((c) => c.name);
    for (const name of ['haul_id', 'summary']) {
      if (!columns.includes(name)) this.db.exec(`ALTER TABLE listings ADD COLUMN ${name} TEXT`);
    }
    this.db.exec('CREATE INDEX IF NOT EXISTS listings_haul ON listings (haul_id)');
  }

  get(sql, ...params) {
    return this.db.prepare(sql).get(...params);
  }
  all(sql, ...params) {
    return this.db.prepare(sql).all(...params);
  }
  run(sql, ...params) {
    return this.db.prepare(sql).run(...params);
  }

  // ---------- users ----------

  async createUser(u) {
    this.run(
      `INSERT INTO users (id, email, name, password_hash, settings, created_at)
       VALUES (:id, :email, :name, :password_hash, :settings, :created_at)`,
      serialize(userRow(u)),
    );
    return u;
  }
  async findUserByEmail(email) {
    return toUser(this.get('SELECT * FROM users WHERE email = ?', email));
  }
  async findUserById(id) {
    return toUser(this.get('SELECT * FROM users WHERE id = ?', id));
  }
  async updateUserSettings(id, settings) {
    this.run('UPDATE users SET settings = ? WHERE id = ?', JSON.stringify(settings), id);
  }

  // ---------- listings ----------

  async listListingSummaries(userId, { limit, offset }) {
    return this.all('SELECT id, summary FROM listings WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?', userId, limit, offset)
      .map(toSummaryRow);
  }
  async getListing(userId, id) {
    return toListing(this.get('SELECT data FROM listings WHERE id = ? AND user_id = ?', id, userId));
  }
  async saveListing(l) {
    this.run(
      `INSERT INTO listings (id, user_id, status, title, haul_id, summary, data, created_at, updated_at)
       VALUES (:id, :user_id, :status, :title, :haul_id, :summary, :data, :created_at, :updated_at)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, title = excluded.title, haul_id = excluded.haul_id,
         summary = excluded.summary, data = excluded.data, updated_at = excluded.updated_at`,
      serialize(listingRow(l)),
    );
    return l;
  }
  async deleteListing(userId, id) {
    this.run('DELETE FROM listings WHERE id = ? AND user_id = ?', id, userId);
  }
  // Listings in one status (sync: 'published'; startup recovery: 'generating'), for one user or for everyone.
  async listListingsByStatus(status, userId = null) {
    const rows = userId
      ? this.all('SELECT data FROM listings WHERE status = ? AND user_id = ?', status, userId)
      : this.all('SELECT data FROM listings WHERE status = ?', status);
    return rows.map(toListing);
  }

  // ---------- hauls ----------

  async saveHaul(h) {
    this.run(
      `INSERT INTO hauls (id, user_id, status, step, error, source_key, source_mime, source_size, item_count, created_at, updated_at)
       VALUES (:id, :user_id, :status, :step, :error, :source_key, :source_mime, :source_size, :item_count, :created_at, :updated_at)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, step = excluded.step, error = excluded.error,
         source_size = excluded.source_size, item_count = excluded.item_count, updated_at = excluded.updated_at`,
      serialize(haulRow(h)),
    );
  }
  async getHaul(userId, id) {
    return toHaul(this.get('SELECT * FROM hauls WHERE id = ? AND user_id = ?', id, userId));
  }
  async listHauls(userId) {
    return this.all('SELECT * FROM hauls WHERE user_id = ? ORDER BY created_at DESC', userId).map(toHaul);
  }
  async deleteHaul(userId, id) {
    this.run('DELETE FROM hauls WHERE id = ? AND user_id = ?', id, userId);
  }

  // ---------- Etsy connections ----------

  async getConnection(userId) {
    return toConnection(this.get('SELECT * FROM etsy_connections WHERE user_id = ?', userId));
  }
  async saveConnection(c) {
    this.run(
      `INSERT INTO etsy_connections (user_id, access_token, refresh_token, expires_at, etsy_user_id, shop_id, shop_name, updated_at)
       VALUES (:user_id, :access_token, :refresh_token, :expires_at, :etsy_user_id, :shop_id, :shop_name, :updated_at)
       ON CONFLICT(user_id) DO UPDATE SET access_token = excluded.access_token, refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at, etsy_user_id = excluded.etsy_user_id, shop_id = excluded.shop_id,
         shop_name = excluded.shop_name, updated_at = excluded.updated_at`,
      connectionRow(c),
    );
  }
  async deleteConnection(userId) {
    this.run('DELETE FROM etsy_connections WHERE user_id = ?', userId);
  }

  // ---------- eBay connections ----------

  async getEbayConnection(userId) {
    return toEbayConnection(this.get('SELECT * FROM ebay_connections WHERE user_id = ?', userId));
  }
  async saveEbayConnection(c) {
    this.run(
      `INSERT INTO ebay_connections (user_id, access_token, refresh_token, expires_at, refresh_expires_at, ebay_user_id, username, prefs, updated_at)
       VALUES (:user_id, :access_token, :refresh_token, :expires_at, :refresh_expires_at, :ebay_user_id, :username, :prefs, :updated_at)
       ON CONFLICT(user_id) DO UPDATE SET access_token = excluded.access_token, refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at, refresh_expires_at = excluded.refresh_expires_at, ebay_user_id = excluded.ebay_user_id,
         username = excluded.username, prefs = excluded.prefs, updated_at = excluded.updated_at`,
      serialize(ebayConnectionRow(c)),
    );
  }
  async deleteEbayConnection(userId) {
    this.run('DELETE FROM ebay_connections WHERE user_id = ?', userId);
  }

  // ---------- OAuth state (PKCE verifier between redirect and callback) ----------

  async saveOAuthState(s) {
    this.run('DELETE FROM oauth_states WHERE created_at < ?', new Date(Date.now() - OAUTH_STATE_TTL_MS).toISOString());
    this.run(
      'INSERT INTO oauth_states (state, user_id, verifier, created_at) VALUES (:state, :user_id, :verifier, :created_at)',
      oauthStateRow(s),
    );
  }
  async takeOAuthState(state) {
    const row = toOAuthState(this.get('SELECT * FROM oauth_states WHERE state = ?', state));
    if (row) this.run('DELETE FROM oauth_states WHERE state = ?', state);
    return row;
  }
}
