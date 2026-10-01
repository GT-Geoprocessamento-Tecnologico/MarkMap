import { createHash } from "node:crypto";

import { findWorkspaceByCapabilityHash, getDb } from "@geonexo/db";
import type { MiddlewareHandler } from "hono";

import { AppError, ErrorCode } from "../lib/errors.js";

const BEARER_PATTERN = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;

export const hashCapability = (bearer: string): string =>
  createHash("sha256").update(bearer, "utf8").digest("hex");

export const capabilityMiddleware =
  (): MiddlewareHandler<any> => async (c, next) => {
    const authorization = c.req.header("Authorization") ?? "";
    const match = /^Bearer\s+(.+)$/.exec(authorization);
    const bearer = match?.[1] ?? "";
    if (!BEARER_PATTERN.test(bearer))
      throw new AppError("Workspace capability is required", {
        status: 401,
        code: ErrorCode.VALIDATION_ERROR,
      });

    const capabilityHash = hashCapability(bearer);
    const workspace = await findWorkspaceByCapabilityHash(
      getDb(),
      capabilityHash,
    );
    if (!workspace)
      throw new AppError("Workspace capability is invalid or revoked", {
        status: 401,
        code: ErrorCode.VALIDATION_ERROR,
      });

    c.set("capabilityWorkspaceId", workspace.workspaceId);
    c.set("capabilityHash", workspace.capabilityHash);
    c.set("capabilityGeneration", workspace.generation);
    await next();
  };
