// Builds the Express app: middleware, API routes and error handling. The server is API-only;
// the client is the Expo app in ../mobile.
// Kept separate from index.js so tests can import the app without starting a server.
import express from 'express';
import { config } from './config/index.js';
import { cors } from './middleware/cors.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { noStore, securityHeaders } from './middleware/security.js';
import { apiNotFound, errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import apiRoutes from './routes/index.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(securityHeaders);
  if (config.corsOrigins.length) app.use(cors(config.corsOrigins));
  app.use(express.json({ limit: '256kb' }));

  app.use('/api', requestLogger);
  app.use('/api', noStore);
  app.use('/api', apiLimiter);
  app.use('/api', apiRoutes);
  app.use('/api', apiNotFound);

  app.get('/', (_req, res) => res.json({ name: 'Velista API', health: '/api/health' }));

  app.use(errorHandler);
  return app;
}
