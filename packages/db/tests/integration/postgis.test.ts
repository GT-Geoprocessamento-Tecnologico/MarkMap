import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  GeometryTypeMismatchError,
  type Bbox,
  type Geometry,
} from "@geonexo/contracts";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  InvalidGeometryError,
  InvalidCursorError,
  LayerNotFoundError,
  ProjectNotFoundError,
  VersionConflictError,
  createDb,
  createFeature as createFeatureDb,
  createLayer as createLayerDb,
  createProject as createProjectDb,
  createWorkspace,
  getFeature,
  getLayer,
  getProject,
  insertAuditEvent,
  listFeatures,
  listLayers,
  listProjects,
  projects,
  softDeleteFeature,
  softDeleteLayer,
  updateFeature,
  type Db,
} from "../../src/index.js";

/**
 * Runs only when TEST_DATABASE_URL points at a database whose name contains
 * `test` — the suite TRUNCATEs tables, so the guard refuses anything else
 * (10-BACKEND-VISIONARIO-PRD.md: Neon dev/test branches only).
 */
const testUrl = process.env.TEST_DATABASE_URL ?? "";
const isTestUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    const container = JSON.parse(
      execFileSync("docker", ["inspect", "geonexo-localfirst-test-20260929"], {
        encoding: "utf8",
      }),
    )[0] as {
      Name: string;
      Config: { Image: string };
      State: { Running: boolean };
      NetworkSettings: {
        Ports: Record<
          string,
          Array<{ HostIp: string; HostPort: string }> | null
        >;
      };
    };
    const binding = container.NetworkSettings.Ports["5432/tcp"]?.[0];
    return (
      parsed.hostname === "127.0.0.1" &&
      parsed.port === "58489" &&
      parsed.pathname === "/geonexo_localfirst_test" &&
      parsed.username === "geonexo_test" &&
      container.Name === "/geonexo-localfirst-test-20260929" &&
      container.Config.Image === "postgis/postgis:16-3.4" &&
      container.State.Running &&
      binding?.HostIp === "127.0.0.1" &&
      binding.HostPort === "58489"
    );
  } catch {
    return false;
  }
};
const describeIfTestDb =
  testUrl !== "" && isTestUrl(testUrl) ? describe : describe.skip;

const rowsOf = <T>(result: unknown): T[] => result as T[];

const polygon: Geometry = {
  type: "Polygon",
  coordinates: [
    [
      [-46.63, -23.54],
      [-46.62, -23.54],
      [-46.62, -23.53],
      [-46.63, -23.53],
      [-46.63, -23.54],
    ],
  ],
};

const bowtie: Geometry = {
  type: "Polygon",
  coordinates: [
    [
      [-46.63, -23.54],
      [-46.62, -23.53],
      [-46.62, -23.54],
      [-46.63, -23.53],
      [-46.63, -23.54],
    ],
  ],
};

const farAwayPolygon: Geometry = {
  type: "Polygon",
  coordinates: [
    [
      [-40.03, -20.04],
      [-40.02, -20.04],
      [-40.02, -20.03],
      [-40.03, -20.03],
      [-40.03, -20.04],
    ],
  ],
};

const bboxAroundPolygon: Bbox = {
  minLng: -46.64,
  minLat: -23.55,
  maxLng: -46.61,
  maxLat: -23.52,
};

describeIfTestDb("postgis persistence (real PostGIS)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let projectId: string;
  let layerId: string;
  const workspaceId = "11111111-1111-4111-8111-111111111111";

  const createProject = (
    database: Db,
    input: Parameters<typeof createProjectDb>[1],
  ) => createProjectDb(database, { ...input, workspaceId });
  const createLayer = (
    database: Db,
    input: Parameters<typeof createLayerDb>[1],
  ) => createLayerDb(database, { ...input, workspaceId });
  const createFeature = (
    database: Db,
    input: Parameters<typeof createFeatureDb>[1],
  ) => createFeatureDb(database, { ...input, workspaceId });

  const seedLayer = async (): Promise<void> => {
    const project = await createProject(db, { name: `proj-${Date.now()}` });
    const layer = await createLayer(db, {
      projectId: project!.id,
      name: "camada-1",
      kind: "polygon",
      geometryType: "Polygon",
    });
    projectId = project!.id;
    layerId = layer.id;
  };

  beforeAll(async () => {
    const handle = createDb(testUrl, { statementTimeoutMs: 60_000 });
    db = handle.db;
    close = handle.close;
    const identity = await db.execute(
      sql`SELECT current_database() AS database, current_user AS role, EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS postgis`,
    );
    expect(identity[0]).toMatchObject({
      database: "geonexo_localfirst_test",
      role: "geonexo_test",
      postgis: true,
    });

    // Migrations from zero, then verify what 0000 promised: PostGIS live.
    const migrationsFolder = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../drizzle",
    );
    await migrate(db, { migrationsFolder });
    const extensions = rowsOf<{ extname: string }>(
      await db.execute(sql`SELECT extname FROM pg_extension`),
    );
    expect(extensions.map((row) => row.extname)).toEqual(
      expect.arrayContaining(["postgis", "pgcrypto"]),
    );
  }, 120_000);

  beforeEach(async () => {
    await db.execute(sql`
      TRUNCATE TABLE features, layers, maps, map_sources, imports, projects, audit_events
      RESTART IDENTITY CASCADE
    `);
    await createWorkspace(db, {
      workspaceId,
      proofDigest: "a".repeat(64),
      capabilityHash: "b".repeat(64),
      generation: "0",
    });
    await seedLayer();
  });

  afterAll(async () => {
    await close();
  });

  it("stores the geometry in EPSG:4674 and returns wire EPSG:4326", async () => {
    const created = await createFeature(db, {
      layerId,
      geometry: polygon,
      properties: { nome: "quadra" },
    });
    expect(created.version).toBe(1);
    expect(created.properties).toEqual({ nome: "quadra" });

    const result = rowsOf<{ srid: number }>(
      await db.execute(
        sql`SELECT ST_SRID(geometry) AS srid FROM features WHERE id = ${created.id}`,
      ),
    );
    expect(result[0]?.srid).toBe(4674);

    const fetched = await getFeature(db, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.geometry.type).toBe("Polygon");
    const original = polygon.coordinates[0] ?? [];
    const stored =
      fetched?.geometry.type === "Polygon"
        ? (fetched.geometry.coordinates[0] ?? [])
        : [];
    expect(stored).toHaveLength(original.length);
    stored.forEach((position, index) => {
      const expected = original[index] ?? [0, 0];
      expect(position[0]).toBeCloseTo(expected[0] ?? 0, 5);
      expect(position[1]).toBeCloseTo(expected[1] ?? 0, 5);
    });
  });

  it("rejects missing and soft-deleted parent projects when creating layers", async () => {
    const missingProjectId = "00000000-0000-4000-8000-000000000099";
    await expect(
      createLayer(db, {
        projectId: missingProjectId,
        name: "sem-projeto",
        kind: "polygon",
        geometryType: "Polygon",
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);

    const deletedProject = await createProject(db, {
      name: "projeto-removido",
    });
    if (deletedProject === undefined) {
      throw new Error("createProject returned no row");
    }
    await db.execute(
      sql`UPDATE projects SET deleted_at = now() WHERE id = ${deletedProject.id}`,
    );
    await expect(
      createLayer(db, {
        projectId: deletedProject.id,
        name: "projeto-removido-layer",
        kind: "polygon",
        geometryType: "Polygon",
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("rejects missing/deleted layers and mismatched declared geometry types", async () => {
    const missingLayerId = "00000000-0000-4000-8000-000000000099";
    await expect(
      createFeature(db, { layerId: missingLayerId, geometry: polygon }),
    ).rejects.toBeInstanceOf(LayerNotFoundError);

    await expect(
      createFeature(db, {
        layerId,
        geometry: { type: "Point", coordinates: [-46.63, -23.54] },
      }),
    ).rejects.toBeInstanceOf(GeometryTypeMismatchError);

    await softDeleteLayer(db, layerId);
    await expect(
      createFeature(db, { layerId, geometry: polygon }),
    ).rejects.toBeInstanceOf(LayerNotFoundError);
  });

  it("applies a bounded statement timeout to long-running queries", async () => {
    const timeoutHandle = createDb(testUrl, { statementTimeoutMs: 1_000 });
    try {
      const setting = rowsOf<{ statement_timeout: string }>(
        await timeoutHandle.db.execute(sql`SHOW statement_timeout`),
      );
      expect(setting[0]?.statement_timeout).toBe("1s");
      await expect(
        timeoutHandle.db.execute(sql`SELECT pg_sleep(2)`),
      ).rejects.toThrow();
    } finally {
      await timeoutHandle.close();
    }
  });

  it("lists only features overlapping the bbox (GiST-backed)", async () => {
    const inside = await createFeature(db, { layerId, geometry: polygon });
    await createFeature(db, { layerId, geometry: farAwayPolygon });

    const page = await listFeatures(db, { layerId, bbox: bboxAroundPolygon });
    expect(page.items.map((feature) => feature.id)).toEqual([inside.id]);
  });

  it("rejects empty and self-intersecting geometries with INVALID_GEOMETRY", async () => {
    await expect(
      createFeature(db, {
        layerId,
        geometry: { type: "Polygon", coordinates: [] },
      }),
    ).rejects.toBeInstanceOf(InvalidGeometryError);
    await expect(
      createFeature(db, { layerId, geometry: bowtie }),
    ).rejects.toBeInstanceOf(InvalidGeometryError);
  });

  it("enforces SRID 4674 at the database level", async () => {
    const raw = JSON.stringify(polygon);
    await expect(
      db.execute(sql`
        INSERT INTO features (layer_id, geometry)
        VALUES (${layerId}, ST_SetSRID(ST_GeomFromGeoJSON(${raw}), 4326))
      `),
    ).rejects.toThrow();
    const count = rowsOf<{ n: string }>(
      await db.execute(sql`SELECT count(*)::text AS n FROM features`),
    );
    expect(count[0]?.n).toBe("0");
  });

  it("enforces enum-like CHECKs at the database level", async () => {
    await expect(
      db.execute(sql`
        INSERT INTO layers (project_id, name, kind)
        VALUES (${projectId}, 'bad', 'bogus')
      `),
    ).rejects.toThrow();
  });

  it("supports optimistic concurrency via version", async () => {
    const feature = await createFeature(db, { layerId, geometry: polygon });
    expect(feature.version).toBe(1);

    const updated = await updateFeature(db, feature.id, {
      version: 1,
      properties: { revisao: 2 },
    });
    expect(updated?.version).toBe(2);
    expect(updated?.properties).toEqual({ revisao: 2 });

    await expect(
      updateFeature(db, feature.id, { version: 1, properties: {} }),
    ).rejects.toBeInstanceOf(VersionConflictError);
    await expect(
      updateFeature(db, feature.id, { version: 1, properties: {} }),
    ).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
      expectedVersion: 1,
      currentVersion: 2,
    });
  });

  it("soft-deletes features without dropping rows", async () => {
    const feature = await createFeature(db, { layerId, geometry: polygon });
    const deletedId = await softDeleteFeature(db, feature.id);
    expect(deletedId).toBe(feature.id);

    expect(await getFeature(db, feature.id)).toBeNull();
    const withDeleted = await getFeature(db, feature.id, {
      includeDeleted: true,
    });
    expect(withDeleted?.deletedAt).toBeInstanceOf(Date);

    const page = await listFeatures(db, { layerId });
    expect(page.items).toHaveLength(0);
  });

  it("soft-deletes layers and keeps their features readable", async () => {
    await createFeature(db, { layerId, geometry: polygon });
    expect(await softDeleteLayer(db, layerId)).toBe(layerId);
    expect(await getLayer(db, layerId)).toBeNull();

    const listed = await listLayers(db, { projectId });
    expect(listed.items).toHaveLength(0);
    const remaining = await listFeatures(db, { layerId });
    expect(remaining.items).toHaveLength(1);
  });

  it("pages with a stable keyset cursor and no duplicates", async () => {
    for (let index = 0; index < 5; index += 1) {
      await createFeature(db, {
        layerId,
        geometry: polygon,
        properties: { i: index },
      });
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page += 1) {
      const result = await listFeatures(db, {
        layerId,
        limit: 2,
        ...(cursor !== undefined ? { cursor } : {}),
      });
      seen.push(...result.items.map((item) => item.id));
      if (result.nextCursor === null) break;
      cursor = result.nextCursor;
    }
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  it("lists newest projects first and round-trips audit events", async () => {
    await createProject(db, { name: "primeiro" });
    await createProject(db, { name: "segundo" });
    const projects = await listProjects(db, { limit: 10 });
    expect(
      projects.items
        .map((project) => project.name)
        .filter((name) => name === "segundo" || name === "primeiro"),
    ).toEqual(["segundo", "primeiro"]);

    const project = projects.items[0];
    expect(project).toBeDefined();
    const audit = await insertAuditEvent(db, {
      entityType: "project",
      entityId: project?.id ?? "00000000-0000-4000-8000-000000000000",
      action: "update",
      requestId: "00000000-0000-4000-8000-000000000001",
      after: { name: "segundo" },
    });
    expect(audit.actorType).toBe("system");
    expect(audit.after).toEqual({ name: "segundo" });
  });

  it("gets only active projects", async () => {
    const active = await getProject(db, projectId);
    expect(active?.id).toBe(projectId);
    const deleted = await createProject(db, {
      name: "projeto-detalhe-removido",
    });
    if (deleted === undefined) throw new Error("createProject returned no row");
    await db.execute(
      sql`UPDATE projects SET deleted_at = now() WHERE id = ${deleted.id}`,
    );
    expect(await getProject(db, deleted.id)).toBeNull();
  });

  it("pages projects with a stable cursor, equal timestamps, and tombstones", async () => {
    const createdAt = new Date("2026-01-02T03:04:05.000Z");
    await db.insert(projects).values([
      { workspaceId, name: "pagina-a", createdAt },
      { workspaceId, name: "pagina-b", createdAt },
      { workspaceId, name: "pagina-c", createdAt },
    ]);

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 5; page += 1) {
      const result = await listProjects(db, {
        ...(cursor !== undefined ? { cursor } : {}),
        limit: 1,
      });
      seen.push(
        ...result.items
          .map((project) => project.name)
          .filter((name) => name.startsWith("pagina-")),
      );
      if (result.nextCursor === null) break;
      cursor = result.nextCursor;
    }
    expect(seen).toHaveLength(3);
    expect(new Set(seen)).toEqual(
      new Set(["pagina-a", "pagina-b", "pagina-c"]),
    );

    const deleted = await createProject(db, { name: "pagina-deletada" });
    if (deleted === undefined) throw new Error("createProject returned no row");
    await db.execute(
      sql`UPDATE projects SET deleted_at = now() WHERE id = ${deleted.id}`,
    );
    const remaining = await listProjects(db, { limit: 100 });
    expect(remaining.items.some((project) => project.id === deleted.id)).toBe(
      false,
    );
    await expect(
      listProjects(db, { cursor: "not-a-cursor" }),
    ).rejects.toBeInstanceOf(InvalidCursorError);
    await expect(
      listProjects(db, {
        cursor: remaining.nextCursor ?? "not-a-cursor",
        offset: 1,
      }),
    ).rejects.toBeInstanceOf(InvalidCursorError);
  });

  it("does not skip sub-millisecond project, layer, or feature rows", async () => {
    const projectNames = [
      "fraction-project-a",
      "fraction-project-b",
      "fraction-project-c",
    ];
    const projectRows = await Promise.all(
      projectNames.map((name) => createProject(db, { name })),
    );
    const projectIds = projectRows.map((row) => {
      if (row === undefined) throw new Error("createProject returned no row");
      return row.id;
    });
    const timestamps = [
      "2026-01-02T03:04:05.123900+00",
      "2026-01-02T03:04:05.123456+00",
      "2026-01-02T03:04:05.123111+00",
    ];
    for (const [index, id] of projectIds.entries()) {
      await db.execute(
        sql`UPDATE projects SET created_at = ${timestamps[index]}::timestamptz WHERE id = ${id}`,
      );
    }

    const layerRows = await Promise.all(
      ["fraction-layer-a", "fraction-layer-b", "fraction-layer-c"].map((name) =>
        createLayer(db, {
          projectId,
          name,
          kind: "polygon",
          geometryType: "Polygon",
        }),
      ),
    );
    const layerIds = layerRows.map((row) => row.id);
    for (const [index, id] of layerIds.entries()) {
      await db.execute(
        sql`UPDATE layers SET created_at = ${timestamps[index]}::timestamptz WHERE id = ${id}`,
      );
    }

    const featureRows = await Promise.all(
      [0, 1, 2].map(() => createFeature(db, { layerId, geometry: polygon })),
    );
    const featureIds = featureRows.map((row) => row.id);
    for (const [index, id] of featureIds.entries()) {
      await db.execute(
        sql`UPDATE features SET created_at = ${timestamps[index]}::timestamptz WHERE id = ${id}`,
      );
    }

    const collectProjects = async (): Promise<string[]> => {
      const seen: string[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 5; page += 1) {
        const result = await listProjects(db, {
          limit: 1,
          ...(cursor !== undefined ? { cursor } : {}),
        });
        seen.push(
          ...result.items
            .filter((row) => projectIds.includes(row.id))
            .map((row) => row.id),
        );
        if (result.nextCursor === null) break;
        cursor = result.nextCursor;
      }
      return seen;
    };
    const collectLayers = async (): Promise<string[]> => {
      const seen: string[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 5; page += 1) {
        const result = await listLayers(db, {
          projectId,
          limit: 1,
          ...(cursor !== undefined ? { cursor } : {}),
        });
        seen.push(
          ...result.items
            .filter((row) => layerIds.includes(row.id))
            .map((row) => row.id),
        );
        if (result.nextCursor === null) break;
        cursor = result.nextCursor;
      }
      return seen;
    };
    const collectFeatures = async (): Promise<string[]> => {
      const seen: string[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 5; page += 1) {
        const result = await listFeatures(db, {
          layerId,
          limit: 1,
          ...(cursor !== undefined ? { cursor } : {}),
        });
        seen.push(
          ...result.items
            .filter((row) => featureIds.includes(row.id))
            .map((row) => row.id),
        );
        if (result.nextCursor === null) break;
        cursor = result.nextCursor;
      }
      return seen;
    };

    for (const seen of [
      await collectProjects(),
      await collectLayers(),
      await collectFeatures(),
    ]) {
      expect(seen).toHaveLength(3);
      expect(new Set(seen).size).toBe(3);
    }
  });
});
