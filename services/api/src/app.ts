import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";

import { loadEnv } from "./env.js";
import type { Env } from "./env.js";
import { capabilityMiddleware } from "./middleware/capability.js";
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
import { marketplaceRoutes } from "./routes/marketplace.js";
import { notificationRoutes } from "./routes/notifications.js";
import { projectRoutes } from "./routes/projects.js";
import { storageRoutes } from "./routes/storage.js";
import { syncRoutes } from "./routes/sync.js";
import { workspaceRoutes } from "./routes/workspace.js";

export type Variables = {
  requestId: string;
  validatedBody?: any;
  capabilityWorkspaceId?: string;
  capabilityHash?: string;
  capabilityGeneration?: string;
};

export const createApp = (env: Env = loadEnv()) => {
  const logger = createLogger(env.LOG_LEVEL);
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", requestId());
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

  const apiRoutes = new Hono<{ Variables: Variables }>();
  workspaceRoutes(apiRoutes);
  apiRoutes.use("/sync/*", capabilityMiddleware());
  apiRoutes.use("/notifications", capabilityMiddleware());
  syncRoutes(apiRoutes);
  if (env.NODE_ENV !== "production") {
    projectRoutes(apiRoutes);
    layerRoutes(apiRoutes);
    featureRoutes(apiRoutes);
  }
  marketplaceRoutes(apiRoutes);
  notificationRoutes(apiRoutes);
  app.route("/", apiRoutes);
  app.route("/api/v1", apiRoutes);

  return app;
};

export type App = ReturnType<typeof createApp>;
