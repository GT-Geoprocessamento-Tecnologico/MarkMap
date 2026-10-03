import { Hono } from "hono";
import { z } from "zod";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { Env } from "../env.js";
import { AppError } from "../lib/errors.js";

const storageKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .refine(
    (key) =>
      !key.startsWith("/") &&
      !key.includes("\\") &&
      !key.split("/").includes(".."),
    "Invalid storage key",
  );

const storageUnavailable = () =>
  new AppError("Storage capability is not available", {
    status: 503,
    code: "INTERNAL_ERROR",
  });

export const storageRoutes = (env: Env) => {
  const routes = new Hono();

  // Initialize S3 client if credentials are present
  let s3Client: S3Client | null = null;
  if (
    env.S3_ENDPOINT &&
    env.S3_REGION &&
    env.S3_ACCESS_KEY_ID &&
    env.S3_SECRET_ACCESS_KEY &&
    env.S3_BUCKET
  ) {
    s3Client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
      // Force path style for S3 compatible services
      forcePathStyle: true,
    });
  }

  routes.get("/presign/put", async (c) => {
    const key = storageKeySchema.parse(c.req.query("key"));
    const workspaceId = c.get("capabilityWorkspaceId") as string;
    if (!workspaceId) {
      throw new AppError("Workspace not provisioned", {
        status: 401,
        code: "VALIDATION_ERROR",
      });
    }
    const namespacedKey = `${workspaceId}/${key}`;
    if (!s3Client) {
      throw storageUnavailable();
    }
    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET!,
      Key: namespacedKey,
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes
    return c.json({ url });
  });

  routes.get("/presign/get", async (c) => {
    const key = storageKeySchema.parse(c.req.query("key"));
    const workspaceId = c.get("capabilityWorkspaceId") as string;
    if (!workspaceId) {
      throw new AppError("Workspace not provisioned", {
        status: 401,
        code: "VALIDATION_ERROR",
      });
    }
    const namespacedKey = `${workspaceId}/${key}`;
    if (!s3Client) {
      throw storageUnavailable();
    }
    const command = new GetObjectCommand({
      Bucket: env.S3_BUCKET!,
      Key: namespacedKey,
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    return c.json({ url });
  });

  return routes;
};
