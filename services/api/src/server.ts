import { closeDb } from "@markmap/db";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";

import { createApp } from "./app.js";
import { loadEnv } from "./env.js";

export type Shutdown = () => Promise<void>;
type ClosableServer = {
  close: (callback?: (error?: Error) => void) => unknown;
};

/**
 * Closes the HTTP listener and this process's database singleton once. The
 * timeout keeps SIGTERM bounded when a client holds a connection open.
 */
export const createGracefulShutdown = (
  server: Pick<ServerType, "close"> | ClosableServer,
  closeDatabase: () => Promise<void> = closeDb,
  timeoutMs = 5_000,
): Shutdown => {
  let closing: Promise<void> | undefined;
  return () => {
    if (closing) return closing;
    closing = (async () => {
      const deadline = Date.now() + timeoutMs;
      const remaining = () => Math.max(0, deadline - Date.now());
      const closeHttp = new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          if (error !== undefined) reject(error);
          else resolve();
        };
        const timer = setTimeout(
          () => finish(new Error("HTTP server shutdown timed out")),
          remaining(),
        );
        try {
          server.close((error) => {
            clearTimeout(timer);
            finish(error);
          });
        } catch (error) {
          clearTimeout(timer);
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      });
      await closeHttp;
      const dbTimer = remaining();
      if (dbTimer <= 0) throw new Error("Database shutdown timed out");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          closeDatabase(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("Database shutdown timed out")),
              dbTimer,
            );
          }),
        ]);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    })();
    return closing;
  };
};

export const registerShutdownHandlers = (
  shutdown: Shutdown,
  signals: NodeJS.Process = process,
): (() => void) => {
  const handler = () => {
    void shutdown().then(
      () => signals.exit(0),
      () => signals.exit(1),
    );
  };
  signals.once("SIGINT", handler);
  signals.once("SIGTERM", handler);
  return () => {
    signals.removeListener("SIGINT", handler);
    signals.removeListener("SIGTERM", handler);
  };
};

export const startServer = (env = loadEnv()) => {
  const app = createApp(env);

  const server = serve(
    { fetch: app.fetch, hostname: env.HOST, port: env.PORT },
    (info) => {
      process.stdout.write(
        `${JSON.stringify({
          level: "info",
          message: "api_started",
          host: env.HOST,
          port: info.port,
          database: env.hasDatabase ? "configured" : "not_configured",
        })}\n`,
      );
    },
  );
  const shutdown = createGracefulShutdown(server);
  registerShutdownHandlers(shutdown);
  return { server, shutdown };
};

if (process.env.NODE_ENV !== "test") startServer();
