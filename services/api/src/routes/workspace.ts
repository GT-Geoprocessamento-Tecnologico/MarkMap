import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  capabilityProvisionRequestSchema,
  capabilityProvisionResponseSchema,
  capabilityRecoveryRequestSchema,
  ErrorCodes,
} from "@markmap/contracts";
import {
  getDb,
  provisionWorkspace,
  recoverWorkspaceCapability,
} from "@markmap/db";
import type { Hono } from "hono";

import { AppError, ErrorCode } from "../lib/errors.js";
import { checkWorkspaceRateLimit } from "../lib/workspace-rate-limit.js";

const digest = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");
const bearer = (): string => randomBytes(32).toString("base64url");

const applyRateLimitHeaders = (
  c: { header: (name: string, value: string) => void },
  remaining: number,
  retryAfterSeconds: number,
): void => {
  c.header("X-RateLimit-Remaining", String(remaining));
  c.header("Retry-After", String(retryAfterSeconds));
};

export const workspaceRoutes = (app: Hono<any, any, any>) => {
  app.post("/workspace/provision", async (c) => {
    const input = capabilityProvisionRequestSchema.parse(await c.req.json());
    const requestId = c.get("requestId") ?? randomUUID();
    const proofDigest = digest(input.bootstrapProof);
    const rateLimit = await checkWorkspaceRateLimit({
      scope: "provision",
      identityDigest: digest(
        `${input.workspaceId}:${input.installationId}:${proofDigest}`,
      ),
      requestId,
    });
    if (!rateLimit.allowed) {
      applyRateLimitHeaders(
        c,
        rateLimit.remaining,
        rateLimit.retryAfterSeconds,
      );
      return c.json(
        {
          error: {
            code: ErrorCodes.RATE_LIMITED,
            message: "Too many workspace provisioning attempts",
            requestId,
          },
        },
        429,
      );
    }

    const nextBearer = bearer();
    let workspace;
    try {
      workspace = await provisionWorkspace(getDb(), {
        workspaceId: input.workspaceId,
        proofDigest,
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

  app.post("/workspace/recover", async (c) => {
    const input = capabilityRecoveryRequestSchema.parse(await c.req.json());
    const requestId = c.get("requestId") ?? randomUUID();
    const proofDigest = digest(input.bootstrapProof);
    const rateLimit = await checkWorkspaceRateLimit({
      scope: "recover",
      identityDigest: proofDigest,
      requestId,
    });
    if (!rateLimit.allowed) {
      applyRateLimitHeaders(
        c,
        rateLimit.remaining,
        rateLimit.retryAfterSeconds,
      );
      return c.json(
        {
          error: {
            code: ErrorCodes.RATE_LIMITED,
            message: "Too many workspace recovery attempts",
            requestId,
          },
        },
        429,
      );
    }

    const nextBearer = bearer();
    const workspace = await recoverWorkspaceCapability(getDb(), {
      proofDigest,
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
