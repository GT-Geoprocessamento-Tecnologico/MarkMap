import type { Context } from "hono";
import { z } from "zod";
import type { z as Z } from "zod";

/**
 * Generic Zod validation middleware for Hono.
 *
 * @param schema Zod schema to validate incoming request body.
 * @returns Hono middleware that validates and attaches the typed payload
 *          to `c.get('validatedBody')`. On failure it returns a contract
 *          compliant `VALIDATION_ERROR` response.
 */
export function validate<T extends Z.ZodTypeAny>(schema: T) {
  return async (c: Context, next: () => Promise<void>) => {
    let parsed: Z.infer<T>;
    try {
      const body = (await c.req.json()) as unknown;
      parsed = schema.parse(body);
      // Store the parsed value as a symbol to avoid accidental mutation.
      // Hono's context supports arbitrary setting via `set`.
      c.set("validatedBody", parsed);
    } catch (err) {
      // Zod throws a ZodError.
      const reason = err instanceof Error ? err.message : String(err);
      const details =
        err instanceof z.ZodError
          ? err.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            }))
          : [];

      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: reason,
            requestId: c.get("requestId") ?? "unknown",
            details,
          },
        },
        400,
      );
    }

    // Keep downstream failures in the application's error boundary. They are
    // not request validation failures and must retain their original status.
    await next();
  };
}
