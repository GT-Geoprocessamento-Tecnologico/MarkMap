import { and, eq } from "drizzle-orm";

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

export async function findWorkspaceByCapabilityHash(db: Db, hash: string) {
  const [row] = await db
    .select({ workspaceId: workspaces.id })
    .from(workspaces)
    .where(
      and(eq(workspaces.capabilityHash, hash), eq(workspaces.revoked, false)),
    )
    .limit(1);
  return row ?? null;
}
