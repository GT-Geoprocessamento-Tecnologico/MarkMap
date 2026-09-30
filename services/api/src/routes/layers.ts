import {
  createLayerSchema,
  paginationQuerySchema,
  uuidSchema,
} from "@geonexo/contracts";
import {
  decodeCursor,
  getDb,
  listLayers,
  createLayer,
  getLayer,
  LayerNotFoundError,
  softDeleteLayer,
} from "@geonexo/db";
import { Hono, type Context } from "hono";
import { z } from "zod";

import { validate } from "../middleware/validation.js";

const layerListQuerySchema = z
  .object({ projectId: uuidSchema })
  .merge(paginationQuerySchema);

export const layerRoutes = (app: Hono<any, any, any>) => {
  app.get("/projects/:projectId/layers", async (c: Context) => {
    const projectId = uuidSchema.parse(c.req.param("projectId"));
    const query = paginationQuerySchema.parse(c.req.query());
    if (query.cursor !== undefined) decodeCursor(query.cursor);
    const db = getDb();
    const result = await listLayers(db, {
      projectId,
      limit: query.limit,
      ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
    });
    return c.json(result);
  });

  app.post("/projects/:projectId/layers", async (c: Context) => {
    const projectId = uuidSchema.parse(c.req.param("projectId"));
    const body = z.record(z.unknown()).parse(await c.req.json());
    if (body.projectId !== undefined)
      z.literal(projectId).parse(body.projectId);
    const data = createLayerSchema.parse({ ...body, projectId });
    const layer = await createLayer(getDb(), {
      ...data,
      ...(data.description !== undefined
        ? { description: data.description }
        : { description: null }),
    });
    return c.json(layer, 201);
  });

  app.get("/layers", async (c: Context) => {
    const query = layerListQuerySchema.parse(c.req.query());
    if (query.cursor !== undefined) decodeCursor(query.cursor);

    const db = getDb();
    const result = await listLayers(db, {
      projectId: query.projectId,
      limit: query.limit,
      ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
    });
    return c.json(result);
  });

  app.post("/layers", validate(createLayerSchema), async (c: Context) => {
    const data = c.get("validatedBody");
    const db = getDb();
    const layer = await createLayer(db, {
      projectId: data.projectId,
      name: data.name,
      kind: data.kind,
      geometryType: data.geometryType,
      description: data.description,
    });
    return c.json(layer, 201);
  });

  app.get("/layers/:id", async (c: Context) => {
    const id = uuidSchema.parse(c.req.param("id"));
    const layer = await getLayer(getDb(), id);
    if (!layer) throw new LayerNotFoundError(id);
    return c.json(layer);
  });

  app.delete("/layers/:id", async (c: Context) => {
    const id = uuidSchema.parse(c.req.param("id"));
    const db = getDb();
    const deletedId = await softDeleteLayer(db, id);
    if (deletedId === null) {
      return c.json(
        {
          error: {
            code: "LAYER_NOT_FOUND",
            message: "Layer not found",
            requestId: c.get("requestId") ?? "unknown",
          },
        },
        404,
      );
    }
    return c.json({ id: deletedId });
  });
};
