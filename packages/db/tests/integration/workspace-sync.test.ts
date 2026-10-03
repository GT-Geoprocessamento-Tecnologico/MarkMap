import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDb,
  createWorkspace,
  applyPushOperation,
  createUploadSession,
  consumeRateLimit,
  pullChanges,
  projects,
  layers,
  imports,
} from "../../src/index.js";
import type { Db } from "../../src/index.js";

const url = process.env.TEST_DATABASE_URL ?? "";
const enabled = (() => {
  try {
    const parsed = new URL(url);
    if (
      process.env.GEONEXO_CI_INTEGRATION === "true" &&
      parsed.hostname === "127.0.0.1" &&
      parsed.port === "5432" &&
      parsed.pathname === "/geonexo_localfirst_test" &&
      parsed.username === "geonexo_test"
    )
      return true;
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
})();
const run = enabled ? describe : describe.skip;

run("workspace scoped sync persistence", () => {
  let db: Db;
  let close: () => Promise<void>;
  const workspaceId = "11111111-1111-4111-8111-111111111111";
  const otherWorkspaceId = "22222222-2222-4222-8222-222222222222";
  const projectId = "33333333-3333-4333-8333-333333333333";
  const operationId = "44444444-4444-4444-8444-444444444444";
  const envelope = (
    workspace: string,
    operation = operationId,
    entity = projectId,
  ) => ({
    operationId: operation,
    workspaceId: workspace,
    entity: "project" as const,
    entityId: entity,
    operation: "upsert" as const,
    baseVersion: null,
    createdAt: new Date().toISOString(),
    payload: {
      entity: "project" as const,
      data: {
        id: entity,
        name: "offline",
        description: "test",
        status: "active" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  });

  beforeAll(async () => {
    const handle = createDb(url, { statementTimeoutMs: 60_000 });
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
    await migrate(db, {
      migrationsFolder: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../drizzle",
      ),
    });
    await migrate(db, {
      migrationsFolder: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../drizzle",
      ),
    });
  });
  beforeEach(async () => {
    await db.execute(sql`
      DELETE FROM sync_tombstones;
      DELETE FROM sync_operations;
      DELETE FROM sync_entities;
      DELETE FROM upload_sessions;
      DELETE FROM audit_events;
      DELETE FROM workspaces;
      DELETE FROM features;
      DELETE FROM imports;
      DELETE FROM layers;
      DELETE FROM projects;
    `);
    await createWorkspace(db, {
      workspaceId,
      proofDigest: "a".repeat(64),
      capabilityHash: "b".repeat(64),
      generation: "0",
    });
    await createWorkspace(db, {
      workspaceId: otherWorkspaceId,
      proofDigest: "c".repeat(64),
      capabilityHash: "d".repeat(64),
      generation: "0",
    });
  });
  afterAll(async () => {
    await close();
  });

  it("commits an operation once and replays the durable receipt", async () => {
    const operation = envelope(workspaceId);
    const first = await applyPushOperation(db, operation, workspaceId);
    const second = await applyPushOperation(db, operation, workspaceId);
    expect(first).toMatchObject({
      status: "accepted",
      version: 1,
      sequence: "1",
    });
    expect(second).toMatchObject({
      status: "already_applied",
      version: 1,
      sequence: "1",
    });
  });

  it("rejects scope and stale versions without disclosing payload", async () => {
    const rejected = await applyPushOperation(
      db,
      envelope(otherWorkspaceId),
      workspaceId,
    );
    expect(rejected).toMatchObject({
      status: "conflict",
      conflict: { reason: "SCOPE_REJECTED", serverVersion: 0 },
    });
    await applyPushOperation(db, envelope(workspaceId), workspaceId);
    const stale = await applyPushOperation(
      db,
      {
        ...envelope(workspaceId, "55555555-5555-4555-8555-555555555555"),
        baseVersion: 0,
      },
      workspaceId,
    );
    expect(stale).toMatchObject({
      status: "conflict",
      conflict: { reason: "VERSION_CONFLICT", serverVersion: 1 },
    });
  });

  it("materializes project, layer and feature into PostGIS and exposes them to pull", async () => {
    const timestamp = "2026-09-30T12:00:00.000Z";
    const layerId = "99999999-9999-4999-8999-999999999991";
    const featureId = "99999999-9999-4999-8999-999999999992";

    expect(
      await applyPushOperation(
        db,
        {
          operationId: "99999999-9999-4999-8999-999999999901",
          workspaceId,
          entity: "project",
          entityId: projectId,
          operation: "upsert",
          baseVersion: null,
          createdAt: timestamp,
          payload: {
            entity: "project",
            data: {
              id: projectId,
              name: "Projeto sincronizado",
              description: "offline-first",
              status: "active",
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          },
        },
        workspaceId,
      ),
    ).toMatchObject({ status: "accepted", version: 1 });

    expect(
      await applyPushOperation(
        db,
        {
          operationId: "99999999-9999-4999-8999-999999999902",
          workspaceId,
          entity: "layer",
          entityId: layerId,
          operation: "upsert",
          baseVersion: null,
          createdAt: timestamp,
          payload: {
            entity: "layer",
            data: {
              id: layerId,
              projectId,
              name: "Pontos de campo",
              description: null,
              kind: "point",
              geometryType: "Point",
              srid: 4674,
              style: {},
              metadata: {},
              visibleByDefault: true,
              sortOrder: 0,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          },
        },
        workspaceId,
      ),
    ).toMatchObject({ status: "accepted", version: 1 });

    const featureOperation = {
      operationId: "99999999-9999-4999-8999-999999999903",
      workspaceId,
      entity: "feature" as const,
      entityId: featureId,
      operation: "upsert" as const,
      baseVersion: null,
      createdAt: timestamp,
      payload: {
        entity: "feature" as const,
        data: {
          id: featureId,
          layerId,
          geometry: {
            type: "Point" as const,
            coordinates: [-48.2084, -7.2096] as [number, number],
          },
          properties: { origem: "offline" },
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    };

    expect(
      await applyPushOperation(db, featureOperation, workspaceId),
    ).toMatchObject({ status: "accepted", version: 1 });

    const rows = await db.execute(sql`
      SELECT
        p.name AS project_name,
        l.name AS layer_name,
        f.version,
        ST_SRID(f.geometry) AS srid,
        ST_X(ST_Transform(f.geometry, 4326)) AS lng,
        ST_Y(ST_Transform(f.geometry, 4326)) AS lat,
        f.properties
      FROM features f
      JOIN layers l ON l.id = f.layer_id AND l.workspace_id = f.workspace_id
      JOIN projects p ON p.id = l.project_id AND p.workspace_id = l.workspace_id
      WHERE f.id = ${featureId}::uuid AND f.workspace_id = ${workspaceId}::uuid
    `);
    expect(rows[0]).toMatchObject({
      project_name: "Projeto sincronizado",
      layer_name: "Pontos de campo",
      version: 1,
      srid: 4674,
      properties: { origem: "offline" },
    });
    expect(Number((rows[0] as { lng: number }).lng)).toBeCloseTo(-48.2084, 5);
    expect(Number((rows[0] as { lat: number }).lat)).toBeCloseTo(-7.2096, 5);

    const secondDevice = await pullChanges(
      db,
      { workspaceId, afterSequence: "0", limit: 10 },
      workspaceId,
    );
    expect(secondDevice.changes).toHaveLength(3);
    const pulledFeature = secondDevice.changes.find(
      (change) => change.entity === "feature",
    );
    expect(pulledFeature).toMatchObject({
      entity: "feature",
      entityId: featureId,
      version: 1,
    });
    if (pulledFeature?.operation === "upsert")
      expect(pulledFeature.payload).toEqual(featureOperation.payload);
  });

  it("pulls committed sequences and retains the cursor on empty pages", async () => {
    await applyPushOperation(db, envelope(workspaceId), workspaceId);
    const page = await pullChanges(
      db,
      {
        workspaceId,
        afterSequence: "0",
        limit: 10,
      },
      workspaceId,
    );
    expect(page.changes).toHaveLength(1);
    expect(page.lastSequence).toBe("1");
    const empty = await pullChanges(
      db,
      {
        workspaceId,
        afterSequence: page.lastSequence,
        limit: 10,
      },
      workspaceId,
    );
    expect(empty.changes).toHaveLength(0);
    expect(empty.lastSequence).toBe("1");
  });

  it("rejects pull scope mismatch before querying", async () => {
    await expect(
      pullChanges(
        db,
        { workspaceId: otherWorkspaceId, afterSequence: "0", limit: 10 },
        workspaceId,
      ),
    ).rejects.toThrow("workspace scope mismatch");
  });

  it("replays concurrent duplicates and rejects a changed envelope", async () => {
    const operation = envelope(workspaceId);
    const handles = Array.from({ length: 4 }, () => createDb(url));
    const results = await Promise.all(
      handles.map((handle) =>
        applyPushOperation(handle.db, operation, workspaceId),
      ),
    );
    await Promise.all(handles.map((handle) => handle.close()));
    expect(
      results.filter((result) => result.status === "accepted"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "already_applied"),
    ).toHaveLength(3);
    const mismatch = await applyPushOperation(
      db,
      {
        ...operation,
        payload: {
          ...operation.payload,
          data: { ...operation.payload.data, name: "changed" },
        },
      },
      workspaceId,
    );
    expect(mismatch).toMatchObject({
      status: "conflict",
      conflict: { reason: "SCOPE_REJECTED", serverVersion: 0 },
    });
  });

  it("allocates concurrent sequences without gaps and pulls tombstones", async () => {
    const operations = Array.from({ length: 4 }, (_, index) =>
      envelope(
        workspaceId,
        `66666666-6666-4666-8666-66666666666${index + 1}`,
        `77777777-7777-4777-8777-77777777777${index + 1}`,
      ),
    );
    const accepted = await Promise.all(
      operations.map((operation) => {
        const handle = createDb(url);
        return applyPushOperation(handle.db, operation, workspaceId).finally(
          () => handle.close(),
        );
      }),
    );
    expect(accepted.map((result) => result.sequence).sort()).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
    const deleted = await applyPushOperation(
      db,
      {
        operationId: "88888888-8888-4888-8888-888888888888",
        workspaceId,
        entity: "project",
        entityId: "77777777-7777-4777-8777-777777777771",
        operation: "delete",
        baseVersion: 1,
        createdAt: new Date().toISOString(),
      },
      workspaceId,
    );
    expect(deleted).toMatchObject({
      status: "accepted",
      version: 2,
      sequence: "5",
    });
    const page = await pullChanges(
      db,
      { workspaceId, afterSequence: "4", limit: 10 },
      workspaceId,
    );
    expect(page.tombstones).toHaveLength(1);
  });

  it("scopes upload metadata and rejects cross-workspace composite foreign keys", async () => {
    const metadata = {
      id: "99999999-9999-4999-8999-999999999999",
      projectId,
      originalName: "map.pdf",
      source: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        sha256: "a".repeat(64),
        bytes: 10,
        mediaType: "application/pdf",
      },
      format: "pdf" as const,
      state: "queued" as const,
      pageCount: 1,
      geoReference: null,
      errorCode: null,
    };
    const upload = await createUploadSession(db, { workspaceId, metadata });
    expect(upload.blobId).toBe(metadata.source.id);
    await expect(
      db
        .insert(projects)
        .values({ id: projectId, workspaceId, name: "scoped" }),
    ).resolves.toBeDefined();
    await expect(
      db.insert(layers).values({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        workspaceId: otherWorkspaceId,
        projectId,
        name: "bad",
        kind: "point",
        geometryType: "Point",
      }),
    ).rejects.toThrow();
  });


  it("enforces a rate bucket atomically across database connections", async () => {
    const handles = Array.from({ length: 6 }, () => createDb(url));
    try {
      const results = await Promise.all(
        handles.map((handle, index) =>
          consumeRateLimit(handle.db, {
            bucketKey: "workspace:provision:global",
            action: "workspace_provision",
            requestId: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${index + 1}`,
            limit: 3,
            windowSeconds: 60,
          }),
        ),
      );
      expect(results.filter((result) => result.allowed)).toHaveLength(3);
      expect(results.filter((result) => !result.allowed)).toHaveLength(3);
    } finally {
      await Promise.all(handles.map((handle) => handle.close()));
    }
  });

  it("deletes a scoped import with its target layer without nulling workspace", async () => {
    const layerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await db
      .insert(projects)
      .values({ id: projectId, workspaceId, name: "scoped" });
    await db.insert(layers).values({
      id: layerId,
      workspaceId,
      projectId,
      name: "target",
      kind: "point",
      geometryType: "Point",
    });
    await db.insert(imports).values({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      workspaceId,
      projectId,
      targetLayerId: layerId,
      originalName: "target.pdf",
      format: "pdf",
      status: "queued",
    });
    await db.delete(layers).where(sql`id = ${layerId}`);
    const rows = await db.select().from(imports);
    expect(rows).toHaveLength(0);
  });
});
