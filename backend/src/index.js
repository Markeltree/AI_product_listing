// Server entry point: prepares folders, connects the database, then starts listening.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createApp } from './app.js';
import { config, integrations } from './config/index.js';
import { initStore } from './db/index.js';
import { resumeInterruptedGenerations } from './services/generation.service.js';
import { startSyncLoop } from './services/marketplace.service.js';

export const app = createApp();

export async function start() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.uploadDir, { recursive: true });
  await initStore();
  await resumeInterruptedGenerations().catch((err) => console.error('[generation] resume failed:', err));
  startSyncLoop();
  return app.listen(config.port, () => {
    console.log(`Velista Listing AI running at ${config.appUrl}`);
    console.log('Integrations:', JSON.stringify(integrations()));
  });
}

// Start only when run directly (node src/index.js), not when imported.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
