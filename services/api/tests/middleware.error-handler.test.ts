import { mock } from 'node:assert';
import { describe, it } from 'node:test';
import { mockContext } from '../../testing/mockContext.js';
import { createErrorHandler } from '../middleware/error-handler.js';
import { Logger } from '../logger.js';

// Simple in‑memory logger for test
const logBuffer: any[] = [];
const testLogger: Logger = {
  warn: (msg, meta) => logBuffer.push({ level: 'warn', msg, meta }),
  error: (msg, meta) => logBuffer.push({ level: 'error', msg, meta }),
};

describe('error-handler production redaction', () => {
  it('redacts secrets and truncates detail in production', async () => {
    const handler = createErrorHandler(testLogger);
    const mockErr = new Error('Secret password=1234');
    const c = mockContext();
    process.env.NODE_ENV = 'production';
    const res = await handler(mockErr, c as any);
    const json = (res as any).body as any;
    // Should truncate / mask
    mock.equal(json.error.detail, undefined,
          'production redaction omits detail field');
    // Logger should contain masked detail
    const log = logBuffer.find(l => l.level === 'error');
    mock.ok(log, 'error log captured');
    mock.ok(log.meta.detail.includes('[REDACTED]'),
      'detail contains masked secret');
  });
});

describe('error-handler dev mode', () => {
  it('preserves detail in development', async () => {
    const handler = createErrorHandler(testLogger);
    const mockErr = new Error('unmasked details');
    const c = mockContext();
    process.env.NODE_ENV = 'development';
    const res = await handler(mockErr, c as any);
    const json = (res as any).body as any;
    mock.equal(json.error.detail, 'unmasked details',
      'dev mode preserves detail');
  });
});