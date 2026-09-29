import { z } from 'zod';
import { Hono } from 'hono';
import { validate } from '../middleware/validation';
import { LayerSchema as LayerContractSchema, Layer as LayerSchema } from '../../../packages/contracts/layer';
import { IDSchema } from '../../../packages/contracts/project';
import { createLayer, getLayer, listLayers, updateLayer } from '../../../../packages/db/src/queries/layers';
import { db } from '../../../../packages/db/src/client';
import { and, eq } from 'drizzle-orm';

// Helper schema for path parameters (layer ID)
const layerIdSchema = z.object({ id: IDSchema });

export const layerRoutes = (app: any) => {
  // <<--- List Layers -------------------------------------------------
  app.get('/api/v1/layers', validate(z.object({
    projectId: IDSchema,
    limit: z.number().int().positive().max(100).optional(),
    cursor: z.string().optional(),
  })), async (c) => {
    const { projectId, limit, cursor } = c.req.valid('query');
    const layers = await listLayers(db, {
      projectId,
      limit,
      cursor,
    });
    return c.json(layers);
  });

  // <<--- Get Layer -------------------------------------------------
  app.get('/api/v1/layers/:id', async (c) => {
    const { id } = c.req.param();
    const layer = await getLayer(db, id);
    return c.json(layer);
  });

  // <<--- Create Layer ----------------------------------------------
  // Expect payload that matches the Layer creation contract.
  // The contract requires a projectId linkage, so we include it.
  const createLayerSchema = LayerContractSchema.extend({
    projectId: IDSchema, // mandatory foreign key to project
    geometryType: LayerContractSchema.geometryType, // allowed geometry types
    defaultStyle: LayerContractSchema.defaultStyle, // optional style object
  });

  app.post('/api/v1/layers', validate(createLayerSchema), async (c) => {
    const input = c.req.valid();
    const layer = await createLayer(input);
    return c.json(layer);
  });

  // <<--- Update Layer ----------------------------------------------
  const updateLayerSchema = LayerContractSchema.extend({
    id: IDSchema, // required for update
  });

  app.patch('/api/v1/layers/:id', validate(layerIdSchema), async (c) => {
    const { id } = c.req.param();
    const input = c.req.valid();
    const updated = await updateLayer({ id, ...input });
    return c.json(updated);
  });
};