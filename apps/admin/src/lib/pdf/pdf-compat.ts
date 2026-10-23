type PromiseWithResolvers<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

type PromiseConstructorWithResolvers = PromiseConstructor & {
  withResolvers?: <T>() => PromiseWithResolvers<T>;
};

/**
 * PDF.js 6.3's legacy bundle still calls Promise.withResolvers directly.
 * Safari 16 does not expose it, so install only the missing standard method.
 */
export function ensurePromiseWithResolvers(
  target: { Promise: PromiseConstructorWithResolvers } = globalThis,
): void {
  const promiseConstructor = target.Promise as PromiseConstructorWithResolvers;
  if (typeof promiseConstructor.withResolvers === "function") return;
  Object.defineProperty(promiseConstructor, "withResolvers", {
    configurable: true,
    writable: true,
    value: function withResolvers<T>(
      this: PromiseConstructor,
    ): PromiseWithResolvers<T> {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const constructor = this as PromiseConstructor;
      if (typeof constructor !== "function")
        throw new TypeError(
          "Promise.withResolvers receiver is not a constructor.",
        );
      const promise = new constructor<T>((nextResolve, nextReject) => {
        resolve = nextResolve;
        reject = nextReject;
      });
      if (typeof resolve !== "function" || typeof reject !== "function")
        throw new TypeError(
          "Promise constructor did not provide resolving functions.",
        );
      return { promise, resolve, reject };
    },
  });
}

ensurePromiseWithResolvers();
