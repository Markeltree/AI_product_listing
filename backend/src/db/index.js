// Storage entry point. Picks Supabase when it is configured, otherwise a local SQLite file.
// `store` is a single shared object filled in by initStore() at startup, so modules can import it directly.
import path from 'node:path';
import { config } from '../config/index.js';
import { SqliteStore } from './sqlite.store.js';
import { log } from '../utils/logger.js';

export const store = {};

async function createStore() {
  if (config.supabase.url && config.supabase.serviceKey) {
    const { createClient } = await import('@supabase/supabase-js');
    const { SupabaseStore } = await import('./supabase.store.js');
    const client = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    log.info('db', 'Using Supabase');
    return new SupabaseStore(client);
  }
  log.info('db', `Using local SQLite at ${path.join(config.dataDir, 'velista.db')} (set SUPABASE_URL to switch)`);
  return new SqliteStore(path.join(config.dataDir, 'velista.db'));
}

export async function initStore() {
  const backend = await createStore();
  // Copy every method onto the shared object, bound to the real backend.
  for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(backend))) {
    if (name !== 'constructor') store[name] = backend[name].bind(backend);
  }
  return store;
}
