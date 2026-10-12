import { and, eq, sql } from "drizzle-orm";

import type { Db } from "../client.js";
import { workspaces } from "../schema/workspaces.js";

export async function createWorkspace(
  db: Db,
  input: {
    workspaceId: string;
    proofDigest: string;
    capabilityHash: string;
    generation: string;
  },
) {
  const [row] = await db
    .insert(workspaces)
    .values({
      id: input.workspaceId,
      proofDigest: input.proofDigest,
      capabilityHash: input.capabilityHash,
      generation: BigInt(input.generation),
    })
    .onConflictDoNothing()
    .returning({ workspaceId: workspaces.id });
  if (row) return row;
  const [existing] = await db
    .select({ workspaceId: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, input.workspaceId),
        eq(workspaces.proofDigest, input.proofDigest),
      ),
    )
    .limit(1);
  if (!existing) throw new Error("workspace binding already exists");
  return existing;
}

/** Drizzle may wrap the PostgreSQL error in a QueryError.cause. */
const isWorkspaceUniqueViolation = (error: unknown): boolean => {
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if ("code" in current && current.code === "23505") return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
};

/**
 * Creates the anonymous workspace or rotates its bearer if the same bootstrap
 * proof is provisioned again. The monotonic generation lets the client ignore
 * a late response from an older provisioning attempt.
 */
export async function provisionWorkspace(
  db: Db,
  input: {
    workspaceId: string;
    proofDigest: string;
    capabilityHash: string;
  },
): Promise<{ workspaceId: string; generation: string }> {
  const rows = await (async () => {
    try {
      return await db.execute(sql`
    INSERT INTO workspaces (id, proof_digest, capability_hash, generation, next_sequence, revoked)
    VALUES (${input.workspaceId}, ${input.proofDigest}, ${input.capabilityHash}, 1, 0, false)
    ON CONFLICT (proof_digest) DO UPDATE SET
      capability_hash = EXCLUDED.capability_hash,
      generation = workspaces.generation + 1,
      updated_at = now()
    WHERE workspaces.id = EXCLUDED.id AND workspaces.revoked = false
    RETURNING id, generation
      `);
    } catch (error) {
      // Conflicting workspace identity/proof is a 409, not a retryable 500.
      // Do not expose PostgreSQL constraint names or parameter values.
      if (isWorkspaceUniqueViolation(error))
        throw new Error("workspace binding already exists");
      throw error;
    }
  })();
  const row = rows[0] as
    { id?: string; generation?: bigint | string | number } | undefined;
  if (
    typeof row?.id !== "string" ||
    row.id.length === 0 ||
    row.generation === undefined
  )
    throw new Error("workspace binding already exists or is revoked");
  return { workspaceId: row.id, generation: String(row.generation) };
}

export async function recoverWorkspaceCapability(
  db: Db,
  input: { proofDigest: string; capabilityHash: string },
): Promise<{ workspaceId: string; generation: string } | null> {
  const rows = await db.execute(sql`
    UPDATE workspaces
    SET capability_hash = ${input.capabilityHash},
        generation = generation + 1,
        updated_at = now()
    WHERE proof_digest = ${input.proofDigest} AND revoked = false
    RETURNING id, generation
  `);
  const row = rows[0] as
    { id?: string; generation?: bigint | string | number } | undefined;
  if (
    typeof row?.id !== "string" ||
    row.id.length === 0 ||
    row.generation === undefined
  )
    return null;
  return { workspaceId: row.id, generation: String(row.generation) };
}

export async function findWorkspaceByCapabilityHash(db: Db, hash: string) {
  const [row] = await db
    .select({
      workspaceId: workspaces.id,
      capabilityHash: workspaces.capabilityHash,
      generation: workspaces.generation,
    })
    .from(workspaces)
    .where(
      and(eq(workspaces.capabilityHash, hash), eq(workspaces.revoked, false)),
    )
    .limit(1);
  return row
    ? {
        workspaceId: row.workspaceId,
        capabilityHash: row.capabilityHash,
        generation: String(row.generation),
      }
    : null;
}
