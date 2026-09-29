import { Hono } from 'hono';
import { type Context } from 'hono';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import { db } from '../lib/db';
import { buildErrorResponse, ErrorCode } from '../lib/errors';

export const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const projectRoutes = (app: any) => {
  app.post(
    '/projects',
    validate(createProjectSchema),
    async (c: Context) => {
      const data = c.get('validatedBody');
      const requestId = c.get('requestId') ?? 'unknown';

      if ('projectId' in data && data.projectId) {
        const parent = await db.projects.findById(data.projectId);
        if (!parent) {
          return c.json(
            buildErrorResponse(ErrorCode.PROJECT_NOT_FOUND, 'The referenced project does not exist', requestId),
            404,
          );
        }
      }

      const project = await db.projects.create(data);
      return c.json(project, 201);
    },
  );

  app.get('/projects', async (c: Context) => {
    // For now return empty list – pagination omitted for brevity
    return c.json({ data: [], total: 0 }, 200);
  });
};
