import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { OAUTH_STATE_TTL_MS } from '../config/constants.js';
import {
  connectionRow, ebayConnectionRow, listingRow, oauthStateRow, toConnection, toEbayConnection, toListing, toOAuthState,
  toUser, userRow,
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
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS listings_user_updated ON listings (user_id, updated_at);
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

  async listListings(userId) {
    return this.all('SELECT data FROM listings WHERE user_id = ? ORDER BY updated_at DESC', userId).map(toListing);
  }
  async getListing(userId, id) {
    return toListing(this.get('SELECT data FROM listings WHERE id = ? AND user_id = ?', id, userId));
  }
  async saveListing(l) {
    this.run(
      `INSERT INTO listings (id, user_id, status, title, data, created_at, updated_at)
       VALUES (:id, :user_id, :status, :title, :data, :created_at, :updated_at)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, title = excluded.title,
         data = excluded.data, updated_at = excluded.updated_at`,
      serialize(listingRow(l)),
    );
    return l;
  }
  async deleteListing(userId, id) {
    this.run('DELETE FROM listings WHERE id = ? AND user_id = ?', id, userId);
  }
  // Every user's listings in one status (sync: 'published'; startup recovery: 'generating').
  async listListingsByStatus(status) {
    return this.all('SELECT data FROM listings WHERE status = ?', status).map(toListing);
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
