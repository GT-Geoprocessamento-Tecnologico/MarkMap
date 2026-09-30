import { describe, expect, it, vi } from "vitest";

import { createGracefulShutdown } from "../src/server.js";

describe("server shutdown lifecycle", () => {
  it("closes the HTTP server and database once, with an idempotent promise", async () => {
    let closeCallback: (() => void) | undefined;
    const server = {
      close: vi.fn((callback?: (error?: Error) => void) => {
        closeCallback = callback;
      }),
    };
    const closeDatabase = vi.fn(async () => undefined);
    const shutdown = createGracefulShutdown(server, closeDatabase, 100);

    const first = shutdown();
    const second = shutdown();
    closeCallback?.();
    await Promise.all([first, second]);

    expect(first).toBe(second);
    expect(server.close).toHaveBeenCalledOnce();
    expect(closeDatabase).toHaveBeenCalledOnce();
  });

  it("rejects shutdown when the HTTP close callback reports failure", async () => {
    const server = {
      close: vi.fn((callback?: (error?: Error) => void) =>
        callback?.(new Error("close failed")),
      ),
    };
    const closeDatabase = vi.fn(async () => undefined);
    const shutdown = createGracefulShutdown(server, closeDatabase, 100);
    await expect(shutdown()).rejects.toThrow("close failed");
    expect(closeDatabase).not.toHaveBeenCalled();
  });

  it("rejects shutdown when database cleanup fails", async () => {
    const server = {
      close: vi.fn((callback?: (error?: Error) => void) => callback?.()),
    };
    const closeDatabase = vi.fn(async () => {
      throw new Error("db close failed");
    });
    const shutdown = createGracefulShutdown(server, closeDatabase, 100);
    await expect(shutdown()).rejects.toThrow("db close failed");
  });
});
