import { describe, it, expect } from "vitest";

import { createErrorHandler } from "../src/middleware/error-handler.js";
import type { Logger } from "../src/middleware/logger.js";

const mockContext = () => ({
  get: (key: string) => (key === "requestId" ? "test-request-id" : undefined),
  set: () => {},
  status: (code: number) => ({
    json: (data: any) => ({ statusCode: code, body: data }),
  }),
  json: (data: any, status: number) => ({ statusCode: status, body: data }),
  req: { method: "GET", path: "/test" },
});

// Simple in‑memory logger for test
const logBuffer: any[] = [];
const testLogger: Logger = {
  debug: (msg, meta) => logBuffer.push({ level: "debug", msg, meta }),
  info: (msg, meta) => logBuffer.push({ level: "info", msg, meta }),
  warn: (msg, meta) => logBuffer.push({ level: "warn", msg, meta }),
  error: (msg, meta) => logBuffer.push({ level: "error", msg, meta }),
  request: () => {},
};

describe("error-handler production redaction", () => {
  it("redacts secrets and truncates detail in production", async () => {
    const handler = createErrorHandler(testLogger);
    const mockErr = new Error("Secret password=1234");
    const c = mockContext();
    process.env.NODE_ENV = "production";
    const res = await handler(mockErr, c as any);
    const json = (res as any).body as any;
    expect(json.error.detail).toBeUndefined();
    const log = logBuffer.find((l) => l.level === "error");
    expect(log).toBeDefined();
    expect(log.meta.detail).toContain("[REDACTED]");
  });
});
