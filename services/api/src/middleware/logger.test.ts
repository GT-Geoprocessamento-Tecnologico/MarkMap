import { Hono } from "hono";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { createLogger, requestLogger } from "./logger.js";
import { requestId } from "./request-id.js";

describe("Logger Middleware", () => {
  let stdoutMock: ReturnType<typeof vi.spyOn>;
  let stderrMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutMock = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    stderrMock = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2023-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("createLogger", () => {
    it("should write info logs to stdout", () => {
      const logger = createLogger();
      logger.info("test message", { foo: "bar" });

      expect(stdoutMock).toHaveBeenCalledTimes(1);
      expect(stderrMock).not.toHaveBeenCalled();

      const logLine = JSON.parse(stdoutMock.mock.calls[0][0] as string);
      expect(logLine).toEqual({
        level: "info",
        time: "2023-01-01T00:00:00.000Z",
        message: "test message",
        foo: "bar",
      });
    });

    it("should write error logs to stderr", () => {
      const logger = createLogger();
      logger.error("error message", { code: 500 });

      expect(stderrMock).toHaveBeenCalledTimes(1);
      expect(stdoutMock).not.toHaveBeenCalled();

      const logLine = JSON.parse(stderrMock.mock.calls[0][0] as string);
      expect(logLine).toEqual({
        level: "error",
        time: "2023-01-01T00:00:00.000Z",
        message: "error message",
        code: 500,
      });
    });

    it("should suppress logs below configured threshold", () => {
      const logger = createLogger("warn");

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(stdoutMock).toHaveBeenCalledTimes(1); // Only warn
      expect(stderrMock).toHaveBeenCalledTimes(1); // Only error

      const stdoutLog = JSON.parse(stdoutMock.mock.calls[0][0] as string);
      expect(stdoutLog.level).toBe("warn");

      const stderrLog = JSON.parse(stderrMock.mock.calls[0][0] as string);
      expect(stderrLog.level).toBe("error");
    });

    it("should default to info level if invalid level provided", () => {
      const logger = createLogger("invalid_level");

      logger.debug("debug message");
      logger.info("info message");

      expect(stdoutMock).toHaveBeenCalledTimes(1); // debug suppressed, info logged
      const logLine = JSON.parse(stdoutMock.mock.calls[0][0] as string);
      expect(logLine.level).toBe("info");
    });
  });

  describe("requestLogger", () => {
    it("should log successful requests as info", async () => {
      const logger = createLogger();
      const app = new Hono();

      app.use("*", requestId());
      app.use("*", requestLogger(logger));

      app.get("/test", (c) => c.text("ok", 200));

      const req = new Request("http://localhost/test", { method: "GET" });
      await app.fetch(req);

      expect(stdoutMock).toHaveBeenCalledTimes(1);
      const logLine = JSON.parse(stdoutMock.mock.calls[0][0] as string);

      expect(logLine.level).toBe("info");
      expect(logLine.message).toBe("request");
      expect(logLine.method).toBe("GET");
      expect(logLine.path).toBe("/test");
      expect(logLine.status).toBe(200);
      expect(typeof logLine.latencyMs).toBe("number");
      expect(typeof logLine.requestId).toBe("string");
    });

    it("should log client errors as warn", async () => {
      const logger = createLogger();
      const app = new Hono();

      app.use("*", requestId());
      app.use("*", requestLogger(logger));

      app.get("/not-found", (c) => c.text("not found", 404));

      const req = new Request("http://localhost/not-found", { method: "GET" });
      await app.fetch(req);

      expect(stdoutMock).toHaveBeenCalledTimes(1);
      const logLine = JSON.parse(stdoutMock.mock.calls[0][0] as string);

      expect(logLine.level).toBe("warn");
      expect(logLine.status).toBe(404);
    });

    it("should log server errors as error", async () => {
      const logger = createLogger();
      const app = new Hono();

      app.use("*", requestId());
      app.use("*", requestLogger(logger));

      app.post("/crash", (c) => c.text("server error", 500));

      const req = new Request("http://localhost/crash", { method: "POST" });
      await app.fetch(req);

      expect(stderrMock).toHaveBeenCalledTimes(1);
      const logLine = JSON.parse(stderrMock.mock.calls[0][0] as string);

      expect(logLine.level).toBe("error");
      expect(logLine.status).toBe(500);
      expect(logLine.method).toBe("POST");
      expect(logLine.path).toBe("/crash");
    });
  });
});
