import { describe, expect, it } from "vitest";

import {
  blobRefSchema,
  geoReferenceSchema,
  offlineMapPackageManifestSchema,
  offlineMapArchiveRefSchema,
  mapSchema,
  geometrySchema,
  pushSyncRequestSchema,
  pullSyncResponseSchema,
  serverChangeSchema,
  syncConflictSchema,
  syncOperationSchema,
  workspaceCapabilitySchema,
} from "../src/index.js";

const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const other = "9c858901-8a57-4791-81fe-4c455b099bc9";
const date = "2026-01-01T00:00:00.000Z";
const blob = {
  id,
  sha256: "a".repeat(64),
  bytes: 10,
  mediaType: "application/pdf",
};
const archiveBlob = { ...blob, mediaType: "application/vnd.pmtiles" };
const styleBlob = { ...blob, mediaType: "application/json" };

describe("shared local-first contracts", () => {
  it("does not treat installation identifiers as a capability", () => {
    expect(
      workspaceCapabilitySchema.safeParse({
        workspaceId: id,
        installationId: id,
      }).success,
    ).toBe(false);
  });

  it("validates blob checksums and bounded size", () => {
    expect(blobRefSchema.safeParse(blob).success).toBe(true);
    expect(blobRefSchema.safeParse({ ...blob, sha256: "bad" }).success).toBe(
      false,
    );
    expect(
      blobRefSchema.safeParse({ ...blob, bytes: 26 * 1024 * 1024 }).success,
    ).toBe(false);
  });

  it("uses the larger bound only for regional map archives", () => {
    expect(
      blobRefSchema.safeParse({ ...blob, bytes: 26 * 1024 * 1024 }).success,
    ).toBe(false);
    expect(
      offlineMapArchiveRefSchema.safeParse({
        ...archiveBlob,
        bytes: 26 * 1024 * 1024,
      }).success,
    ).toBe(true);
    expect(
      offlineMapArchiveRefSchema.safeParse({
        ...archiveBlob,
        bytes: 250 * 1024 * 1024,
      }).success,
    ).toBe(true);
    expect(
      offlineMapArchiveRefSchema.safeParse({
        ...archiveBlob,
        bytes: 250 * 1024 * 1024 + 1,
      }).success,
    ).toBe(false);
  });

  it("requires the payload discriminant and id to match the operation", () => {
    const operation = {
      operationId: id,
      workspaceId: other,
      entity: "project",
      entityId: id,
      operation: "upsert",
      baseVersion: null,
      createdAt: date,
      payload: {
        entity: "project",
        data: {
          id: other,
          name: "P",
          status: "active",
          createdAt: date,
          updatedAt: date,
        },
      },
    };
    expect(syncOperationSchema.safeParse(operation).success).toBe(false);
    expect(
      pushSyncRequestSchema.safeParse({
        operations: [
          {
            ...operation,
            payload: {
              ...operation.payload,
              data: { ...operation.payload.data, id },
            },
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects payloads on deletes and invalid cursor semantics", () => {
    const deleted = {
      operationId: id,
      workspaceId: other,
      entity: "project",
      entityId: id,
      operation: "delete",
      baseVersion: null,
      createdAt: date,
      payload: {},
    };
    expect(syncOperationSchema.safeParse(deleted).success).toBe(false);
    expect(
      pullSyncResponseSchema.safeParse({
        changes: [],
        tombstones: [],
        nextCursor: "v1.a." + "b".repeat(43),
        hasMore: false,
      }).success,
    ).toBe(true);
    expect(
      pullSyncResponseSchema.safeParse({
        changes: [],
        tombstones: [],
        nextCursor: "workspace=" + other,
        hasMore: false,
      }).success,
    ).toBe(false);
  });

  it("rejects malformed server changes and mismatched conflict payloads", () => {
    const validUpsert = {
      operationId: id,
      entity: "project",
      entityId: id,
      operation: "upsert",
      payload: {
        entity: "project",
        data: {
          id,
          name: "P",
          status: "active",
          createdAt: date,
          updatedAt: date,
        },
      },
      version: 1,
      sequence: "1",
    };
    expect(
      serverChangeSchema.safeParse({ ...validUpsert, extra: true }).success,
    ).toBe(false);
    expect(
      serverChangeSchema.safeParse({ ...validUpsert, entity: "layer" }).success,
    ).toBe(false);
    expect(
      serverChangeSchema.safeParse({ ...validUpsert, entityId: other }).success,
    ).toBe(false);
    expect(
      syncConflictSchema.safeParse({
        operationId: id,
        entity: "project",
        entityId: id,
        baseVersion: 1,
        serverVersion: 2,
        reason: "VERSION_CONFLICT",
        localPayload: {
          ...validUpsert.payload,
          data: { ...validUpsert.payload.data, id: other },
        },
      }).success,
    ).toBe(false);
    expect(
      syncConflictSchema.safeParse({
        operationId: id,
        entity: "project",
        entityId: id,
        baseVersion: 1,
        serverVersion: 2,
        reason: "VERSION_CONFLICT",
        serverPayload: { ...validUpsert.payload, entity: "layer" },
      }).success,
    ).toBe(false);
  });

  it("bounds PDF references and map extents", () => {
    const reference = {
      profile: "manual",
      sourceCrs: "EPSG:4326",
      pageIndex: 0,
      cropBox: [0, 0, 100, 100],
      rotation: 0,
      controls: [],
      neatline: [
        [0, 0],
        [100, 0],
        [100, 100],
      ],
      transform: { model: "affine", coefficients: [1, 0, 0, 0, 1, 0] },
      residual: { rmseMeters: null, maxMeters: null, independentCheck: false },
    };
    expect(geoReferenceSchema.safeParse(reference).success).toBe(true);
    const manifest = {
      id: "region-1",
      version: "1",
      label: "Region",
      bounds: [-10, -10, 10, 10],
      minZoom: 4,
      maxZoom: 12,
      archive: archiveBlob,
      style: { path: "style.json", blob: styleBlob },
      glyphs: [],
      sprites: [],
      attribution: "Source",
      createdAt: date,
      packageVersion: "1.0.0",
      osmDataDate: date,
      capabilities: [],
      checksums: { archive: "a".repeat(64) },
      totalBytes: archiveBlob.bytes,
      sources: { osm: "OpenStreetMap", attributions: [] },
      minimumCompatibleVersion: "1.0.0",
    };
    expect(offlineMapPackageManifestSchema.safeParse(manifest).success).toBe(
      true,
    );
    expect(
      offlineMapPackageManifestSchema.safeParse({
        ...manifest,
        sprites: [
          {
            path: "sprites/light@2x.png",
            blob: { ...styleBlob, mediaType: "image/png" },
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      offlineMapPackageManifestSchema.safeParse({
        ...manifest,
        archive: { ...archiveBlob, bytes: 250 * 1024 * 1024 - styleBlob.bytes },
      }).success,
    ).toBe(true);
    expect(
      offlineMapPackageManifestSchema.safeParse({
        ...manifest,
        archive: { ...archiveBlob, bytes: 250 * 1024 * 1024 },
      }).success,
    ).toBe(false);
    expect(
      offlineMapPackageManifestSchema.safeParse({
        ...manifest,
        bounds: [-181, -10, 10, 10],
      }).success,
    ).toBe(false);
    expect(
      offlineMapPackageManifestSchema.safeParse({
        ...manifest,
        style: { path: "https://evil/style.json", blob: styleBlob },
      }).success,
    ).toBe(false);
    expect(
      offlineMapPackageManifestSchema.safeParse({
        ...manifest,
        style: { path: "../style.json", blob: styleBlob },
      }).success,
    ).toBe(false);
    expect(
      offlineMapPackageManifestSchema.safeParse({
        ...manifest,
        style: {
          path: "fonts\\font.pbf",
          blob: { ...styleBlob, mediaType: "application/x-protobuf" },
        },
      }).success,
    ).toBe(false);
    expect(
      offlineMapPackageManifestSchema.safeParse({
        ...manifest,
        archive: { ...archiveBlob, mediaType: "application/pdf" },
      }).success,
    ).toBe(false);
  });

  it("uses the canonical map projection and rejects unknown payload fields", () => {
    const map = {
      id,
      projectId: other,
      name: "Map",
      description: null,
      defaultCenterLng: "-47.9",
      defaultCenterLat: "-15.8",
      defaultZoom: "10.00",
      createdAt: date,
      updatedAt: date,
    };
    expect(mapSchema.safeParse(map).success).toBe(true);
    expect(mapSchema.safeParse({ ...map, unexpected: true }).success).toBe(
      false,
    );
    const payload = {
      entity: "project",
      data: {
        id,
        name: "P",
        status: "active",
        createdAt: date,
        updatedAt: date,
        unexpected: true,
      },
    };
    expect(
      syncOperationSchema.safeParse({
        operationId: id,
        workspaceId: other,
        entity: "project",
        entityId: id,
        operation: "upsert",
        payload,
        baseVersion: null,
        createdAt: date,
      }).success,
    ).toBe(false);
  });

  it("does not disclose a server payload on scope rejection", () => {
    const payload = {
      entity: "project",
      data: {
        id,
        name: "P",
        status: "active",
        createdAt: date,
        updatedAt: date,
      },
    };
    const conflict = {
      operationId: id,
      entity: "project",
      entityId: id,
      baseVersion: null,
      serverVersion: 1,
      reason: "SCOPE_REJECTED",
      serverPayload: payload,
    };
    expect(syncConflictSchema.safeParse(conflict).success).toBe(false);
    const genericScopeConflict = Object.fromEntries(
      Object.entries(conflict).filter(([key]) => key !== "serverPayload"),
    );
    expect(
      syncConflictSchema.safeParse({
        ...genericScopeConflict,
        serverVersion: 0,
      }).success,
    ).toBe(true);
    expect(
      syncConflictSchema.safeParse({ ...conflict, serverPayload: undefined })
        .success,
    ).toBe(false);
  });

  it("caps geometry positions at the exact boundary", () => {
    const coordinates = Array.from(
      { length: 10_000 },
      (_, index) => [index % 180, index % 90] as [number, number],
    );
    expect(
      geometrySchema.safeParse({ type: "LineString", coordinates }).success,
    ).toBe(true);
    expect(
      geometrySchema.safeParse({
        type: "LineString",
        coordinates: [...coordinates, [0, 0]],
      }).success,
    ).toBe(false);
  });

  it("accepts canonical layer upserts and rejects unknown layer fields", () => {
    const layer = {
      id,
      projectId: other,
      name: "Parcels",
      description: null,
      kind: "polygon",
      geometryType: "Polygon",
      srid: 4674,
      style: {},
      metadata: {},
      visibleByDefault: true,
      sortOrder: 0,
      createdAt: date,
      updatedAt: date,
    };
    const operation = {
      operationId: other,
      workspaceId: id,
      entity: "layer",
      entityId: id,
      operation: "upsert",
      payload: { entity: "layer", data: layer },
      baseVersion: null,
      createdAt: date,
    };
    expect(syncOperationSchema.safeParse(operation).success).toBe(true);
    expect(
      syncOperationSchema.safeParse({
        ...operation,
        payload: { ...operation.payload, data: { ...layer, unknown: true } },
      }).success,
    ).toBe(false);
    expect(
      syncOperationSchema.safeParse({
        ...operation,
        payload: {
          ...operation.payload,
          data: { ...layer, kind: "raster", geometryType: "Polygon" },
        },
      }).success,
    ).toBe(false);
  });
});
