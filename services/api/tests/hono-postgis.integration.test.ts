import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { SyncOperation } from "@markmap/contracts";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Env } from "../src/env.js";

const url =
  process.env.TEST_DATABASE_URL ??
  "postgresql://geonexo_test:geonexo_test@127.0.0.1:58489/geonexo_localfirst_test";

let enabled = false;

try {
  const parsed = new URL(url);
  const raw = execSync("docker inspect geonexo-localfirst-test-20260929", {
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 3000,
  }).toString("utf8");
  const [container] = JSON.parse(raw);
  const binding =
    container?.NetworkSettings?.Ports?.["5432/tcp"]?.[0] ??
    container?.HostConfig?.PortBindings?.["5432/tcp"]?.[0];

  if (
    container?.Name === "/geonexo-localfirst-test-20260929" &&
    container?.Config?.Image === "postgis/postgis:16-3.4" &&
    container?.State?.Running === true &&
    binding?.HostIp === "127.0.0.1" &&
    binding?.HostPort === "58489" &&
    parsed.hostname === "127.0.0.1" &&
    parsed.port === "58489" &&
    parsed.pathname === "/geonexo_localfirst_test" &&
    parsed.username === "geonexo_test"
  ) {
    enabled = true;
    process.env.DATABASE_URL = url;
  }
} catch {
  enabled = false;
}

const maybeDescribe = enabled ? describe : describe.skip;

const env: Env = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3000,
  CORS_ORIGINS: "https://appmarkmap.mtsferreira.dev",
  LOG_LEVEL: "error",
  corsOrigins: ["https://appmarkmap.mtsferreira.dev"],
  DATABASE_URL: url,
  hasDatabase: true,
};

maybeDescribe("Hono API + Real Local PostGIS Integration", () => {
  const WORKSPACE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const WORKSPACE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const INSTALLATION_A = "11111111-1111-4111-8111-111111111111";
  const INSTALLATION_B = "22222222-2222-4222-8222-222222222222";
  const BOOTSTRAP_PROOF_A = "a".repeat(42) + "U";
  const BOOTSTRAP_PROOF_B = "b".repeat(42) + "U";

  let app: ReturnType<typeof import("../src/app.js").createApp>;
  let closeDb: (() => Promise<void>) | undefined;
  let bearerTokenA: string;
  let bearerTokenB: string;
  let op1: SyncOperation;
  let op2: SyncOperation;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    const dbModule = await import("@markmap/db");
    closeDb = dbModule.closeDb;
    const db = dbModule.getDb();

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const migrationsFolder = path.resolve(
      __dirname,
      "../../../packages/db/drizzle",
    );

    await migrate(db, { migrationsFolder });

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

    const appModule = await import("../src/app.js");
    app = appModule.createApp(env);

    const fixedTime = "2026-10-26T23:00:00.000Z";
    op1 = {
      operationId: "00000000-0000-4000-8000-000000000001",
      workspaceId: WORKSPACE_A,
      entity: "project",
      entityId: "33333333-3333-4333-8333-333333333333",
      operation: "upsert",
      baseVersion: null,
      createdAt: fixedTime,
      payload: {
        entity: "project",
        data: {
          id: "33333333-3333-4333-8333-333333333333",
          name: "Projeto Campo Real",
          status: "active",
          createdAt: fixedTime,
          updatedAt: fixedTime,
        },
      },
    };

    op2 = {
      operationId: "00000000-0000-4000-8000-000000000002",
      workspaceId: WORKSPACE_A,
      entity: "layer",
      entityId: "44444444-4444-4444-8444-444444444444",
      operation: "upsert",
      baseVersion: null,
      createdAt: fixedTime,
      payload: {
        entity: "layer",
        data: {
          id: "44444444-4444-4444-8444-444444444444",
          projectId: "33333333-3333-4333-8333-333333333333",
          name: "Camada de Vértices",
          description: null,
          kind: "point",
          geometryType: "Point",
          srid: 4674,
          style: {},
          metadata: {},
          visibleByDefault: true,
          sortOrder: 0,
          createdAt: fixedTime,
          updatedAt: fixedTime,
        },
      },
    };
  });

  afterAll(async () => {
    if (closeDb !== undefined) {
      await closeDb();
    }
  });

  it("provisions workspaces in the real local PostGIS database", async () => {
    const resA = await app.request("/api/v1/workspace/provision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: WORKSPACE_A,
        installationId: INSTALLATION_A,
        bootstrapProof: BOOTSTRAP_PROOF_A,
      }),
    });

    expect(resA.status).toBe(201);
    const bodyA = await resA.json();
    expect(bodyA.workspaceId).toBe(WORKSPACE_A);
    expect(bodyA.bearer).toBeDefined();
    bearerTokenA = bodyA.bearer;

    const resB = await app.request("/api/v1/workspace/provision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: WORKSPACE_B,
        installationId: INSTALLATION_B,
        bootstrapProof: BOOTSTRAP_PROOF_B,
      }),
    });

    expect(resB.status).toBe(201);
    const bodyB = await resB.json();
    expect(bodyB.workspaceId).toBe(WORKSPACE_B);
    expect(bodyB.bearer).toBeDefined();
    bearerTokenB = bodyB.bearer;
  });

  it("applies a push batch to PostGIS and receives durable sequence & version ACKs", async () => {
    const response = await app.request("/api/v1/sync/push", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bearerTokenA}`,
      },
      body: JSON.stringify({ operations: [op1, op2] }),
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.accepted).toHaveLength(2);
    expect(result.conflicts).toHaveLength(0);
    expect(result.alreadyApplied).toHaveLength(0);

    expect(result.accepted[0].operationId).toBe(op1.operationId);
    expect(result.accepted[0].version).toBe(1);
    expect(BigInt(result.accepted[0].sequence)).toBeGreaterThan(0n);

    expect(result.accepted[1].operationId).toBe(op2.operationId);
    expect(result.accepted[1].version).toBe(1);
    expect(BigInt(result.accepted[1].sequence)).toBeGreaterThan(
      BigInt(result.accepted[0].sequence),
    );
  });

  it("replays the exact same push batch idempotently returning alreadyApplied from PostGIS", async () => {
    const response = await app.request("/api/v1/sync/push", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bearerTokenA}`,
      },
      body: JSON.stringify({ operations: [op1] }),
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.accepted).toHaveLength(0);
    expect(result.alreadyApplied).toHaveLength(1);
    expect(result.alreadyApplied[0].operationId).toBe(op1.operationId);
    expect(result.alreadyApplied[0].version).toBe(1);
  });

  it("pulls incremental changes and cursor from PostGIS", async () => {
    const response = await app.request("/api/v1/sync/pull", {
      method: "GET",
      headers: {
        authorization: `Bearer ${bearerTokenA}`,
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.changes).toHaveLength(2);
    expect(body.nextCursor).toBeDefined();
    expect(body.hasMore).toBe(false);

    const pullWithCursor = await app.request(
      `/api/v1/sync/pull?cursor=${encodeURIComponent(body.nextCursor)}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${bearerTokenA}`,
        },
      },
    );

    expect(pullWithCursor.status).toBe(200);
    const secondPage = await pullWithCursor.json();
    expect(secondPage.changes).toHaveLength(0);
    expect(secondPage.hasMore).toBe(false);
  });

  it("enforces strict workspace isolation between workspace A and workspace B", async () => {
    // Attempt to pull workspace A's data using workspace B's token
    const resPullB = await app.request("/api/v1/sync/pull", {
      method: "GET",
      headers: {
        authorization: `Bearer ${bearerTokenB}`,
      },
    });

    expect(resPullB.status).toBe(200);
    const bodyB = await resPullB.json();
    // Workspace B must not see Workspace A's changes!
    expect(bodyB.changes).toHaveLength(0);

    // Attempt to push an operation for workspace A using workspace B's token
    const foreignOp: SyncOperation = {
      operationId: "00000000-0000-4000-8000-000000000099",
      workspaceId: WORKSPACE_A, // Foreign workspace!
      entity: "project",
      entityId: "99999999-9999-4999-8999-999999999999",
      operation: "upsert",
      baseVersion: null,
      createdAt: new Date().toISOString(),
      payload: {
        entity: "project",
        data: {
          id: "99999999-9999-4999-8999-999999999999",
          name: "Projeto Inválido",
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    };

    const resCross = await app.request("/api/v1/sync/push", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bearerTokenB}`,
      },
      body: JSON.stringify({ operations: [foreignOp] }),
    });

    expect(resCross.status).toBe(200);
    const crossResult = await resCross.json();
    expect(crossResult.accepted).toHaveLength(0);
    expect(crossResult.conflicts).toHaveLength(1);
    expect(crossResult.conflicts[0].reason).toBe("SCOPE_REJECTED");
  });
});
