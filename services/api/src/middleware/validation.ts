import type { Context } from "hono";
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
    let body: unknown;

    try {
      body = await c.req.json();
    } catch (err) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: err instanceof Error ? err.message : String(err),
            requestId: c.get("requestId") ?? "unknown",
            details: [],
          },
        },
        400,
      );
    }

    const result = schema.safeParse(body);

    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: result.error.message,
            requestId: c.get("requestId") ?? "unknown",
            details: result.error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
        },
        400,
      );
    }

    // Store the parsed value as a symbol to avoid accidental mutation.
    // Hono's context supports arbitrary setting via `set`.
    c.set("validatedBody", result.data);

    // Keep downstream failures in the application's error boundary. They are
    // not request validation failures and must retain their original status.
    await next();
  };
}
