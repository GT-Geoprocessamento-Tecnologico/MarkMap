import { describe, expect, it } from "vitest";

import {
  createLayerSchema,
  featureBearingLayerKindSchema,
  layerKindSchema,
  layerSchema,
} from "../src/layer.js";
import {
  createProjectSchema,
  projectSchema,
  projectStatusSchema,
  updateProjectSchema,
} from "../src/project.js";

const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const isoDate = "2026-01-01T00:00:00.000Z";

describe("projectStatusSchema", () => {
  it("defaults to active", () => {
    const result = projectStatusSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("active");
    }
  });

  it("accepts a stored lifecycle label", () => {
    expect(projectStatusSchema.safeParse("archived").success).toBe(true);
  });

  it("rejects an empty label", () => {
    expect(projectStatusSchema.safeParse("").success).toBe(false);
  });

  it("rejects a label wider than the varchar(32) column", () => {
    expect(projectStatusSchema.safeParse("a".repeat(33)).success).toBe(false);
  });
});

describe("projectSchema status", () => {
  const valid = {
    id: uuid,
    name: "Survey",
    createdAt: isoDate,
    updatedAt: isoDate,
  };

  it("accepts a stored status", () => {
    const result = projectSchema.safeParse({ ...valid, status: "archived" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("archived");
    }
  });

  it("falls back to active when the row carries no status", () => {
    const result = projectSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
    }
  });

  it("rejects an empty status", () => {
    expect(projectSchema.safeParse({ ...valid, status: "" }).success).toBe(
      false,
    );
  });

  it("rejects a status longer than 32 characters", () => {
    expect(
      projectSchema.safeParse({ ...valid, status: "a".repeat(33) }).success,
    ).toBe(false);
  });

  it("rejects a non-string status", () => {
    expect(projectSchema.safeParse({ ...valid, status: 1 }).success).toBe(
      false,
    );
  });
});

describe("createProjectSchema", () => {
  it("does not let the client choose the status", () => {
    const result = createProjectSchema.safeParse({
      name: "Survey",
      status: "archived",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data)).not.toContain("status");
    }
  });
});

describe("updateProjectSchema", () => {
  it("rejects an empty body", () => {
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a body whose fields are all undefined", () => {
    expect(
      updateProjectSchema.safeParse({ name: undefined, description: undefined })
        .success,
    ).toBe(false);
  });

  it("accepts a single field", () => {
    expect(updateProjectSchema.safeParse({ name: "Renamed" }).success).toBe(
      true,
    );
    expect(
      updateProjectSchema.safeParse({ description: "now scoped" }).success,
    ).toBe(true);
  });
});

describe("layerKindSchema", () => {
  it("accepts every logical kind", () => {
    for (const kind of [
      "point",
      "line",
      "polygon",
      "mixed",
      "raster",
      "remote",
    ]) {
      expect(layerKindSchema.safeParse(kind).success).toBe(true);
    }
  });

  it("rejects an unknown kind", () => {
    expect(layerKindSchema.safeParse("vector").success).toBe(false);
  });

  it("excludes raster and remote from the feature-bearing kinds", () => {
    expect(featureBearingLayerKindSchema.safeParse("raster").success).toBe(
      false,
    );
    expect(featureBearingLayerKindSchema.safeParse("remote").success).toBe(
      false,
    );
    expect(featureBearingLayerKindSchema.safeParse("point").success).toBe(true);
    expect(featureBearingLayerKindSchema.safeParse("line").success).toBe(true);
    expect(featureBearingLayerKindSchema.safeParse("polygon").success).toBe(
      true,
    );
    expect(featureBearingLayerKindSchema.safeParse("mixed").success).toBe(true);
  });
});

describe("layerSchema", () => {
  const baseLayer = {
    id: uuid,
    projectId: uuid,
    name: "Parcels",
    description: null,
    kind: "polygon",
    geometryType: "Polygon",
    srid: 4674,
    style: {},
    metadata: {},
    visibleByDefault: true,
    sortOrder: 0,
    createdAt: isoDate,
    updatedAt: isoDate,
  };

  it("accepts a polygon layer declaring Polygon", () => {
    const result = layerSchema.safeParse(baseLayer);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe("polygon");
      expect(result.data.geometryType).toBe("Polygon");
    }
  });

  it("accepts a mixed layer declaring a null geometryType", () => {
    const result = layerSchema.safeParse({
      ...baseLayer,
      kind: "mixed",
      geometryType: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a raster layer with a null geometryType", () => {
    const result = layerSchema.safeParse({
      ...baseLayer,
      kind: "raster",
      geometryType: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a raster layer that declares a geometryType", () => {
    const result = layerSchema.safeParse({
      ...baseLayer,
      kind: "raster",
      geometryType: "Polygon",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a remote layer that declares a geometryType", () => {
    const result = layerSchema.safeParse({
      ...baseLayer,
      kind: "remote",
      geometryType: "Point",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown kind", () => {
    expect(
      layerSchema.safeParse({ ...baseLayer, kind: "vector" }).success,
    ).toBe(false);
  });

  it("rejects an unknown geometryType", () => {
    expect(
      layerSchema.safeParse({ ...baseLayer, geometryType: "Circle" }).success,
    ).toBe(false);
  });

  it("rejects a non-positive srid", () => {
    expect(layerSchema.safeParse({ ...baseLayer, srid: 0 }).success).toBe(
      false,
    );
    expect(layerSchema.safeParse({ ...baseLayer, srid: -1 }).success).toBe(
      false,
    );
  });

  it("rejects a name wider than the varchar(160) column", () => {
    expect(
      layerSchema.safeParse({ ...baseLayer, name: "a".repeat(161) }).success,
    ).toBe(false);
  });

  it("rejects a non-ISO-UTC timestamp", () => {
    expect(
      layerSchema.safeParse({ ...baseLayer, createdAt: "2026-01-01 00:00:00" })
        .success,
    ).toBe(false);
  });

  it("fills the database defaults on a stored row", () => {
    const result = layerSchema.safeParse({
      id: uuid,
      projectId: uuid,
      name: "Parcels",
      description: null,
      kind: "raster",
      geometryType: null,
      createdAt: isoDate,
      updatedAt: isoDate,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.srid).toBe(4674);
      expect(result.data.style).toEqual({});
      expect(result.data.metadata).toEqual({});
      expect(result.data.visibleByDefault).toBe(true);
      expect(result.data.sortOrder).toBe(0);
    }
  });
});

describe("createLayerSchema", () => {
  it("applies the database defaults", () => {
    const result = createLayerSchema.safeParse({
      projectId: uuid,
      name: "Satellite",
      kind: "raster",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.geometryType).toBeNull();
      expect(result.data.srid).toBe(4674);
      expect(result.data.style).toEqual({});
      expect(result.data.metadata).toEqual({});
      expect(result.data.visibleByDefault).toBe(true);
      expect(result.data.sortOrder).toBe(0);
    }
  });

  it("rejects geometryType on a remote layer", () => {
    const result = createLayerSchema.safeParse({
      projectId: uuid,
      name: "Imagery WMS",
      kind: "remote",
      geometryType: "Point",
    });
    expect(result.success).toBe(false);
  });

  it("rejects geometryType on a raster layer", () => {
    const result = createLayerSchema.safeParse({
      projectId: uuid,
      name: "Orthophoto",
      kind: "raster",
      geometryType: "MultiPolygon",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a geometryType on a feature-bearing kind", () => {
    const result = createLayerSchema.safeParse({
      projectId: uuid,
      name: "Hydrants",
      kind: "mixed",
      geometryType: "MultiPoint",
      srid: 4674,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown kind", () => {
    const result = createLayerSchema.safeParse({
      projectId: uuid,
      name: "Bogus",
      kind: "vector",
    });
    expect(result.success).toBe(false);
  });
});
