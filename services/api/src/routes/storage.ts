import { Hono } from "hono";
import { z } from "zod";

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

  routes.get("/presign/put", async (c) => {
    storageKeySchema.parse(c.req.query("key"));
    void env;
    throw storageUnavailable();
  });

  routes.get("/presign/get", async (c) => {
    storageKeySchema.parse(c.req.query("key"));
    void env;
    throw storageUnavailable();
  });

  return routes;
};
