import { describe, expect, it, vi } from "vitest";
import { ensurePromiseWithResolvers } from "./pdf-compat";

describe("PDF runtime compatibility", () => {
  it("preserves a native implementation", () => {
    const native = vi.fn(() => ({ promise: Promise.resolve("native"), resolve: vi.fn(), reject: vi.fn() }));
    const targetPromise = Promise as PromiseConstructor & { withResolvers?: typeof native };
    const existing = targetPromise.withResolvers;
    Object.defineProperty(targetPromise, "withResolvers", { configurable: true, writable: true, value: native });
    try {
      ensurePromiseWithResolvers({ Promise: targetPromise as never });
      expect(targetPromise.withResolvers).toBe(native);
    } finally {
      if (existing) Object.defineProperty(targetPromise, "withResolvers", { configurable: true, writable: true, value: existing });
      else delete targetPromise.withResolvers;
    }
  });

  it("provides generic promise resolution and rejection semantics", async () => {
    const targetPromise = Promise as PromiseConstructor & { withResolvers?: <T>() => { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void; reject: (reason?: unknown) => void } };
    const target = { Promise: targetPromise };
    const existing = targetPromise.withResolvers;
    delete targetPromise.withResolvers;
    try {
      ensurePromiseWithResolvers(target);
      const resolved = targetPromise.withResolvers!<number>();
      resolved.resolve(42);
      await expect(resolved.promise).resolves.toBe(42);
      const rejected = targetPromise.withResolvers!<never>();
      rejected.reject(new Error("expected"));
      await expect(rejected.promise).rejects.toThrow("expected");

      class CustomPromise<T> extends Promise<T> {}
      const generic = targetPromise.withResolvers!.call(CustomPromise);
      expect(generic.promise).toBeInstanceOf(CustomPromise);
      expect(() => targetPromise.withResolvers!.call(undefined as never)).toThrow(TypeError);
      expect(() => targetPromise.withResolvers!.call(null as never)).toThrow(TypeError);
      expect(() => targetPromise.withResolvers!.call({} as never)).toThrow(TypeError);
    } finally {
      if (existing) Object.defineProperty(targetPromise, "withResolvers", { configurable: true, writable: true, value: existing });
      else delete targetPromise.withResolvers;
    }
  });
});
