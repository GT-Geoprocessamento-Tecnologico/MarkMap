import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Hono } from "hono";
import { z } from "zod";

import type { Env } from "../env.js";
import { AppError } from "../lib/errors.js";
import { resolveWorkspaceCapability } from "../middleware/capability.js";

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
  const endpoint = env.S3_ENDPOINT;
  const region = env.S3_REGION;
  const accessKeyId = env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
  const bucket = env.S3_BUCKET;

  const s3Client =
    endpoint !== undefined &&
    endpoint.length > 0 &&
    region !== undefined &&
    region.length > 0 &&
    accessKeyId !== undefined &&
    accessKeyId.length > 0 &&
    secretAccessKey !== undefined &&
    secretAccessKey.length > 0 &&
    bucket !== undefined &&
    bucket.length > 0
      ? new S3Client({
          endpoint,
          region,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
          forcePathStyle: true,
        })
      : null;

  routes.get("/presign/put", async (c) => {
    const key = storageKeySchema.parse(c.req.query("key"));
    const capability = await resolveWorkspaceCapability(
      c.req.header("Authorization"),
    );
    if (s3Client === null || bucket === undefined || bucket.length === 0)
      throw storageUnavailable();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: `${capability.workspaceId}/${key}`,
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    return c.json({ url });
  });

  routes.get("/presign/get", async (c) => {
    const key = storageKeySchema.parse(c.req.query("key"));
    const capability = await resolveWorkspaceCapability(
      c.req.header("Authorization"),
    );
    if (s3Client === null || bucket === undefined || bucket.length === 0)
      throw storageUnavailable();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: `${capability.workspaceId}/${key}`,
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    return c.json({ url });
  });

  return routes;
};
