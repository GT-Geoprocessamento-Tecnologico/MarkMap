import {
  ErrorCodes as ERROR_CODES,
  httpStatusByErrorCode as HTTP_STATUS_BY_CODE,
} from "@markmap/contracts";
import type { z } from "zod";

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
  PROJECT_NOT_FOUND = "PROJECT_NOT_FOUND",
  LAYER_NOT_FOUND = "LAYER_NOT_FOUND",
  FEATURE_NOT_FOUND = "FEATURE_NOT_FOUND",
  IMPORT_NOT_FOUND = "IMPORT_NOT_FOUND",
  ROUTE_NOT_FOUND = "ROUTE_NOT_FOUND",
  INVALID_GEOMETRY = "INVALID_GEOMETRY",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
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

export { ERROR_CODES, HTTP_STATUS_BY_CODE };

/**
 * Base `AppError` class – carries a stable status code and optional
 * extra details.  Sub‑classes can add domain‑specific fields.
 */
export class AppError extends Error {
  public readonly status: number;
  public readonly details?: unknown;
  public readonly code?: ErrorCode | string | undefined;

  constructor(
    message: string,
    options: {
      status?: number;
      details?: unknown;
      code?: ErrorCode | string;
    } = {},
  ) {
    super(message);
    this.name = "AppError";
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
    this.name = "ValidationError";
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(
    message: string,
    code: ErrorCode | string = ErrorCode.INTERNAL_ERROR,
  ) {
    super(message, { status: 404, code });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: ErrorCode | string = "VERSION_CONFLICT") {
    super(message, { status: 409, code });
    this.name = "ConflictError";
  }
}

export const projectNotFound = (id: string) =>
  new NotFoundError(`Project not found: ${id}`, ERROR_CODES.PROJECT_NOT_FOUND);

export const layerNotFound = (id: string) =>
  new NotFoundError(`Layer not found: ${id}`, ERROR_CODES.LAYER_NOT_FOUND);

export const featureNotFound = (id: string) =>
  new NotFoundError(`Feature not found: ${id}`, ERROR_CODES.FEATURE_NOT_FOUND);

export const versionConflict = (expected: number, actual: number) =>
  new ConflictError(
    `Version conflict: expected ${expected}, got ${actual}`,
    ERROR_CODES.VERSION_CONFLICT,
  );

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
      c.set("validatedBody", parsed);
      await next();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const details =
        (err as z.ZodError).issues?.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })) ?? [];

      const response = {
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: reason,
          requestId: c.get("requestId") ?? "unknown",
          details,
        },
      };

      // Hono style response
      return c.status(400).json(response);
    }
  };
}
