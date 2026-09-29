import { type Context, Hono } from 'hono';
import { z } from 'zod';
import type { z as Z } from 'zod';
import { ValidationError } from '../lib/errors';

/**
 * Generic Zod validation middleware for Hono.
 *
 * @param schema Zod schema to validate incoming request body.
 * @returns Hono middleware that validates and attaches the typed payload
 *          to `c.get('validatedBody')`. On failure it returns a contract
 *          compliant `VALIDATION_ERROR` response.
 */
export function validate<T extends Z.AnyZodObject>(schema: T) {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      const body = (await c.req.json()) as unknown;
      const parsed = schema.parse(body);
      // Store the parsed value as a symbol to avoid accidental mutation.
      // Hono's context supports arbitrary setting via `set`.
      c.set('validatedBody', parsed as Z.infer<T>);
      await next();
    } catch (err) {
      // Zod throws a ZodError.
      const reason = err instanceof Error ? err.message : String(err);
      const details = (
        err instanceof z.ZodError
          ? err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
          : []
      );

      c.status(400);
      await c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: reason,
            requestId: c.get('requestId') || 'unknown',
            details,
          },
        } satisfies import('../lib/errors').Error,
      );
    }
  };
}
