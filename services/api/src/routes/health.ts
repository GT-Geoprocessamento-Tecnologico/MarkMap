import { Hono } from 'hono';

import type { Env } from '../env.js';

const VERSION = '0.1.0';

/**
 * Health probes. Reports whether a database is configured but never exposes the
 * connection string or any credential.
 */
export const healthRoutes = (env: Env) => {
  const routes = new Hono();

  routes.get('/health', async (c) => {
    let dbStatus = env.hasDatabase ? 'configured' : 'not_configured';
    let dbError = undefined;

    if (env.hasDatabase) {
      try {
        const { neon } = await import('@neondatabase/serverless');
        const sqlQuery = neon(env.DATABASE_URL!);
        await sqlQuery`SELECT 1`;
        dbStatus = 'connected';
      } catch (err: any) {
        dbStatus = 'error';
        dbError = err.message;
      }
    }

    return c.json({
      status: 'ok',
      version: VERSION,
      database: dbStatus,
      dbError,
      timestamp: new Date().toISOString(),
    });
  });

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
