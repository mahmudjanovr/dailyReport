import { config } from '../config/env.js';

export function requestLogger(req, res, next) {
  if (config.NODE_ENV === 'test') {
    return next();
  }

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const { statusCode } = res;
    console.log(`[${new Date().toISOString()}] ${method} ${originalUrl} ${statusCode} - ${duration}ms`);
  });

  next();
}
