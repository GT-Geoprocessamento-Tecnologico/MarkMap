import { z } from "zod";

/**
 * Stable error codes fixed by 10-BACKEND-VISIONARIO-PRD.md:318-329.
 * The frontend branches on `code`, never on `message`
 * (50-CONTRATOS-DE-INTEGRACAO.md:108), so these strings are API surface.
 */
export const errorCodeSchema = z.enum([
  "PROJECT_NOT_FOUND",
  "LAYER_NOT_FOUND",
  "FEATURE_NOT_FOUND",
  "IMPORT_NOT_FOUND",
  "ROUTE_NOT_FOUND",
  "INVALID_GEOMETRY",
  "GEOMETRY_TYPE_MISMATCH",
  "VERSION_CONFLICT",
  "IMPORT_UNSUPPORTED_FORMAT",
  "VALIDATION_ERROR",
  "PAYLOAD_TOO_LARGE",
  "INTERNAL_ERROR",
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const httpStatusByErrorCode: Record<ErrorCode, number> = {
  PROJECT_NOT_FOUND: 404,
  LAYER_NOT_FOUND: 404,
  FEATURE_NOT_FOUND: 404,
  IMPORT_NOT_FOUND: 404,
  ROUTE_NOT_FOUND: 404,
  INVALID_GEOMETRY: 400,
  GEOMETRY_TYPE_MISMATCH: 400,
  VERSION_CONFLICT: 409,
  IMPORT_UNSUPPORTED_FORMAT: 400,
  VALIDATION_ERROR: 400,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
};

export const validationIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const errorSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  requestId: z.string().uuid(),
  details: z.array(validationIssueSchema).optional(),
});

/** The single envelope every endpoint returns on failure. */
export const errorResponseSchema = z.object({
  error: errorSchema,
});

export type Error = z.infer<typeof errorSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;

export const ErrorCodes = {
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  LAYER_NOT_FOUND: "LAYER_NOT_FOUND",
  FEATURE_NOT_FOUND: "FEATURE_NOT_FOUND",
  IMPORT_NOT_FOUND: "IMPORT_NOT_FOUND",
  ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND",
  INVALID_GEOMETRY: "INVALID_GEOMETRY",
  GEOMETRY_TYPE_MISMATCH: "GEOMETRY_TYPE_MISMATCH",
  VERSION_CONFLICT: "VERSION_CONFLICT",
  IMPORT_UNSUPPORTED_FORMAT: "IMPORT_UNSUPPORTED_FORMAT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const satisfies Record<ErrorCode, string>;

export const buildErrorResponse = (
  code: ErrorCode,
  message: string,
  requestId: string,
): ErrorResponse => ({ error: { code, message, requestId } });
