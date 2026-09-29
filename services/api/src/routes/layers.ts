import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { validate } from '../middleware/validation.js';
import { getDb } from '@geonexo/db';
import { listLayers, createLayer, softDeleteLayer, LAYER_KINDS } from '@geonexo/db';

const createLayerSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  kind: z.enum(LAYER_KINDS),
  geometryType: z.any().nullable(),
  description: z.string().optional().nullable(),
});

export const layerRoutes = (app: Hono<any, any, any>) => {
  app.get('/layers', async (c: Context) => {
    const projectId = c.req.query('projectId');
    if (!projectId) {
      return c.json({ error: 'Missing projectId query param' }, 400);
    }
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined;
    const cursor = c.req.query('cursor');
    
    const db = getDb();
    const queryOpts: any = { projectId };
    if (limit !== undefined) queryOpts.limit = limit;
    if (cursor !== undefined) queryOpts.cursor = cursor;
    
    const result = await listLayers(db, queryOpts);
    return c.json(result);
  });

  app.post('/layers', validate(createLayerSchema), async (c: Context) => {
    const data = c.get('validatedBody');
    const db = getDb();
    try {
      const layer = await createLayer(db, data);
      return c.json(layer, 201);
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }
  });

  app.delete('/layers/:id', async (c: Context) => {
    const id = c.req.param('id');
    if (!id) return c.json({ error: 'Missing id param' }, 400);
    const db = getDb();
    const deletedId = await softDeleteLayer(db, id);
    if (!deletedId) {
      return c.json({ error: 'Layer not found' }, 404);
    }
    return c.json({ id: deletedId });
  });
};
