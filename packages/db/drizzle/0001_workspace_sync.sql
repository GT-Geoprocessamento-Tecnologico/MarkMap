-- Workspace-scoped local-first sync persistence. Forward-only migration.
CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" uuid PRIMARY KEY,
  "proof_digest" varchar(64) NOT NULL UNIQUE,
  "capability_hash" varchar(64) NOT NULL UNIQUE,
  "generation" bigint NOT NULL DEFAULT 0,
  "next_sequence" bigint NOT NULL DEFAULT 0,
  "revoked" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "workspace_id" uuid;
ALTER TABLE "maps" ADD COLUMN IF NOT EXISTS "workspace_id" uuid;
ALTER TABLE "layers" ADD COLUMN IF NOT EXISTS "workspace_id" uuid;
ALTER TABLE "features" ADD COLUMN IF NOT EXISTS "workspace_id" uuid;
ALTER TABLE "imports" ADD COLUMN IF NOT EXISTS "workspace_id" uuid;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "projects" WHERE "workspace_id" IS NULL)
     OR EXISTS (SELECT 1 FROM "maps" WHERE "workspace_id" IS NULL)
     OR EXISTS (SELECT 1 FROM "layers" WHERE "workspace_id" IS NULL)
     OR EXISTS (SELECT 1 FROM "features" WHERE "workspace_id" IS NULL)
     OR EXISTS (SELECT 1 FROM "imports" WHERE "workspace_id" IS NULL) THEN
    RAISE EXCEPTION 'workspace migration blocked: existing synchronized rows have no workspace_id';
  END IF;
END $$;
ALTER TABLE "projects" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "maps" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "layers" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "features" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "imports" ALTER COLUMN "workspace_id" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $ BEGIN
  ALTER TABLE "maps" ADD CONSTRAINT "maps_workspace_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $;
DO $ BEGIN
  ALTER TABLE "layers" ADD CONSTRAINT "layers_workspace_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "features" ADD CONSTRAINT "features_workspace_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "imports" ADD CONSTRAINT "imports_workspace_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "projects_workspace_idx" ON "projects" ("workspace_id");
CREATE INDEX IF NOT EXISTS "maps_workspace_idx" ON "maps" ("workspace_id");
CREATE INDEX IF NOT EXISTS "layers_workspace_idx" ON "layers" ("workspace_id");
CREATE INDEX IF NOT EXISTS "features_workspace_idx" ON "features" ("workspace_id");
CREATE INDEX IF NOT EXISTS "imports_workspace_idx" ON "imports" ("workspace_id");
CREATE UNIQUE INDEX IF NOT EXISTS "projects_workspace_id_key" ON "projects" ("workspace_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "maps_workspace_id_key" ON "maps" ("workspace_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "layers_workspace_id_key" ON "layers" ("workspace_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "features_workspace_id_key" ON "features" ("workspace_id", "id");
DO $ BEGIN
  ALTER TABLE "maps" ADD CONSTRAINT "maps_workspace_project_fk" FOREIGN KEY ("workspace_id", "project_id") REFERENCES "projects"("workspace_id", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $;
DO $ BEGIN
  ALTER TABLE "layers" ADD CONSTRAINT "layers_workspace_project_fk" FOREIGN KEY ("workspace_id", "project_id") REFERENCES "projects"("workspace_id", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "features" ADD CONSTRAINT "features_workspace_layer_fk" FOREIGN KEY ("workspace_id", "layer_id") REFERENCES "layers"("workspace_id", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "imports" ADD CONSTRAINT "imports_workspace_project_fk" FOREIGN KEY ("workspace_id", "project_id") REFERENCES "projects"("workspace_id", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "imports" DROP CONSTRAINT IF EXISTS "imports_target_layer_id_layers_id_fk";
  ALTER TABLE "imports" ADD CONSTRAINT "imports_target_layer_id_layers_id_fk" FOREIGN KEY ("target_layer_id") REFERENCES "layers"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "imports" DROP CONSTRAINT IF EXISTS "imports_workspace_layer_fk";
  ALTER TABLE "imports" ADD CONSTRAINT "imports_workspace_layer_fk" FOREIGN KEY ("workspace_id", "target_layer_id") REFERENCES "layers"("workspace_id", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "sync_entities" (
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "entity" varchar(16) NOT NULL,
  "entity_id" uuid NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "payload" jsonb,
  "deleted_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_id", "entity", "entity_id")
);
CREATE TABLE IF NOT EXISTS "sync_operations" (
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "operation_id" uuid NOT NULL,
  "entity" varchar(16) NOT NULL,
  "entity_id" uuid NOT NULL,
  "operation" varchar(8) NOT NULL,
  "envelope" jsonb NOT NULL,
  "version" integer NOT NULL,
  "sequence" bigint NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_id", "operation_id")
);
CREATE INDEX IF NOT EXISTS "sync_operations_workspace_sequence_idx" ON "sync_operations" ("workspace_id", "sequence");
CREATE TABLE IF NOT EXISTS "sync_tombstones" (
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "entity" varchar(16) NOT NULL,
  "entity_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "sequence" bigint NOT NULL,
  "deleted_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_id", "entity", "entity_id")
);
CREATE INDEX IF NOT EXISTS "sync_tombstones_workspace_sequence_idx" ON "sync_tombstones" ("workspace_id", "sequence");
CREATE TABLE IF NOT EXISTS "upload_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "metadata" jsonb NOT NULL,
  "blob_id" uuid NOT NULL,
  "received_bytes" bigint NOT NULL DEFAULT 0,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "upload_sessions_workspace_idx" ON "upload_sessions" ("workspace_id");
