/** @deprecated Compatibility entry point; use the canonical error schemas. */
export {
  errorResponseSchema as ErrorSchema,
  errorSchema,
  errorCodeSchema,
  ErrorCodes,
  buildErrorResponse,
} from "./src/errors.js";
export type {
  ErrorResponse,
  ErrorCode,
  Error,
  ValidationIssue,
} from "./src/errors.js";
