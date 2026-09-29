import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

import { loadEnv } from './env.js';
import type { Env } from './env.js';
import { createCorsMiddleware } from './middleware/cors.js';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createLogger, requestLogger } from './middleware/logger.js';
import { requestId } from './middleware/request-id.js';
import { healthRoutes } from './routes/health.js';
import { projectRoutes } from './routes/projects.js';
import { layerRoutes } from './routes/layers.js';
import { featureRoutes } from './routes/features.js';

type Variables = {
  requestId: string;
};

/**
 * Assembles the app in the order the PRD asks for: request id, then security
 * headers/CORS, then logging, then routes, with a single error boundary.
 */
export const createApp = (env: Env = loadEnv()) => {
  const logger = createLogger(env.LOG_LEVEL);
  const app = new Hono<{ Variables: Variables }>();

  app.use('*', requestId());
  // API não renderiza HTML: framing totalmente negado (mais estrito que o
  // default SAMEORIGIN do hono/secure-headers).
  app.use('*', secureHeaders({ xFrameOptions: 'DENY' }));
  app.use('*', createCorsMiddleware(env));
  app.use('*', requestLogger(logger));

  app.onError(createErrorHandler(logger));
  app.notFound(notFoundHandler());

  app.route('/', healthRoutes(env));
  projectRoutes(app);
  layerRoutes(app);
  featureRoutes(app);

  return app;
};

export type App = ReturnType<typeof createApp>;
