import { GeometryTypeMismatchError } from "@geonexo/contracts";
import type { ErrorCode } from "@geonexo/contracts/errors";
import {
  InvalidCursorError,
  InvalidGeometryError,
  LayerNotFoundError,
  ProjectNotFoundError,
  VersionConflictError,
} from "@geonexo/db";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { Logger } from "./logger.js";
import { getRequestId } from "./request-id.js";
import { AppError, type FieldIssue } from "../lib/errors.js";

type Variables = {
  requestId: string;
};

/**
 * Masks potential secrets in a string for logging purposes.
 * Looks for common patterns like passwords, API keys, tokens, etc.
 */
function maskSecrets(input: string): string {
  const patterns = [
    /((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/)([^/\s@]+)@/gi,
    /(password|pwd|secret|api[_-]?key|token|auth[_-]?token|access[_-]?token|refresh[_-]?token)[:=]\s*['"]?([^'";,\s]+)['"]?/gi,
    /(authorization)[:=]\s*['"]?Bearer\s+[^'";,\s]+['"]?/gi,
    /("(password|pwd|secret|api[_-]?key|token|auth[_-]?token|access[_-]?token|refresh[_-]?token)"\s*:\s*)"[^"]*"/gi,
  ];

  let masked = input;
  masked = masked.replace(patterns[0]!, "$1[REDACTED]@");
  for (const pattern of patterns.slice(1)) {
    masked = masked.replace(pattern, (match, key, value) => {
      if (value !== undefined) {
        return match.replace(value, "[REDACTED]");
      }
      return match.replace(/[^:=]+$/, "[REDACTED]");
    });
  }
  return masked;
}

const zodIssuesToFieldIssues = (error: {
  issues: readonly { path: readonly (string | number)[]; message: string }[];
}): FieldIssue[] =>
  error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));

type ZodLikeError = Parameters<typeof zodIssuesToFieldIssues>[0];

const isZodError = (error: unknown): error is ZodLikeError =>
  typeof error === "object" &&
  error !== null &&
  "issues" in error &&
  Array.isArray((error as { issues: unknown }).issues);

/**
 * Single place where any thrown value becomes the documented envelope.
 * Stack traces never reach the client; unexpected errors are logged
 * server-side and answered with a generic message.
 */
export const createErrorHandler = (logger: Logger) => {
  return (error: unknown, c: Context<{ Variables: Variables }>) => {
    const requestId = getRequestId(c);

    if (error instanceof AppError) {
      const status = (error.status ?? 500) as ContentfulStatusCode;
      logger.warn("app_error", {
        requestId,
        status,
        code: error.code ?? "UNKNOWN",
      });
      return c.json(
        {
          error: {
            code: error.code ?? "INTERNAL_ERROR",
            message: error.message,
            requestId,
            ...(error.details !== undefined ? { details: error.details } : {}),
          },
        },
        status,
      );
    }

    if (isZodError(error)) {
      const details = zodIssuesToFieldIssues(error);
      logger.warn("validation_error", { requestId, status: 400 });
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Request payload failed validation",
            requestId,
            details,
          },
        },
        400 as ContentfulStatusCode,
      );
    }

    const known = knownDomainError(error);
    if (known) {
      logger.warn("domain_error", {
        requestId,
        status: known.status,
        code: known.code,
      });
      return c.json(
        { error: { code: known.code, message: known.message, requestId } },
        known.status as ContentfulStatusCode,
      );
    }

    // Unexpected 500: log server-side, never expose stack traces or secrets to client.
    const errorMessage = error instanceof Error ? error.message : String(error);
    const detailForLog = maskSecrets(errorMessage).substring(0, 1000);

    logger.error("unhandled_error", {
      requestId,
      name: error instanceof Error ? error.name : typeof error,
      detail: detailForLog,
    });

    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error",
          requestId,
        },
      },
      500 as ContentfulStatusCode,
    );
  };
};

const knownDomainError = (
  error: unknown,
): { code: ErrorCode; status: number; message: string } | null => {
  if (error instanceof InvalidGeometryError)
    return {
      code: "INVALID_GEOMETRY",
      status: 400,
      message: "Geometry is empty or invalid",
    };
  if (error instanceof GeometryTypeMismatchError)
    return {
      code: "GEOMETRY_TYPE_MISMATCH",
      status: 400,
      message: error.message,
    };
  if (error instanceof InvalidCursorError)
    return {
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Invalid pagination cursor",
    };
  if (error instanceof VersionConflictError)
    return { code: "VERSION_CONFLICT", status: 409, message: error.message };
  if (error instanceof ProjectNotFoundError)
    return {
      code: "PROJECT_NOT_FOUND",
      status: 404,
      message: "Project not found",
    };
  if (error instanceof LayerNotFoundError)
    return { code: "LAYER_NOT_FOUND", status: 404, message: "Layer not found" };
  return null;
};

export const notFoundHandler = () => {
  return (c: Context<{ Variables: Variables }>) => {
    return c.json(
      {
        error: {
          code: "ROUTE_NOT_FOUND",
          message: `Route ${c.req.method} ${c.req.path} was not found`,
          requestId: getRequestId(c),
        },
      },
      404 as ContentfulStatusCode,
    );
  };
};
