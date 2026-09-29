import { z } from 'zod';
import { Hono } from 'hono';
import { validate } from '../middleware/validation';
import { createFeature, getFeature, listFeatures, updateFeature, softDeleteFeature } from '@geonexo/db/queries/features';
import { geometrySchema } from '@geonexo/contracts';
import { IDSchema } from '@geonexo/contracts/project';
import { ErrorCodes } from '@geonexo/contracts/errors';

export const featureRoutes = (app: any) => {
  const featureIdSchema = z.object({ id: IDSchema });
  const featureIdSchema = z.object({ id: IDSchema });

  // ------------------- Create Feature -------------------
  app.post('/api/v1/features', validate(z.object({
    geometry: GeometrySchema, // enforce strict geometry validation
    properties: z.record(z.any()).optional(),
  })), async (c) => {
    const input = c.req.valid();

    try {
      const feature = await createFeature(input);
      return c.json(feature);
    } catch (err: any) {
      // If GeometrySchema fails at the DB level or in an internal check,
      // we map it to INVALID_GEOMETRY as per contract.
      if (err.message && (err.message.includes('Invalid geometry') || err.code === 'INVALID_GEOMETRY')) {
        const errorResponse = {
          error: {
            code: ErrorCodes.INVALID_GEOMETRY,
            message: 'Provided geometry is invalid',
            requestId: crypto.randomUUID(),
          },
        };
        return c.json(errorResponse, 400);
      }
      throw err;
    }
  });

  // ------------------- Get Feature -------------------
  app.get('/api/v1/features/:id', validate(featureIdSchema), async (c) => {
    const { id } = c.req.param();
    const feature = await getFeature(id);
    return c.json(feature);
  });

  // ------------------- List Features -------------------
  app.get('/api/v1/features', validate(z.object({
    limit: z.number().int().positive().max(100).optional(),
    cursor: z.string().optional(),
  })), async (c) => {
    const { limit, cursor } = c.req.valid('query');
    const pagination = await listFeatures({ limit, cursor });
    return c.json(pagination);
  });

  // ------------------- Update Feature -------------------
  app.patch('/api/v1/features/:id', validate(featureIdSchema), async (c) => {
    const { id } = c.req.param();
    const input = c.req.valid();
    const updated = await updateFeature(id, input);
    return c.json(updated);
  });

  // ------------------- Delete (soft‑delete) Feature -------------------
  app.delete('/api/v1/features/:id', validate(featureIdSchema), async (c) => {
    const { id } = c.req.param();
    const deletedId = await softDeleteFeature(id);
    return c.json({ deletedId });
  });
};