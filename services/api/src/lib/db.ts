import type { Geometry, GeometryType } from "@markmap/contracts";
import {
  getDb,
  createProject,
  createLayer,
  createFeature,
  getLayer,
  projects,
} from "@markmap/db";
import type { Db } from "@markmap/db";
import { eq } from "drizzle-orm";

type ProjectRecord = typeof projects.$inferSelect;

async function getProjectById(
  d: Db,
  id: string,
): Promise<ProjectRecord | null> {
  const [row] = await d
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  return row ?? null;
}

export const db = {
  projects: {
    async findById(id: string) {
      const d = getDb();
      return getProjectById(d, id);
    },
    async create(data: { name: string; description?: string }) {
      const d = getDb();
      return createProject(d, data);
    },
  },
  layers: {
    async findById(id: string) {
      const d = getDb();
      return getLayer(d, id);
    },
    async create(data: {
      projectId: string;
      name: string;
      kind: import("@markmap/db").LayerKind;
      geometryType: GeometryType | null;
      description?: string | null;
    }) {
      const d = getDb();
      return createLayer(d, data);
    },
  },
  features: {
    async create(data: {
      layerId: string;
      geometry: Geometry;
      properties?: Record<string, unknown>;
    }) {
      const d = getDb();
      return createFeature(d, data);
    },
  },
};

export type Project = ProjectRecord;
export type Layer = import("@markmap/db").LayerRecord;
export type Feature = import("@markmap/db").FeatureRecord;
