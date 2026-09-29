import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApp } from '../src/app.js';
import type { Env } from '../src/env.js';
import {
  AppError,
  ERROR_CODES,
  HTTP_STATUS_BY_CODE,
  ConflictError,
  NotFoundError,
  ValidationError,
  featureNotFound,
  layerNotFound,
  projectNotFound,
  versionConflict,
} from '../src/lib/errors.js';

const testEnv: Env = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 3000,
  CORS_ORIGINS: 'http://localhost:5173',
  LOG_LEVEL: 'error',
  corsOrigins: ['http://localhost:5173'],
  hasDatabase: false,
};

const app = createApp(testEnv);

describe('error classes', () => {
  it('maps every documented code to a status', () => {
    expect(HTTP_STATUS_BY_CODE.PROJECT_NOT_FOUND).toBe(404);
    expect(HTTP_STATUS_BY_CODE.LAYER_NOT_FOUND).toBe(404);
    expect(HTTP_STATUS_BY_CODE.FEATURE_NOT_FOUND).toBe(404);
    expect(HTTP_STATUS_BY_CODE.INVALID_GEOMETRY).toBe(400);
    expect(HTTP_STATUS_BY_CODE.GEOMETRY_TYPE_MISMATCH).toBe(400);
    expect(HTTP_STATUS_BY_CODE.VERSION_CONFLICT).toBe(409);
    expect(HTTP_STATUS_BY_CODE.IMPORT_UNSUPPORTED_FORMAT).toBe(400);
    expect(HTTP_STATUS_BY_CODE.VALIDATION_ERROR).toBe(400);
    expect(HTTP_STATUS_BY_CODE.INTERNAL_ERROR).toBe(500);
  });

  it('builds 404 errors for the not-found helpers', () => {
    expect(projectNotFound('abc')).toBeInstanceOf(NotFoundError);
    expect(projectNotFound('abc').status).toBe(404);
    expect(layerNotFound('abc').code).toBe(ERROR_CODES.LAYER_NOT_FOUND);
    expect(featureNotFound('abc').code).toBe(ERROR_CODES.FEATURE_NOT_FOUND);
  });

  it('builds a 409 for a version conflict', () => {
    const error = versionConflict(1, 2);
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.status).toBe(409);
    expect(error.code).toBe(ERROR_CODES.VERSION_CONFLICT);
    expect(error.message).toContain('1');
    expect(error.message).toContain('2');
  });

  it('carries validation details when present', () => {
    const error = new ValidationError('bad', [{ path: 'name', message: 'required' }]);
    expect(error.status).toBe(400);
    expect(error.details).toHaveLength(1);
  });
});

describe('error envelope over HTTP', () => {
  it('returns the envelope with a generated requestId on an unknown route', async () => {
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe(ERROR_CODES.ROUTE_NOT_FOUND);
    expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('echoes a client-supplied UUID requestId', async () => {
    const supplied = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    const res = await app.request('/nope', { headers: { 'x-request-id': supplied } });
    const body = (await res.json()) as { error: { requestId: string } };
    expect(body.error.requestId).toBe(supplied);
    expect(res.headers.get('x-request-id')).toBe(supplied);
  });

  it('replaces a malformed requestId with a fresh UUID', async () => {
    const res = await app.request('/nope', { headers: { 'x-request-id': 'not-a-uuid' } });
    const body = (await res.json()) as { error: { requestId: string } };
    expect(body.error.requestId).not.toBe('not-a-uuid');
    expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('converts a thrown ZodError into VALIDATION_ERROR with field details', async () => {
    const schema = z.object({ name: z.string() });
    const probeApp = createApp(testEnv);
    probeApp.get('/probe-throw', (c) => {
      schema.parse({});
      return c.json({});
    });

    const res = await probeApp.request('/probe-throw');
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; details: { path: string; message: string }[] };
    };
    expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(body.error.details[0]?.path).toBe('name');
  });

  it('hides internals of an unexpected error and answers 500', async () => {
    const probeApp = createApp(testEnv);
    probeApp.get('/boom', () => {
      throw new Error('connection string postgres://user:secret@host/db failed');
    });

    const res = await probeApp.request('/boom');
    expect(res.status).toBe(500);
    const raw = await res.text();
    expect(raw).not.toContain('secret');
    expect(raw).not.toContain('postgres://');
    const body = JSON.parse(raw) as { error: { code: string; message: string } };
    expect(body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(body.error.message).toBe('Internal server error');
  });

  it('answers a mapped AppError with its own status', async () => {
    const probeApp = createApp(testEnv);
    probeApp.get('/conflict', () => {
      throw versionConflict(1, 3);
    });

    const res = await probeApp.request('/conflict');
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe(ERROR_CODES.VERSION_CONFLICT);
  });
});

describe('health', () => {
  it('reports ok without leaking configuration', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; database: string };
    expect(body.status).toBe('ok');
    expect(body.database).toBe('not_configured');
    expect(JSON.stringify(body)).not.toContain('DATABASE_URL');
  });
});
