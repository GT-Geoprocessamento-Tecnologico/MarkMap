import { Middleware } from 'hono';
import { z } from 'zod';
import { ValidationError } from '@geonexo/contracts/errors';
import { zodIssuesToFieldIssues } from './error-handler';

/**
 * Generic Zod validation middleware for Hono routes.
 *
 * This middleware is fully type‑safe and returns contract‑compliant ValidationError
 * responses in the exact format expected by the error‑handler.
 *
 * @template T - The shape of the validated payload.
 */

export const validate = <T extends Record<string, unknown>>(schema: z.Schema<T>): Middleware => {
  return async (c, next) => {
    try {
      // Parse JSON payload
      const rawBody = await c.req.json();

      // Handle both object and array bodies (Zod can only parse objects)
      const result = typeof rawBody === 'object' && rawBody !== null
        ? schema.safeParse(rawBody)
        : schema.safeParse({ body: rawBody });

      if (!result.success) {
        // Convert Zod issues to the FieldIssue[] format required by the error handler
        const fieldIssues = zodIssuesToFieldIssues(result.error.issues);
        const err = new ValidationError('Request payload failed validation', fieldIssues);

        // The global error handler will convert this into the proper JSON response
        throw err;
      }

      // Attach the validated, strongly‑typed payload to the request context
      // `c.req.valid()` is a convention used by Hono to expose parsed data.
      // We store the data under the same key so downstream handlers can access it.
      c.set('validatedBody', result.data as T);

      await next();
    } catch (parseError) {
      // Malformed JSON or any other parsing error results in a 400 with a generic message
      const err = new ValidationError('Invalid JSON payload', [
        {
          path: '',
          message: 'Unable to parse request body as JSON',
        },
      ]);
      throw err;
    }
  };
}