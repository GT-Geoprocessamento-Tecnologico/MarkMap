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
import { type Context } from "hono";

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

export const projectRoutes = (app: any) => {
  app.post("/projects", validate(createProjectSchema), async (c: Context) => {
    const data = c.get("validatedBody");
    const project = await createProject(getDb(), data);
    return c.json(toProjectWire(project), 201);
  });

  app.get("/projects/:id", async (c: Context) => {
    const id = uuidSchema.parse(c.req.param("id"));
    const project = await getProject(getDb(), id);
    if (!project) throw new ProjectNotFoundError(id);
    return c.json(toProjectWire(project));
  });

  app.get("/projects", async (c: Context) => {
    const query = paginationQuerySchema.parse(c.req.query());
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
