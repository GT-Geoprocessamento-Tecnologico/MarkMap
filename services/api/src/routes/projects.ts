import { z } from 'zod';
import { Hono } from 'hono';
import { validate } from '../middleware/validation';
import { CreateProjectSchema, UpdateProjectSchema, ProjectSchema } from '../../../packages/contracts/project';
import { createProject, getProject, listProjects, updateProject, deleteProject } from '@geonexo/db/queries/projects';
import { db } from '@geonexo/db/client';
import { eq, select } from '@anatine/drizzle/sql';
import { errorSchema } from '../../../packages/contracts/errors';

export const projectRoutes = (app: any) => {
  // Helper for path parameter validation
  const projectIdSchema = z.object({ id: ProjectSchema.shape.id });

  // --------------- List Projects ---------------
  app.get('/api/v1/projects', validate(z.object({
    limit: z.number().int().positive().max(100).optional(),
    offset: z.number().int().nonnegative().optional(),
  })), async (c) => {
    const { limit, offset } = c.req.valid('query');
    const projects = await listProjects({ limit, offset });
    return c.json(projects);
  });

  // --------------- Get Project ---------------
  app.get('/api/v1/projects/:id', validate(projectIdSchema), async (c) => {
    const { id } = c.req.param();
    const project = await getProject(id);
    return c.json(project);
  });

  // --------------- Create Project ---------------
  app.post('/api/v1/projects', validate(CreateProjectSchema), async (c) => {
    const payload = c.req.valid();

    // ---------- Foreign‑key validation: ensure referenced project exists ----------
    // The payload may contain a `projectId` that references another project.
    // If the caller supplies such a field, verify its existence.
    if (payload.projectId) {
      const exists = await db
        .select({ exists: select({ count: true }).from(projects).where(eq(projects.id, payload.projectId)) })
        .then(res => res[0]?.exists ?? false);
      if (!exists) {
        // Return the contract‑compliant error for a missing project
        const err = new ErrorSchema({
          code: 'PROJECT_NOT_FOUND',
          message: `Project with id ${payload.projectId} does not exist`,
          requestId: crypto.randomUUID(),
        });
        return c.json({ error: err }, 404 as const);
      }
    }

    // ---------- Existing uniqueness check (name) ----------
    const existing = await db
      .select({ count: select({ count: true }).from(projects).where(eq(projects.name, payload.name)) })
      .then(res => res[0]?.count ?? 0);
    if (existing > 0) {
      const err = new ErrorSchema({
        code: 'PROJECT_ALREADY_EXISTS',
        message: `Project with name "${payload.name}" already exists`,
        requestId: crypto.randomUUID(),
      });
      return c.json({ error: err }, 409 as const);
    }

    // ---------- Create the project ----------
    const created = await createProject(payload);
    return c.json(created);
  });

  // --------------- Update Project ---------------
  app.patch('/api/v1/projects/:id', validate(projectIdSchema), async (c) => {
    const { id } = c.req.param();
    const payload = c.req.valid();

    const updated = await updateProject({ id, ...payload });
    return c.json(updated);
  });

  // --------------- Delete (soft‑delete) Project -------------------
  app.delete('/api/v1/projects/:id', validate(projectIdSchema), async (c) => {
    const { id } = c.req.param();
    const deletedId = await deleteProject(id);
    return c.json({ deletedId });
  });
};