-- Align production-created bootstrap objects with the versioned Drizzle schema.
-- The first production bootstrap used an unnamed SET NULL FK for imports;
-- 0001 later added the intended CASCADE FK, leaving both constraints present.
ALTER TABLE "imports" DROP CONSTRAINT IF EXISTS "imports_target_layer_id_fkey";
--> statement-breakpoint

-- These indexes duplicate UNIQUE/PRIMARY KEY indexes created by constraints.
DROP INDEX IF EXISTS "workspaces_capability_hash_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "sync_entities_pk";
--> statement-breakpoint
DROP INDEX IF EXISTS "sync_operations_workspace_operation_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "sync_tombstones_key_idx";
