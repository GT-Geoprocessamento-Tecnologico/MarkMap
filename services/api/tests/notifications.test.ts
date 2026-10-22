import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import type { Env } from "../src/env.js";
import { notificationRoutes } from "../src/routes/notifications.js";

const env: Env = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3000,
  CORS_ORIGINS: "http://localhost:5173",
  LOG_LEVEL: "error",
  corsOrigins: ["http://localhost:5173"],
  hasDatabase: false,
};

const directApp = () => {
  const app = new Hono<{ Variables: { capabilityWorkspaceId?: string } }>();
  app.use("*", async (c, next) => {
    c.set(
      "capabilityWorkspaceId",
      c.req.header("x-workspace") ?? "workspace-a",
    );
    await next();
  });
  notificationRoutes(app);
  return app;
};

type OpenConnection = {
  response: Response;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  controller: AbortController;
};

const liveConnections = new Set<OpenConnection>();

const open = async (app: Hono<any>, workspace = "workspace-a") => {
  const controller = new AbortController();
  const response = await app.request("/notifications", {
    headers: { "x-workspace": workspace },
    signal: controller.signal,
  });
  const reader = response.body?.getReader();
  if (!reader) throw new Error("notification response has no body");
  const connection = { response, reader, controller };
  liveConnections.add(connection);
  return connection;
};

afterEach(async () => {
  for (const connection of liveConnections) {
    connection.controller.abort();
    await connection.reader.cancel();
  }
  liveConnections.clear();
  vi.useRealTimers();
});

describe("notification authorization at both API aliases", () => {
  it.each(["/notifications", "/api/v1/notifications"])(
    "rejects anonymous access to %s",
    async (path) => {
      const response = await createApp(env).request(path);
      expect(response.status).toBe(401);
    },
  );

  it.each(["/notifications", "/api/v1/notifications"])(
    "rejects malformed bearer access to %s without opening a stream",
    async (path) => {
      const response = await createApp(env).request(path, {
        headers: { Authorization: "Bearer invalid" },
      });
      expect(response.status).toBe(401);
    },
  );
});

describe("notification connection bounds and cleanup", () => {
  it("isolates workspace limits and returns Retry-After at the per-workspace cap", async () => {
    const app = directApp();
    const held = await Promise.all([1, 2, 3, 4].map(() => open(app)));
    const rejected = await app.request("/notifications", {
      headers: { "x-workspace": "workspace-a" },
    });
    expect(rejected.status).toBe(429);
    expect(rejected.headers.get("retry-after")).toBe("30");

    const otherWorkspace = await open(app, "workspace-b");
    expect(otherWorkspace.response.status).toBe(200);

    for (const connection of [...held, otherWorkspace]) {
      connection.controller.abort();
      await connection.reader.cancel();
    }
  });

  it("returns 429 at the global connection cap", async () => {
    const app = directApp();
    const held = [] as Awaited<ReturnType<typeof open>>[];
    for (let workspace = 0; workspace < 25; workspace += 1) {
      for (let connection = 0; connection < 4; connection += 1) {
        held.push(await open(app, `workspace-${workspace}`));
      }
    }
    const rejected = await app.request("/notifications", {
      headers: { "x-workspace": "workspace-over-cap" },
    });
    expect(rejected.status).toBe(429);
    expect(rejected.headers.get("retry-after")).toBe("30");
    for (const connection of held) {
      connection.controller.abort();
      await connection.reader.cancel();
    }
  });

  it("emits SSE alert and ping frames, then releases on abort", async () => {
    vi.useFakeTimers();
    const app = directApp();
    const controller = new AbortController();
    const response = await app.request("/notifications", {
      headers: { "x-workspace": "workspace-a" },
      signal: controller.signal,
    });
    const reader = response.body!.getReader();
    await vi.advanceTimersByTimeAsync(5_000);
    const ping = await reader.read();
    expect(new TextDecoder().decode(ping.value)).toContain("event: ping");
    await vi.advanceTimersByTimeAsync(5_000);
    const frames = [new TextDecoder().decode((await reader.read()).value)];
    frames.push(new TextDecoder().decode((await reader.read()).value));
    expect(frames.some((frame) => frame.includes("event: alert"))).toBe(true);
    controller.abort();
    await reader.cancel();

    const replacement = await open(app);
    expect(replacement.response.status).toBe(200);
    replacement.controller.abort();
    await replacement.reader.cancel();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("releases a connection when the consumer cancels the response body", async () => {
    const app = directApp();
    const connection = await open(app);
    await connection.reader.cancel();

    const replacement = await open(app);
    expect(replacement.response.status).toBe(200);
    replacement.controller.abort();
    await replacement.reader.cancel();
  });

  it("closes at the maximum lifetime and leaves no timers", async () => {
    vi.useFakeTimers();
    const app = directApp();
    const connection = await open(app);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    await connection.reader.cancel();
    expect(vi.getTimerCount()).toBe(0);
    const replacement = await open(app);
    expect(replacement.response.status).toBe(200);
    replacement.controller.abort();
    await replacement.reader.cancel();
  });
});
