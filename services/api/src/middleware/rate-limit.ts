import { Hono } from 'hono';
import { MiddlewareHandler } from 'hono';

/** Simple rate limiter – 100 requests per minute per IP */
export const rateLimit: MiddlewareHandler = async (c, next) => {
  const ip = c.req.header('x-forwarded-for') ?? c.req.ip;
  const now = Date.now();
  const window = 60_000; // 1 minute
  const limit = 100;

  // In‑memory store (for dev). In prod you should use Redis or similar.
  const store = (globalThis as any).__rateStore ?? ((globalThis as any).__rateStore = new Map<string, { count: number; start: number }>());
  const record = store.get(ip) ?? { count: 0, start: now };

  if (now - record.start > window) {
    // reset window
    record.count = 1;
    record.start = now;
  } else {
    record.count += 1;
  }
  store.set(ip, record);

  if (record.count > limit) {
    return c.json({ error: 'Too Many Requests' }, 429);
  }
  await next();
};
