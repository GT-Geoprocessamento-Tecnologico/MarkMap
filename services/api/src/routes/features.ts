import {
  createFeatureSchema,
  listFeaturesQuerySchema,
  paginationQuerySchema,
  uuidSchema,
} from "@geonexo/contracts";
import {
  getDb,
  getLayer,
  listFeatures,
  createFeature,
  LayerNotFoundError,
  softDeleteFeature,
  getFeature,
  updateFeature,
} from "@geonexo/db";
import { Hono, type Context } from "hono";
import { z } from "zod";

import { validate } from "../middleware/validation.js";

const featureListQuerySchema = z
  .object({ layerId: uuidSchema })
  .merge(paginationQuerySchema)
  .merge(listFeaturesQuerySchema);
const featureIdSchema = uuidSchema;
const cursorSchema = z
  .string()
  .min(1)
  .refine((cursor) => {
    try {
      const [timestamp, id, extra] = Buffer.from(cursor, "base64url")
        .toString("utf8")
        .split("|");
      return (
        extra === undefined &&
        timestamp !== undefined &&
        !Number.isNaN(new Date(timestamp).getTime()) &&
        uuidSchema.safeParse(id).success
      );
    } catch {
      return false;
    }
  }, "Invalid pagination cursor");

export const featureRoutes = (app: Hono<any, any, any>) => {
  app.get("/layers/:layerId/features", async (c: Context) => {
    const layerId = uuidSchema.parse(c.req.param("layerId"));
    const query = paginationQuerySchema
      .merge(listFeaturesQuerySchema)
      .parse(c.req.query());
    if (query.cursor !== undefined) cursorSchema.parse(query.cursor);
    const db = getDb();
    if (!(await getLayer(db, layerId))) throw new LayerNotFoundError(layerId);
    const result = await listFeatures(db, {
      layerId,
      limit: query.limit,
      ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
      ...(query.bbox !== undefined ? { bbox: query.bbox } : {}),
      ...(query.includeDeleted !== undefined
        ? { includeDeleted: query.includeDeleted }
        : {}),
    });
    return c.json(result);
  });

  app.post("/layers/:layerId/features", async (c: Context) => {
    const layerId = uuidSchema.parse(c.req.param("layerId"));
    const body = z.record(z.unknown()).parse(await c.req.json());
    if (body.layerId !== undefined) z.literal(layerId).parse(body.layerId);
    const data = createFeatureSchema.parse({ ...body, layerId });
    const feature = await createFeature(getDb(), data);
    return c.json(feature, 201);
  });

  app.get("/features", async (c: Context) => {
    const query = featureListQuerySchema.parse(c.req.query());
    if (query.cursor !== undefined) cursorSchema.parse(query.cursor);

    const db = getDb();
    const result = await listFeatures(db, {
      layerId: query.layerId,
      limit: query.limit,
      ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
      ...(query.bbox !== undefined ? { bbox: query.bbox } : {}),
      ...(query.includeDeleted !== undefined
        ? { includeDeleted: query.includeDeleted }
        : {}),
    });
    return c.json(result);
  });

  app.get("/features/:id", async (c: Context) => {
    const id = featureIdSchema.parse(c.req.param("id"));
    const includeDeleted = z
      .object({ includeDeleted: listFeaturesQuerySchema.shape.includeDeleted })
      .parse(c.req.query()).includeDeleted;
    const db = getDb();
    const feature = await getFeature(
      db,
      id,
      includeDeleted === undefined ? {} : { includeDeleted },
    );
    if (!feature) {
      return c.json(
        {
          error: {
            code: "FEATURE_NOT_FOUND",
            message: "Feature not found",
            requestId: c.get("requestId") ?? "unknown",
          },
        },
        404,
      );
    }
    return c.json(feature);
  });

  app.post("/features", validate(createFeatureSchema), async (c: Context) => {
    const data = c.get("validatedBody");
    const db = getDb();
    const feature = await createFeature(db, data);
    return c.json(feature, 201);
  });

  app.patch("/features/:id", async (c: Context) => {
    const id = featureIdSchema.parse(c.req.param("id"));
    const body = z.record(z.unknown()).parse(await c.req.json());
    // Expect version field for optimistic concurrency
    const input = updateFeatureSchema.parse({ ...body, id });
    const db = getDb();
    const updated = await updateFeature(db, id, input);
    if (!updated) return c.json({ error: "Feature not found or version conflict" }, 404);
    return c.json(updated);
  });

  app.delete("/features/:id", async (c: Context) => {
    const id = featureIdSchema.parse(c.req.param("id"));
    const db = getDb();
    const deletedId = await softDeleteFeature(db, id);
    if (deletedId === null) {
      return c.json(
        {
          error: {
            code: "FEATURE_NOT_FOUND",
            message: "Feature not found",
            requestId: c.get("requestId") ?? "unknown",
          },
        },
        404,
      );
    }
    return c.json({ id: deletedId });
  });
};
