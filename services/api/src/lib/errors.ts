import { z } from 'zod';

export class AppError extends Error {
  status: number;
  details?: any;
  code?: string;

  constructor(message: string, options: { status?: number; details?: any; code?: string } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = options.status ?? 500;
    this.details = options.details;
    this.code = options.code;
  }
}

export class ValidationError extends AppError {
  details: any[];

  constructor(message: string, details: any[]) {
    super(message, { status: 400, details });
    this.name = 'ValidationError';
    this.details = details;
  }
}



/** Stable error codes fixed by 10-BACKEND-VISIONARIO-PRD.md:318-329. */
export const errorCodeSchema = z.enum([
  'PROJECT_NOT_FOUND',
  'LAYER_NOT_FOUND',
  'FEATURE_NOT_FOUND',
  'IMPORT_NOT_FOUND',
  'ROUTE_NOT_FOUND',
  'INVALID_GEOMETRY',
  'GEOMETRY_TYPE_MISMATCH',
  'VERSION_CONFLICT',
  'IMPORT_UNSUPPORTED_FORMAT',
  'VALIDATION_ERROR',
  'INTERNAL_ERROR',
]);

export type ErrorCode = typeof errorCodeSchema[keyof typeof errorCodeSchema];

export const HTTP_STATUS_BY_ERRORCode: Record<ErrorCode, number> = {
  [errorCodeSchema.PROJECT_NOT_FOUND]: 404,
  [errorCodeSchema.LAYER_NOT_FOUND]: 404,
  [errorCodeSchema.FEATURE_NOT_FOUND]: 404,
  [errorCodeSchema.INVALID_GEOMETRY]: 400,
  [errorCodeSchema.VALIDATION_ERROR]: 400,
  [errorCodeSchema.INTERNAL_ERROR]: 500,
};

export const ERROR_CODES = errorCodeSchema as ErrorCode;
export const HTTP_STATUS_BY_CODE = HTTP_STATUS_BY_ERRORCode;

/** Helper to build the standard error response. */
export const buildErrorResponse = (
  code: ErrorCode,
  message: string,
  requestId: string,
): { error: { code: ErrorCode; message: string; requestId: string } } => ({
  error: { code, message, requestId },
});

/** Types for logging and validation. */
export const validationIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;

export const errorSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  requestId: z.string().uuid(),
  details: z.array(validationIssueSchema).optional(),
});

export type Error = z.infer<typeof errorSchema>;
export type ErrorResponse = z.infer<typeof errorSchema>;export const projectNotFound = (id: string) => new Error('Not found');
export const versionConflict = () => new Error('Conflict');
