import type { z } from 'zod';

/**
 * Validation issue as returned by Zod.
 */
export interface ValidationIssue {
  /** dot‑separated path to the offending field */
  path: string;
  /** human‑readable message */
  message: string;
}

/**
 * Field issue used in various places – same shape as ValidationIssue.
 */
export type FieldIssue = ValidationIssue;

/**
 * Exported error codes that match the contracts Zod enum.
 */
export const enum ErrorCode {
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  LAYER_NOT_FOUND = 'LAYER_NOT_FOUND',
  FEATURE_NOT_FOUND = 'FEATURE_NOT_FOUND',
  IMPORT_NOT_FOUND = 'IMPORT_NOT_FOUND',
  ROUTE_NOT_FOUND = 'ROUTE_NOT_FOUND',
  INVALID_GEOMETRY = 'INVALID_GEOMETRY',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Helper to build the standardized JSON error payload used by the
 * error‑handler middleware.  All routes should return this shape on
 * failure.
 */
export const buildErrorResponse = (
  code: ErrorCode,
  message: string,
  requestId: string,
) => ({
  error: {
    code,
    message,
    requestId,
  },
});

/**
 * Base `AppError` class – carries a stable status code and optional
 * extra details.  Sub‑classes can add domain‑specific fields.
 */
export class AppError extends Error {
  public readonly status: number;
  public readonly details?: any;
  public readonly code?: ErrorCode | undefined;

  constructor(message: string, options: { status?: number; details?: any; code?: ErrorCode } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = options.status ?? 500;
    this.details = options.details;
    this.code = options.code;
  }
}

/**
 * Validation error – carries a list of validation issues.
 */
export class ValidationError extends AppError {
  public readonly details: ValidationIssue[];
  constructor(message: string, details: ValidationIssue[]) {
    super(message, { status: 400, details, code: ErrorCode.VALIDATION_ERROR });
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * Generic Zod validation middleware for Hono.
 *
 * @param schema Zod schema to validate the incoming request body.
 * @returns Middleware that validates the body and attaches the typed
 *          payload to `c.get('validatedBody')`.  On failure it returns a
 *          contract‑compliant `VALIDATION_ERROR` response.
 */
export function validate<T extends z.ZodTypeAny>(schema: T) {
  return async (c: any, next: () => Promise<void>) => {
    try {
      const body = await c.req.json();
      const parsed = schema.parse(body);
      // Store validated body; we rely on the caller to extend the Variables type.
      c.set('validatedBody', parsed);
      await next();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const details = (err as z.ZodError).issues?.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })) ?? [];

      const response = {
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: reason,
          requestId: c.get('requestId') ?? 'unknown',
          details,
        },
      };

      // Hono style response
      return c.status(400).json(response);
    }
  };
}