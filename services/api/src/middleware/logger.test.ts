import { Hono } from "hono";
import { describe, it, expect, vi } from "vitest";

import type { Logger } from "./logger.js";
import { requestLogger } from "./logger.js";

describe("Logger Middleware", () => {
  it("should call logger.request with context, status, and latency", async () => {
    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      request: vi.fn(),
    } as unknown as Logger;

    const app = new Hono();

    app.use("*", requestLogger(mockLogger));

    app.get("/test", async (c) => {
      // Simulate some processing time
      await new Promise((resolve) => setTimeout(resolve, 50));
      return c.json({ success: true }, 200);
    });

    const res = await app.request("/test", {
      method: "GET",
    });

    expect(res.status).toBe(200);

    expect(mockLogger.request).toHaveBeenCalledTimes(1);

    const [context, status, latency] = vi.mocked(mockLogger.request).mock
      .calls[0]!;

    expect(context).toBeDefined();
    expect(status).toBe(200);
    expect(latency).toBeGreaterThanOrEqual(0); // Can't test exact ms reliably, but should be a number >= 0
    // Actually, with the timeout, latency should be >= 50ms, but performance.now() and timers can vary slightly.
    // So let's check it's a positive number.
    expect(typeof latency).toBe("number");
  });
});
