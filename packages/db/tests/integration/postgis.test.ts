import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Bbox, Geometry } from '@geonexo/contracts';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  InvalidGeometryError,
  VersionConflictError,
  createDb,
  createFeature,
  createLayer,
  createProject,
  getFeature,
  getLayer,
  insertAuditEvent,
  listFeatures,
  listLayers,
  listProjects,
  softDeleteFeature,
  softDeleteLayer,
  updateFeature,
  type Db,
} from '../../src/index.js';

/**
 * Runs only when TEST_DATABASE_URL points at a database whose name contains
 * `test` — the suite TRUNCATEs tables, so the guard refuses anything else
 * (10-BACKEND-VISIONARIO-PRD.md: Neon dev/test branches only).
 */
const testUrl = process.env.TEST_DATABASE_URL ?? '';
const isTestUrl = (value: string): boolean => {
  try {
    return /test/i.test(new URL(value).pathname);
  } catch {
    return false;
  }
};
const describeIfTestDb = testUrl !== '' && isTestUrl(testUrl) ? describe : describe.skip;

const rowsOf = <T>(result: unknown): T[] => result as T[];

const polygon: Geometry = {
  type: 'Polygon',
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
  type: 'Polygon',
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
  type: 'Polygon',
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

describeIfTestDb('postgis persistence (real PostGIS)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let projectId: string;
  let layerId: string;

  const seedLayer = async (): Promise<void> => {
    const project = await createProject(db, { name: `proj-${Date.now()}` });
    const layer = await createLayer(db, {
      projectId: project!.id,
      name: 'camada-1',
      kind: 'polygon',
      geometryType: 'Polygon',
    });
    projectId = project!.id;
    layerId = layer.id;
  };

  beforeAll(async () => {
    const handle = createDb(testUrl);
    db = handle.db;
    close = handle.close;

    // Migrations from zero, then verify what 0000 promised: PostGIS live.
    const migrationsFolder = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../drizzle',
    );
    await migrate(db as any, { migrationsFolder });
    const extensions = rowsOf<{ extname: string }>(
      await db.execute(sql`SELECT extname FROM pg_extension`),
    );
    expect(extensions.map((row) => row.extname)).toEqual(
      expect.arrayContaining(['postgis', 'pgcrypto']),
    );
  }, 120_000);

  beforeEach(async () => {
    await db.execute(sql`
      TRUNCATE TABLE features, layers, maps, map_sources, imports, projects, audit_events
      RESTART IDENTITY CASCADE
    `);
    await seedLayer();
  });

  afterAll(async () => {
    await close();
  });

  it('stores the geometry in EPSG:4674 and returns wire EPSG:4326', async () => {
    const created = await createFeature(db, {
      layerId,
      geometry: polygon,
      properties: { nome: 'quadra' },
    });
    expect(created.version).toBe(1);
    expect(created.properties).toEqual({ nome: 'quadra' });

    const result = rowsOf<{ srid: number }>(
      await db.execute(sql`SELECT ST_SRID(geometry) AS srid FROM features WHERE id = ${created.id}`),
    );
    expect(result[0]?.srid).toBe(4674);

    const fetched = await getFeature(db, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.geometry.type).toBe('Polygon');
    const original = polygon.coordinates[0] ?? [];
    const stored =
      fetched?.geometry.type === 'Polygon' ? (fetched.geometry.coordinates[0] ?? []) : [];
    expect(stored).toHaveLength(original.length);
    stored.forEach((position, index) => {
      const expected = original[index] ?? [0, 0];
      expect(position[0]).toBeCloseTo(expected[0] ?? 0, 5);
      expect(position[1]).toBeCloseTo(expected[1] ?? 0, 5);
    });
  });

  it('lists only features overlapping the bbox (GiST-backed)', async () => {
    const inside = await createFeature(db, { layerId, geometry: polygon });
    await createFeature(db, { layerId, geometry: farAwayPolygon });

    const page = await listFeatures(db, { layerId, bbox: bboxAroundPolygon });
    expect(page.items.map((feature) => feature.id)).toEqual([inside.id]);
  });

  it('rejects empty and self-intersecting geometries with INVALID_GEOMETRY', async () => {
    await expect(
      createFeature(db, { layerId, geometry: { type: 'Polygon', coordinates: [] } }),
    ).rejects.toBeInstanceOf(InvalidGeometryError);
    await expect(createFeature(db, { layerId, geometry: bowtie })).rejects.toBeInstanceOf(
      InvalidGeometryError,
    );
  });

  it('enforces SRID 4674 at the database level', async () => {
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
    expect(count[0]?.n).toBe('0');
  });

  it('enforces enum-like CHECKs at the database level', async () => {
    await expect(
      db.execute(sql`
        INSERT INTO layers (project_id, name, kind)
        VALUES (${projectId}, 'bad', 'bogus')
      `),
    ).rejects.toThrow();
  });

  it('supports optimistic concurrency via version', async () => {
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
      code: 'VERSION_CONFLICT',
      expectedVersion: 1,
      currentVersion: 2,
    });
  });

  it('soft-deletes features without dropping rows', async () => {
    const feature = await createFeature(db, { layerId, geometry: polygon });
    const deletedId = await softDeleteFeature(db, feature.id);
    expect(deletedId).toBe(feature.id);

    expect(await getFeature(db, feature.id)).toBeNull();
    const withDeleted = await getFeature(db, feature.id, { includeDeleted: true });
    expect(withDeleted?.deletedAt).toBeInstanceOf(Date);

    const page = await listFeatures(db, { layerId });
    expect(page.items).toHaveLength(0);
  });

  it('soft-deletes layers and keeps their features readable', async () => {
    await createFeature(db, { layerId, geometry: polygon });
    expect(await softDeleteLayer(db, layerId)).toBe(layerId);
    expect(await getLayer(db, layerId)).toBeNull();

    const listed = await listLayers(db, { projectId });
    expect(listed.items).toHaveLength(0);
    const remaining = await listFeatures(db, { layerId });
    expect(remaining.items).toHaveLength(1);
  });

  it('pages with a stable keyset cursor and no duplicates', async () => {
    for (let index = 0; index < 5; index += 1) {
      await createFeature(db, { layerId, geometry: polygon, properties: { i: index } });
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page += 1) {
      const result = await listFeatures(db, { layerId, limit: 2, ...(cursor ? { cursor } : {}) });
      seen.push(...result.items.map((item) => item.id));
      if (result.nextCursor === null) break;
      cursor = result.nextCursor;
    }
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  it('lists newest projects first and round-trips audit events', async () => {
    await createProject(db, { name: 'primeiro' });
    await createProject(db, { name: 'segundo' });
    const projects = await listProjects(db, { limit: 10 });
    expect(projects.items.map((project) => project.name)).toEqual(['segundo', 'primeiro']);

    const project = projects.items[0];
    expect(project).toBeDefined();
    const audit = await insertAuditEvent(db, {
      entityType: 'project',
      entityId: project?.id ?? '00000000-0000-4000-8000-000000000000',
      action: 'update',
      requestId: '00000000-0000-4000-8000-000000000001',
      after: { name: 'segundo' },
    });
    expect(audit.actorType).toBe('system');
    expect(audit.after).toEqual({ name: 'segundo' });
  });
});
