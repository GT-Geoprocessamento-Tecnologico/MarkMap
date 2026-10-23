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
import { generatePresignedGetUrl, generatePresignedPutUrl } from "../src/storage.js";
import { S3Client } from "@aws-sdk/client-s3";

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

describe("generatePresignedGetUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    presignMocks.getSignedUrl.mockResolvedValue("https://signed.example/get-object");
  });

  it("generates a presigned GET URL with default expiration", async () => {
    const mockClient = {} as S3Client;
    const bucket = "test-bucket";
    const key = "test-key.txt";

    const url = await generatePresignedGetUrl(mockClient, bucket, key);

    expect(url).toBe("https://signed.example/get-object");
    expect(presignMocks.getSignedUrl).toHaveBeenCalledTimes(1);

    const callArgs = presignMocks.getSignedUrl.mock.calls[0];
    expect(callArgs[0]).toBe(mockClient);
    expect(callArgs[1]).toBeInstanceOf(GetObjectCommand);
    expect((callArgs[1] as GetObjectCommand).input).toEqual({
      Bucket: bucket,
      Key: key,
    });
    expect(callArgs[2]).toEqual({ expiresIn: 3600 });
  });

  it("generates a presigned GET URL with custom expiration", async () => {
    const mockClient = {} as S3Client;
    const bucket = "test-bucket";
    const key = "test-key.txt";
    const expiresIn = 7200;

    const url = await generatePresignedGetUrl(mockClient, bucket, key, expiresIn);

    expect(url).toBe("https://signed.example/get-object");
    expect(presignMocks.getSignedUrl).toHaveBeenCalledTimes(1);

    const callArgs = presignMocks.getSignedUrl.mock.calls[0];
    expect(callArgs[2]).toEqual({ expiresIn: 7200 });
  });
});
