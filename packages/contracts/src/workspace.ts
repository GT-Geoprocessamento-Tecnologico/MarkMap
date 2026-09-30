import { z } from "zod";

import { timestampSchema, uuidSchema } from "./project.js";

/** Canonical unpadded base64url encoding of exactly 32 random bytes. */
const capabilityTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/);

/** The capability is an authority for one anonymous workspace, not identity. */
export const workspaceCapabilitySchema = z
  .object({
    workspaceId: uuidSchema,
    bearer: capabilityTokenSchema,
    generation: z
      .string()
      .regex(/^(0|[1-9]\d*)$/, "generation must be decimal")
      .refine(
        (value) => BigInt(value) <= 9_223_372_036_854_775_807n,
        "generation exceeds PostgreSQL bigint",
      ),
    issuedAt: timestampSchema,
  })
  .strict();

/** Persisted server-side bootstrap record; raw proof is never stored here. */
export const bootstrapProofSchema = z
  .object({
    installationId: uuidSchema,
    proofDigest: z.string().regex(/^[a-f0-9]{64}$/i),
    createdAt: timestampSchema,
  })
  .strict();

export const capabilityProvisionRequestSchema = z
  .object({
    bootstrapProof: capabilityTokenSchema,
    installationId: uuidSchema,
    workspaceId: uuidSchema,
  })
  .strict();

export const capabilityRecoveryRequestSchema = z
  .object({
    bootstrapProof: capabilityTokenSchema,
  })
  .strict();

export const capabilityProvisionResponseSchema = workspaceCapabilitySchema;

export type WorkspaceCapability = z.infer<typeof workspaceCapabilitySchema>;
export type BootstrapProof = z.infer<typeof bootstrapProofSchema>;
export type CapabilityProvisionRequest = z.infer<
  typeof capabilityProvisionRequestSchema
>;
export type CapabilityRecoveryRequest = z.infer<
  typeof capabilityRecoveryRequestSchema
>;
export type CapabilityProvisionResponse = z.infer<
  typeof capabilityProvisionResponseSchema
>;
