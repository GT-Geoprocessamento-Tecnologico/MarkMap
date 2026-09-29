import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { validate } from '../middleware/validation.js';
import { getDb } from '@geonexo/db';
import { listFeatures, createFeature, softDeleteFeature, getFeature } from '@geonexo/db';

const createFeatureSchema = z.object({
  layerId: z.string(),
  geometry: z.any(),
  properties: z.record(z.any()).optional(),
});

export const featureRoutes = (app: Hono<any, any, any>) => {
  app.get('/features', async (c: Context) => {
    const layerId = c.req.query('layerId');
    if (!layerId) {
      return c.json({ error: 'Missing layerId query param' }, 400);
    }
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined;
    const cursor = c.req.query('cursor');
    // For bbox, we can optionally parse it, but skipping for simplicity unless requested
    
    const db = getDb();
    const queryOpts: any = { layerId };
    if (limit !== undefined) queryOpts.limit = limit;
    if (cursor !== undefined) queryOpts.cursor = cursor;

    const result = await listFeatures(db, queryOpts);
    return c.json(result);
  });

  app.get('/features/:id', async (c: Context) => {
    const id = c.req.param('id');
    if (!id) return c.json({ error: 'Missing id param' }, 400);
    const db = getDb();
    const feature = await getFeature(db, id);
    if (!feature) {
      return c.json({ error: 'Feature not found' }, 404);
    }
    return c.json(feature);
  });

  app.post('/features', validate(createFeatureSchema), async (c: Context) => {
    const data = c.get('validatedBody');
    const db = getDb();
    try {
      const feature = await createFeature(db, data);
      return c.json(feature, 201);
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }
  });

  app.delete('/features/:id', async (c: Context) => {
    const id = c.req.param('id');
    if (!id) return c.json({ error: 'Missing id param' }, 400);
    const db = getDb();
    const deletedId = await softDeleteFeature(db, id);
    if (!deletedId) {
      return c.json({ error: 'Feature not found' }, 404);
    }
    return c.json({ id: deletedId });
  });
};
