import { Hono } from 'hono';
import { type Context } from 'hono';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import { db } from '../lib/db';
import { buildErrorResponse } from '../lib/errors';
import { GeometrySchema } from '@geonexo/contracts/geometry-helpers';

export const featureRoutes = (app: any) => {
  app.post(
    '/features',
    validate(z.object({
      name: z.string().min(1),
      projectId: z.string(),
      layerId: z.string().optional(),
      geometry: z.any(),
    })),
    async (c: Context) => {
      const data = c.get('validatedBody');
      const requestId = c.get('requestId') ?? 'unknown';

      // Foreign-key checks
      const project = await db.projects.findById(data.projectId);
      if (!project) {
        return c.json(
          buildErrorResponse('PROJECT_NOT_FOUND', 'Missing referenced project', requestId),
          404,
        );
      }

      if (data.layerId) {
        const layer = await db.layers.findById(data.layerId);
        if (!layer) {
          return c.json(
            buildErrorResponse('LAYER_NOT_FOUND', 'Missing referenced layer', requestId),
            404,
          );
        }
      }

      // Strict geometry validation
      try {
        GeometrySchema.parse(data.geometry);
      } catch (zerr) {
        return c.json(
          {
            error: {
              code: 'INVALID_GEOMETRY',
              message: 'Geometry does not match strict spec',
              requestId,
              details: (zerr as any).issues?.map((iss: any) => ({
                path: iss.path?.join('.'),
                message: iss.message
              })) ?? [],
            },
          },
          400,
        );
      }

      const feature = await db.features.create(data);
      return c.json(feature, 201);
    },
  );
};
