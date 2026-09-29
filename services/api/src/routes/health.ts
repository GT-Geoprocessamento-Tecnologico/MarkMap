import { Hono } from 'hono';

import type { Env } from '../env.js';

const VERSION = '0.1.0';

/**
 * Health probes. Reports whether a database is configured but never exposes the
 * connection string or any credential.
 */
export const healthRoutes = (env: Env) => {
  const routes = new Hono();

  routes.get('/health', (c) =>
    c.json({
      status: 'ok',
      version: VERSION,
      database: env.hasDatabase ? 'configured' : 'not_configured',
      timestamp: new Date().toISOString(),
    }),
  );

  routes.get('/api/v1', (c) =>
    c.json({
      name: 'GeoNexo API',
      version: VERSION,
      endpoints: {
        health: '/health',
      },
    }),
  );

  return routes;
};
