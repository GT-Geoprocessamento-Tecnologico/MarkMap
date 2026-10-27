import {
  createProjectSchema,
  paginationQuerySchema,
  projectSchema,
  uuidSchema,
} from "@markmap/contracts";
import {
  createProject,
  decodeCursor,
  getDb,
  getProject,
  listProjects,
  ProjectNotFoundError,
} from "@markmap/db";
import { type Hono } from "hono";

import type { Variables } from "../app.js";
import { validate } from "../middleware/validation.js";

export const toProjectWire = (project: unknown) => {
  const value = project as Record<string, unknown>;
  const normalized =
    value.description === null
      ? Object.fromEntries(
          Object.entries(value).filter(([key]) => key !== "description"),
        )
      : value;
  return projectSchema.parse({
    ...normalized,
    createdAt:
      normalized.createdAt instanceof Date
        ? normalized.createdAt.toISOString()
        : normalized.createdAt,
    updatedAt:
      normalized.updatedAt instanceof Date
        ? normalized.updatedAt.toISOString()
        : normalized.updatedAt,
  });
};

export const projectRoutes = (app: Hono<{ Variables: Variables }>) => {
  app.post("/projects", validate(createProjectSchema), async (c) => {
    const data = c.get("validatedBody");
    const project = await createProject(getDb(), data);
    return c.json(toProjectWire(project), 201);
  });

  app.get("/projects/:id", async (c) => {
    const id = uuidSchema.parse(c.req.param("id"));
    const project = await getProject(getDb(), id);
    if (!project) throw new ProjectNotFoundError(id);
    return c.json(toProjectWire(project));
  });

  app.get("/projects", async (c) => {
    const query = paginationQuerySchema.parse(c.req.query());
    // decodeCursor valida a integridade do cursor e lanca AppError("BAD_REQUEST") se corrompido
    if (query.cursor !== undefined) decodeCursor(query.cursor);
    const page = await listProjects(getDb(), {
      limit: query.limit,
      ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
    });
    return c.json({
      items: page.items.map(toProjectWire),
      nextCursor: page.nextCursor,
    });
  });
};
