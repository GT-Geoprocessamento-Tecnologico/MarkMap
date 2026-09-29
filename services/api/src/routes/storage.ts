import { Hono } from 'hono';
import type { Env } from '../env.js';
import { getS3Client, generatePresignedPutUrl, generatePresignedGetUrl } from '../storage.js';

export const storageRoutes = (env: Env) => {
  const routes = new Hono();

  routes.get('/presign/put', async (c) => {
    try {
      const key = c.req.query('key');
      if (!key) return c.json({ error: 'Missing key' }, 400);

      const client = getS3Client(env);
      const url = await generatePresignedPutUrl(client, env.S3_BUCKET || 'assets', key);
      return c.json({ url, method: 'PUT', key });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  routes.get('/presign/get', async (c) => {
    try {
      const key = c.req.query('key');
      if (!key) return c.json({ error: 'Missing key' }, 400);

      const client = getS3Client(env);
      const url = await generatePresignedGetUrl(client, env.S3_BUCKET || 'assets', key);
      return c.json({ url, method: 'GET', key });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  return routes;
};
