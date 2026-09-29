import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Logger } from './logger.js';
import { getRequestId } from './request-id.js';
import { z } from 'zod';
import { httpStatusByErrorCode } from '@geonexo/contracts/error';
import type { ErrorCode } from '@geonexo/contracts/error';
import { ValidationError, FieldIssue } from '../lib/errors';

type Variables = {
  requestId: string;
};

/**
 * Masks potential secrets in a string for logging purposes.
 * Looks for common patterns like passwords, API keys, tokens, etc.
 */
function maskSecrets(input: string): string {
  const patterns = [
    /(password|pwd|secret|api[_-]?key|token|auth[_-]?token|access[_-]?token|refresh[_-]?token)[:=]\s*['"]?([^'";,\s]+)['"]?/gi,
    /(authorization)[:=]\s*['"]?Bearer\s+[^'";,\s]+['"]?/gi,
    /("(password|pwd|secret|api[_-]?key|token|auth[_-]?token|access[_-]?token|refresh[_-]?token)"\s*:\s*)"[^"]*"/gi,
  ];

  let masked = input;
  for (const pattern of patterns) {
    masked = masked.replace(pattern, (match, key, value) => {
      if (value !== undefined) {
        return match.replace(value, '[REDACTED]');
      }
      return match.replace(/[^:=]+$/, '[REDACTED]');
    });
  }
  return masked;
}

const zodIssuesToFieldIssues = (error: {
  issues: readonly { path: readonly (string | number)[]; message: string }[];
}): FieldIssue[] =>
  error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));

type ZodLikeError = Parameters<typeof zodIssuesToFieldIssues>[0];

const isZodError = (error: unknown): error is ZodLikeError =>
  typeof error === 'object' &&
  error !== null &&
  'issues' in error &&
  Array.isArray((error as { issues: unknown }).issues);

/**
 * Single place where any thrown value becomes the documented envelope.
 * Stack traces never reach the client; unexpected errors are logged
 * server-side and answered with a generic message.
 */
export const createErrorHandler = (logger: Logger) => {
  return (error: unknown, c: Context<{ Variables: Variables }>) => {
    const requestId = getRequestId(c);

    if (error instanceof ValidationError) {
      logger.warn('validation_error', { requestId, status: error.status ?? 400 });
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
            requestId,
            details: error.details,
          },
        },
        400 as ContentfulStatusCode,
      );
    }

    if (isZodError(error)) {
      const details = zodIssuesToFieldIssues(error);
      logger.warn('validation_error', { requestId, status: 400 });
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request payload failed validation',
            requestId,
            details,
          },
        },
        400 as ContentfulStatusCode,
      );
    }

    // Unexpected: log the cause, tell the client nothing about it.
    const isProduction = process.env.NODE_ENV === 'production';
    const errorMessage = error instanceof Error ? error.message : String(error);

    // PRODUCTION REDACTION: Mask secrets and truncate long messages before logging
    const detailForLog = isProduction
      ? maskSecrets(errorMessage).substring(0, 1000)
      : errorMessage;

    logger.error('unhandled_error', {
      requestId,
      name: error instanceof Error ? error.name : typeof error,
      detail: detailForLog,
    });

    // Generate sanitized error response based on environment
    let formattedError = {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      requestId,
    };

    if (!isProduction) {
      // Development/staging: include error details for debugging
      formattedError = {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId,
        ...(error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack ?? undefined,
        } : {}),
        ...(typeof error === 'object' && !(error instanceof Error) ? {
          type: Object.prototype.toString.call(error),
        } : {}),
      };
    }

    return c.json(
      {
        error: formattedError,
      },
      500 as ContentfulStatusCode,
    );
  };
};

export const notFoundHandler = () => {
  return (c: Context<{ Variables: Variables }>) => {
    return c.json(
      {
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: `Route ${c.req.method} ${c.req.path} was not found`,
          requestId: getRequestId(c),
        },
      },
      404 as ContentfulStatusCode,
    );
  };
};
