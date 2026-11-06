import { OAUTH_STATE_TTL_MS } from '../config/constants.js';
import { HttpError } from '../utils/errors.js';
import {
  connectionRow, ebayConnectionRow, haulRow, listingRow, oauthStateRow, toConnection, toEbayConnection, toHaul, toListing,
  toOAuthState, toSummaryRow, toUser, userRow,
} from './mappers.js';

export class SupabaseStore {
  constructor(client) {
    this.client = client;
  }

  // Throws on a Supabase error, otherwise returns the row data.
  async query(operation, request) {
    const res = await request;
    if (res.error) {
      // PGRST205 and 42703: a table or column is not in the database yet (schema.sql was not re-run after an update).
      if (['PGRST205', '42703'].includes(res.error.code) || /schema cache/i.test(res.error.message)) {
        throw new HttpError(503, `The database is out of date (${operation}). Run supabase/schema.sql in the Supabase SQL editor, then try again.`);
      }
      throw new Error(`Database error (${operation}): ${res.error.message}`);
    }
    return res.data;
  }

  table(name) {
    return this.client.from(name);
  }

  // ---------- users ----------

  async createUser(u) {
    await this.query('createUser', this.table('users').insert(userRow(u)));
    return u;
  }
  async findUserByEmail(email) {
    return toUser(await this.query('findUserByEmail', this.table('users').select('*').eq('email', email).maybeSingle()));
  }
  async findUserById(id) {
    return toUser(await this.query('findUserById', this.table('users').select('*').eq('id', id).maybeSingle()));
  }
  async updateUserSettings(id, settings) {
    await this.query('updateUserSettings', this.table('users').update({ settings }).eq('id', id));
  }

  // ---------- listings ----------

  async listListingSummaries(userId, { limit, offset }) {
    const data = await this.query(
      'listListingSummaries',
      this.table('listings').select('id, summary').eq('user_id', userId)
        .order('updated_at', { ascending: false }).range(offset, offset + limit - 1),
    );
    return (data || []).map(toSummaryRow);
  }
  async getListing(userId, id) {
    return toListing(await this.query(
      'getListing',
      this.table('listings').select('data').eq('id', id).eq('user_id', userId).maybeSingle(),
    ));
  }
  async saveListing(l) {
    await this.query('saveListing', this.table('listings').upsert(listingRow(l)));
    return l;
  }
  async deleteListing(userId, id) {
    await this.query('deleteListing', this.table('listings').delete().eq('id', id).eq('user_id', userId));
  }

  // Listings in one status (sync: 'published'; startup recovery: 'generating'), for one user or for everyone.
  async listListingsByStatus(status, userId = null) {
    const request = this.table('listings').select('data').eq('status', status);
    const data = await this.query('listListingsByStatus', userId ? request.eq('user_id', userId) : request);
    return (data || []).map(toListing);
  }

  // ---------- hauls ----------

  async saveHaul(h) {
    await this.query('saveHaul', this.table('hauls').upsert(haulRow(h)));
  }
  async getHaul(userId, id) {
    return toHaul(await this.query('getHaul', this.table('hauls').select('*').eq('id', id).eq('user_id', userId).maybeSingle()));
  }
  async listHauls(userId) {
    const data = await this.query('listHauls', this.table('hauls').select('*').eq('user_id', userId).order('created_at', { ascending: false }));
    return (data || []).map(toHaul);
  }
  async deleteHaul(userId, id) {
    await this.query('deleteHaul', this.table('hauls').delete().eq('id', id).eq('user_id', userId));
  }

  // ---------- eBay connections ----------

  async getEbayConnection(userId) {
    return toEbayConnection(await this.query(
      'getEbayConnection',
      this.table('ebay_connections').select('*').eq('user_id', userId).maybeSingle(),
    ));
  }
  async saveEbayConnection(c) {
    await this.query('saveEbayConnection', this.table('ebay_connections').upsert(ebayConnectionRow(c)));
  }
  async deleteEbayConnection(userId) {
    await this.query('deleteEbayConnection', this.table('ebay_connections').delete().eq('user_id', userId));
  }

  // ---------- Etsy connections ----------

  async getConnection(userId) {
    return toConnection(await this.query(
      'getConnection',
      this.table('etsy_connections').select('*').eq('user_id', userId).maybeSingle(),
    ));
  }
  async saveConnection(c) {
    await this.query('saveConnection', this.table('etsy_connections').upsert(connectionRow(c)));
  }
  async deleteConnection(userId) {
    await this.query('deleteConnection', this.table('etsy_connections').delete().eq('user_id', userId));
  }

  // ---------- OAuth state (PKCE verifier between redirect and callback) ----------

  async saveOAuthState(s) {
    // Best-effort cleanup of expired rows; a failure here should not block the connection.
    await this.table('oauth_states').delete().lt('created_at', new Date(Date.now() - OAUTH_STATE_TTL_MS).toISOString());
    await this.query('saveOAuthState', this.table('oauth_states').insert(oauthStateRow(s)));
  }
  async takeOAuthState(state) {
    const data = await this.query('takeOAuthState', this.table('oauth_states').select('*').eq('state', state).maybeSingle());
    if (data) await this.table('oauth_states').delete().eq('state', state);
    return toOAuthState(data);
  }
}
