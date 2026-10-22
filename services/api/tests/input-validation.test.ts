import {
  createFeatureSchema,
  errorResponseSchema,
  GeometryTypeMismatchError,
  projectSchema,
} from "@markmap/contracts";
import {
  InvalidGeometryError,
  InvalidCursorError,
  VersionConflictError,
} from "@markmap/db";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import type { Env } from "../src/env.js";
import { validate } from "../src/middleware/validation.js";
import { toProjectWire } from "../src/routes/projects.js";

const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const env: Env = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3000,
  CORS_ORIGINS: "http://localhost:5173",
  LOG_LEVEL: "error",
  corsOrigins: ["http://localhost:5173"],
  hasDatabase: false,
};

describe("input validation regressions", () => {
  it("normalizes nullable DB project descriptions to the shared wire schema", () => {
    const project = toProjectWire({
      id: uuid,
      name: "Survey",
      description: null,
      status: "active",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(projectSchema.safeParse(project).success).toBe(true);
    expect(project.description).toBeUndefined();
  });
  it("rejects invalid GeoJSON before persistence input is constructed", () => {
    expect(
      createFeatureSchema.safeParse({
        layerId: uuid,
        geometry: { type: "Point", coordinates: [181, 0] },
      }).success,
    ).toBe(false);
    expect(
      createFeatureSchema.safeParse({
        layerId: uuid,
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: { nested: { deeper: { tooDeep: { value: true } } } },
      }).success,
    ).toBe(false);
    expect(
      createFeatureSchema.safeParse({
        layerId: uuid,
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: { value: "€".repeat(683) },
      }).success,
    ).toBe(false);
    expect(
      createFeatureSchema.safeParse({
        layerId: uuid,
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: { value: ["x".repeat(2050)] },
      }).success,
    ).toBe(false);
    expect(
      errorResponseSchema.safeParse({
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "too large",
          requestId: uuid,
        },
      }).success,
    ).toBe(true);
  });

  it("rejects malformed feature list UUID and pagination query before getDb", async () => {
    const app = createApp(env);
    const response = await app.request("/features?layerId=not-a-uuid&limit=0");
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("serves existing routes under /api/v1 aliases with the same validation", async () => {
    const app = createApp(env);
    expect((await app.request("/api/v1/health")).status).toBe(200);
    const feature = await app.request(`/api/v1/features?layerId=invalid`);
    expect(feature.status).toBe(400);
    expect((await feature.json()).error.code).toBe("VALIDATION_ERROR");
    const layer = await app.request(`/api/v1/layers?projectId=invalid`);
    expect(layer.status).toBe(400);
    expect((await layer.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects unsafe storage keys before storage access", async () => {
    const app = createApp({
      ...env,
      S3_ENDPOINT: "https://storage.example",
      S3_REGION: "us-east-1",
      S3_ACCESS_KEY_ID: "configured",
      S3_SECRET_ACCESS_KEY: "configured",
    });
    const response = await app.request("/storage/presign/get?key=../secret");
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    const denied = await app.request("/storage/presign/get?key=valid/object");
    expect(denied.status).toBe(401);
    expect((await denied.json()).error.message).toBe(
      "Workspace capability is required",
    );
  });

  it("rejects malformed JSON, cursor, and bbox before getDb", async () => {
    const app = createApp(env);
    const malformed = await app.request("/features", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ invalid json }",
    });
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error.code).toBe("VALIDATION_ERROR");

    for (const query of [
      `layerId=${uuid}&cursor=not-a-cursor`,
      `layerId=${uuid}&bbox=181,0,182,1`,
      `layerId=${uuid}&limit=1001`,
    ]) {
      const response = await app.request(`/features?${query}`);
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects an oversized feature body before getDb", async () => {
    const app = createApp(env);
    const response = await app.request("/features", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        layerId: uuid,
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: { value: "x".repeat(1024 * 1024) },
      }),
    });
    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("does not convert downstream exceptions into validation errors", async () => {
    const app = new Hono();
    app.onError(
      (error) =>
        new Response(error instanceof Error ? error.message : "error", {
          status: 500,
        }),
    );
    app.post("/test", validate(createFeatureSchema), () => {
      throw new Error("downstream failure");
    });
    const response = await app.request("/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        layerId: uuid,
        geometry: { type: "Point", coordinates: [0, 0] },
      }),
    });
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("downstream failure");
  });

  it("maps known domain errors to typed envelopes and hides their raw details", async () => {
    const cases = [
      [new InvalidGeometryError("postgres detail"), 400, "INVALID_GEOMETRY"],
      [new InvalidCursorError(), 400, "VALIDATION_ERROR"],
      [new VersionConflictError(1, 2), 409, "VERSION_CONFLICT"],
      [
        new GeometryTypeMismatchError("Point", "Polygon"),
        400,
        "GEOMETRY_TYPE_MISMATCH",
      ],
    ] as const;
    for (const [error, status, code] of cases) {
      const app = createApp(env);
      app.get("/known", () => {
        throw error;
      });
      const response = await app.request("/known");
      expect(response.status).toBe(status);
      const body = await response.json();
      expect(errorResponseSchema.safeParse(body).success).toBe(true);
      expect(body.error.code).toBe(code);
      expect(JSON.stringify(body)).not.toContain("postgres detail");
    }
  });
});
