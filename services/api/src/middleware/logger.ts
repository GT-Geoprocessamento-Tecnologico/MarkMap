import type { Context, Next } from 'hono';

import { getRequestId } from './request-id.js';

type LogFields = Record<string, string | number | boolean | null>;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const levelFromEnv = (value: string | undefined): LogLevel => {
  if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') return value;
  return 'info';
};

/**
 * Structured single-line JSON logger.
 *
 * Deliberately never logs request or response bodies, headers, connection
 * strings or tokens (10-BACKEND-VISIONARIO-PRD.md:421-427). Extra fields must
 * be scalars so a caller cannot smuggle a whole object into the log line.
 */
export const createLogger = (configuredLevel?: string) => {
  const threshold = LEVEL_ORDER[levelFromEnv(configuredLevel)];

  const write = (level: LogLevel, message: string, fields?: LogFields) => {
    if (LEVEL_ORDER[level] < threshold) return;
    const line = {
      level,
      time: new Date().toISOString(),
      message,
      ...fields,
    };
    const serialized = JSON.stringify(line);
    if (level === 'error') process.stderr.write(`${serialized}\n`);
    else process.stdout.write(`${serialized}\n`);
  };

  return {
    debug: (message: string, fields?: LogFields) => write('debug', message, fields),
    info: (message: string, fields?: LogFields) => write('info', message, fields),
    warn: (message: string, fields?: LogFields) => write('warn', message, fields),
    error: (message: string, fields?: LogFields) => write('error', message, fields),
    request: (
      c: Context,
      status: number,
      latencyMs: number,
      extra?: LogFields,
    ) => {
      const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      write(level, 'request', {
        requestId: getRequestId(c),
        method: c.req.method,
        path: c.req.path,
        status,
        latencyMs,
        ...extra,
      });
    },
  };
};

export type Logger = ReturnType<typeof createLogger>;

export const requestLogger = (logger: Logger) => {
  return async (c: Context, next: Next) => {
    const startedAt = performance.now();
    await next();
    logger.request(c, c.res.status, Math.round(performance.now() - startedAt));
  };
};
