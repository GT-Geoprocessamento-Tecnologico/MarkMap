-- GeoNexo 0000: extensions + core schema (projects, maps, layers, features,
-- map_sources, imports, audit_events). NEVER regenerate this file: the
-- extension lines below are hand-added after `drizzle-kit generate` (kit has
-- no native extension concept) and editing is safe because kit diffs against
-- meta/0000_snapshot.json, not this SQL. Rollback: see docs/database/migrations.md.
CREATE EXTENSION IF NOT EXISTS "postgis";
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"actor_type" varchar(32) DEFAULT 'system' NOT NULL,
	"actor_id" uuid,
	"request_id" uuid NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"layer_id" uuid NOT NULL,
	"geometry" geometry(Geometry, 4674) NOT NULL,
	"properties" jsonb DEFAULT '{}' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "features_geometry_srid_check" CHECK (ST_SRID("features"."geometry") = 4674),
	CONSTRAINT "features_geometry_not_empty_check" CHECK (NOT ST_IsEmpty("features"."geometry"))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"target_layer_id" uuid,
	"original_name" varchar(255) NOT NULL,
	"format" varchar(32) NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"row_count" integer,
	"error_code" varchar(64),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "imports_status_check" CHECK ("status" IN ('queued', 'processing', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "layers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"kind" varchar(32) NOT NULL,
	"geometry_type" varchar(32),
	"srid" integer DEFAULT 4674 NOT NULL,
	"style" jsonb DEFAULT '{}' NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"visible_by_default" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "layers_kind_check" CHECK ("kind" IN ('point', 'line', 'polygon', 'mixed', 'raster', 'remote')),
	CONSTRAINT "layers_geometry_type_check" CHECK ("geometry_type" IS NULL OR "geometry_type" IN ('Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon')),
	CONSTRAINT "layers_srid_check" CHECK ("layers"."srid" = 4674)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "map_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"name" varchar(160) NOT NULL,
	"provider_type" varchar(16) NOT NULL,
	"url_template" text NOT NULL,
	"attribution" text,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "map_sources_provider_type_check" CHECK ("provider_type" IN ('xyz', 'style', 'wms', 'wfs', 'pmtiles', 'geojson'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"default_center_lng" numeric(9, 6),
	"default_center_lat" numeric(9, 6),
	"default_zoom" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "features" ADD CONSTRAINT "features_layer_id_layers_id_fk" FOREIGN KEY ("layer_id") REFERENCES "public"."layers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "imports" ADD CONSTRAINT "imports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "imports" ADD CONSTRAINT "imports_target_layer_id_layers_id_fk" FOREIGN KEY ("target_layer_id") REFERENCES "public"."layers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "layers" ADD CONSTRAINT "layers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "map_sources" ADD CONSTRAINT "map_sources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "maps" ADD CONSTRAINT "maps_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "features_geometry_idx" ON "features" USING gist ("geometry");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "features_layer_id_idx" ON "features" USING btree ("layer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "layers_project_id_sort_order_idx" ON "layers" USING btree ("project_id","sort_order");