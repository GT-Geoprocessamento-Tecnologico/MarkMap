import { createHash, randomBytes } from "node:crypto";

import {
  capabilityProvisionRequestSchema,
  capabilityProvisionResponseSchema,
  capabilityRecoveryRequestSchema,
} from "@geonexo/contracts";
import {
  getDb,
  provisionWorkspace,
  recoverWorkspaceCapability,
} from "@geonexo/db";
import type { Hono } from "hono";

import { AppError, ErrorCode } from "../lib/errors.js";
import { rateLimit } from "../middleware/rate-limit";

const digest = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");
const bearer = (): string => randomBytes(32).toString("base64url");

export const workspaceRoutes = (app: Hono<any, any, any>) => {
  app.post("/workspace/provision", rateLimit, async (c) => {
    const input = capabilityProvisionRequestSchema.parse(await c.req.json());
    const nextBearer = bearer();
    let workspace;
    try {
      workspace = await provisionWorkspace(getDb(), {
        workspaceId: input.workspaceId,
        proofDigest: digest(input.bootstrapProof),
        capabilityHash: digest(nextBearer),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("workspace binding"))
        throw new AppError("Workspace could not be provisioned", {
          status: 409,
          code: ErrorCode.VALIDATION_ERROR,
        });
      throw error;
    }
    return c.json(
      capabilityProvisionResponseSchema.parse({
        workspaceId: workspace.workspaceId,
        bearer: nextBearer,
        generation: workspace.generation,
        issuedAt: new Date().toISOString(),
      }),
      201,
    );
  });

  app.post("/workspace/recover", rateLimit, async (c) => {
    const input = capabilityRecoveryRequestSchema.parse(await c.req.json());
    const nextBearer = bearer();
    const workspace = await recoverWorkspaceCapability(getDb(), {
      proofDigest: digest(input.bootstrapProof),
      capabilityHash: digest(nextBearer),
    });
    if (!workspace)
      throw new AppError("Workspace recovery proof is invalid or revoked", {
        status: 404,
        code: ErrorCode.VALIDATION_ERROR,
      });
    return c.json(
      capabilityProvisionResponseSchema.parse({
        workspaceId: workspace.workspaceId,
        bearer: nextBearer,
        generation: workspace.generation,
        issuedAt: new Date().toISOString(),
      }),
    );
  });
};
