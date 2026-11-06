import path from 'node:path';
import express from 'express';
import { config } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRouter from './routes/index.js';

export function createApp() {
  const app = express();

  // Basic security and parsing middlewares
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Custom request logging
  app.use(requestLogger);

  // Serve static files from public directory
  const publicDir = path.resolve(config.rootDir, 'public');
  app.use(express.static(publicDir));

  // Mount API endpoints
  app.use('/api', apiRouter);

  // 404 Catch-all handler
  app.use(notFoundHandler);

  // Centralized Error handling middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
