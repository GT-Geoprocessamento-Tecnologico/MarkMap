import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";

import { loadEnv } from "./env.js";
import type { Env } from "./env.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import {
  createErrorHandler,
  notFoundHandler,
} from "./middleware/error-handler.js";
import { createLogger, requestLogger } from "./middleware/logger.js";
import { requestId } from "./middleware/request-id.js";
import { featureRoutes } from "./routes/features.js";
import { healthRoutes } from "./routes/health.js";
import { layerRoutes } from "./routes/layers.js";
import { notificationRoutes } from "./routes/notifications.js";
import { projectRoutes } from "./routes/projects.js";
import { storageRoutes } from "./routes/storage.js";

type Variables = {
  requestId: string;
  validatedBody?: any;
};

/**
 * Assembles the app in the order the PRD asks for: request id, then security
 * headers/CORS, then logging, then routes, with a single error boundary.
 */
export const createApp = (env: Env = loadEnv()) => {
  const logger = createLogger(env.LOG_LEVEL);
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", requestId());
  // API não renderiza HTML: framing totalmente negado (mais estrito que o
  // default SAMEORIGIN do hono/secure-headers).
  app.use("*", secureHeaders({ xFrameOptions: "DENY" }));
  app.use("*", createCorsMiddleware(env));
  app.use("*", requestLogger(logger));
  app.use("*", async (c, next) => {
    if (c.req.method !== "POST" && c.req.method !== "PATCH") return next();
    return bodyLimit({
      maxSize: 1024 * 1024,
      onError: (context) =>
        context.json(
          {
            error: {
              code: "PAYLOAD_TOO_LARGE",
              message: "Request body exceeds 1 MiB",
              requestId: context.get("requestId") ?? "unknown",
            },
          },
          413,
        ),
    })(c, next);
  });

  app.onError(createErrorHandler(logger));
  app.notFound(notFoundHandler());

  app.route("/", healthRoutes(env));
  app.route("/storage", storageRoutes(env));
  app.route("/api/v1", healthRoutes(env));
  app.route("/api/v1/storage", storageRoutes(env));
  const apiRoutes = new Hono();
  projectRoutes(apiRoutes);
  layerRoutes(apiRoutes);
  featureRoutes(apiRoutes);
  notificationRoutes(apiRoutes);
  app.route("/", apiRoutes);
  app.route("/api/v1", apiRoutes);

  return app;
};

export type App = ReturnType<typeof createApp>;
