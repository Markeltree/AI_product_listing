// Server entry point: prepares folders, connects the database, then starts listening.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createApp } from './app.js';
import { config, integrations } from './config/index.js';
import { initStore } from './db/index.js';
import { startBackgroundJobs, stopBackgroundJobs } from './queue/jobs.js';
import { closeRedis } from './queue/redis.js';
import { log } from './utils/logger.js';

export const app = createApp();

export async function start() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.uploadDir, { recursive: true });
  await initStore();
  const jobs = await startBackgroundJobs();
  const server = app.listen(config.port, () => {
    log.info('server', `Velista Listing AI running at ${config.appUrl}`, { jobs });
    log.info('server', 'Integrations', integrations());
  });
  return server;
}

// Deploys and restarts send SIGTERM: stop accepting requests, let running jobs finish briefly, close Redis.
let stopping = false;
async function shutdown(signal, server) {
  if (stopping) return;
  stopping = true;
  log.info('server', `${signal} received, shutting down`);
  server?.close();
  await stopBackgroundJobs();
  await closeRedis();
  process.exit(0);
}

// Start only when run directly (node src/index.js), not when imported.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start()
    .then((server) => {
      for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => shutdown(signal, server));
    })
    .catch((err) => {
      log.error('server', 'Shutdown failed', { err });
      process.exit(1);
    });
}
