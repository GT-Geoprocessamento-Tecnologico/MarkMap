import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey(),
    proofDigest: varchar("proof_digest", { length: 64 }).notNull().unique(),
    capabilityHash: varchar("capability_hash", { length: 64 })
      .notNull()
      .unique(),
    generation: bigint("generation", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    nextSequence: bigint("next_sequence", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    revoked: boolean("revoked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    capabilityIdx: index("workspaces_capability_hash_idx").on(t.capabilityHash),
  }),
);

export type WorkspaceRecord = typeof workspaces.$inferSelect;
