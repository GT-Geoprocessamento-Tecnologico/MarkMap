import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getDb: vi.fn(() => ({})),
  findWorkspaceByCapabilityHash: vi.fn(),
}));

const presignMocks = vi.hoisted(() => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://signed.example/object"),
}));

vi.mock("@markmap/db", async () => ({
  ...(await vi.importActual<typeof import("@markmap/db")>("@markmap/db")),
  ...dbMocks,
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: presignMocks.getSignedUrl,
}));

import type { Env } from "../src/env.js";
import { createErrorHandler } from "../src/middleware/error-handler.js";
import { createLogger } from "../src/middleware/logger.js";
import { requestId } from "../src/middleware/request-id.js";
import { storageRoutes } from "../src/routes/storage.js";

const env: Env = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3000,
  CORS_ORIGINS: "http://localhost:5173",
  LOG_LEVEL: "error",
  corsOrigins: ["http://localhost:5173"],
  hasDatabase: false,
  S3_ENDPOINT: "https://storage.example",
  S3_REGION: "us-east-1",
  S3_ACCESS_KEY_ID: "test-access",
  S3_SECRET_ACCESS_KEY: "test-secret",
  S3_BUCKET: "geonexo-assets",
};

const bearer = "A".repeat(43);
const workspaceId = "11111111-1111-4111-8111-111111111111";

const createStorageApp = () => {
  const app = new Hono<{ Variables: { requestId: string } }>();
  app.use("*", requestId());
  app.onError(createErrorHandler(createLogger("error")));
  app.route("/storage", storageRoutes(env));
  return app;
};

describe("workspace-scoped storage presign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    presignMocks.getSignedUrl.mockResolvedValue(
      "https://signed.example/object",
    );
    dbMocks.findWorkspaceByCapabilityHash.mockResolvedValue({
      workspaceId,
      capabilityHash: "a".repeat(64),
      generation: "1",
    });
  });

  it("requires a workspace capability", async () => {
    const response = await createStorageApp().request(
      "/storage/presign/get?key=maps/file.pdf",
    );
    expect(response.status).toBe(401);
  });

  it("prefixes every signed key with the authorized workspace", async () => {
    const app = createStorageApp();
    const put = await app.request("/storage/presign/put?key=maps/file.pdf", {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    expect(put.status).toBe(200);

    const putCommand = presignMocks.getSignedUrl.mock.calls[0]?.[1];
    expect(putCommand).toBeInstanceOf(PutObjectCommand);
    expect((putCommand as PutObjectCommand).input.Key).toBe(
      `${workspaceId}/maps/file.pdf`,
    );

    const get = await app.request("/storage/presign/get?key=maps/file.pdf", {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    expect(get.status).toBe(200);
    const getCommand = presignMocks.getSignedUrl.mock.calls[1]?.[1];
    expect(getCommand).toBeInstanceOf(GetObjectCommand);
    expect((getCommand as GetObjectCommand).input.Key).toBe(
      `${workspaceId}/maps/file.pdf`,
    );
  });

  it("rejects path traversal before signing", async () => {
    const response = await createStorageApp().request(
      "/storage/presign/get?key=../secret",
      { headers: { Authorization: `Bearer ${bearer}` } },
    );
    expect(response.status).toBe(400);
    expect(presignMocks.getSignedUrl).not.toHaveBeenCalled();
  });
});

describe("getS3Client", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("throws an error if S3_ENDPOINT is missing", async () => {
    const { getS3Client } = await import("../src/storage.js");
    const testEnv = { ...env, S3_ENDPOINT: undefined };
    expect(() => getS3Client(testEnv)).toThrow("Missing S3 credentials");
  });

  it("throws an error if S3_REGION is missing", async () => {
    const { getS3Client } = await import("../src/storage.js");
    const testEnv = { ...env, S3_REGION: undefined };
    expect(() => getS3Client(testEnv)).toThrow("Missing S3 credentials");
  });

  it("throws an error if S3_ACCESS_KEY_ID is missing", async () => {
    const { getS3Client } = await import("../src/storage.js");
    const testEnv = { ...env, S3_ACCESS_KEY_ID: undefined };
    expect(() => getS3Client(testEnv)).toThrow("Missing S3 credentials");
  });

  it("throws an error if S3_SECRET_ACCESS_KEY is missing", async () => {
    const { getS3Client } = await import("../src/storage.js");
    const testEnv = { ...env, S3_SECRET_ACCESS_KEY: undefined };
    expect(() => getS3Client(testEnv)).toThrow("Missing S3 credentials");
  });

  it("creates and returns an S3Client when credentials are provided", async () => {
    const { getS3Client } = await import("../src/storage.js");
    const client = getS3Client(env);

    // We can't easily assert on the exact instance without exposing it,
    // but we can check if it returns an object with expected S3Client shape,
    // or just that it doesn't throw and returns something truthy.
    expect(client).toBeDefined();
    expect(typeof client.send).toBe('function');
  });

  it("caches the S3Client instance on subsequent calls", async () => {
    const { getS3Client } = await import("../src/storage.js");
    const client1 = getS3Client(env);
    const client2 = getS3Client(env);

    expect(client1).toBe(client2);
  });
});
