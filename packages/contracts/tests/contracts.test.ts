import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  GeometryTypeMismatchError,
  assertGeometryCompatible,
  bboxSchema,
  buildErrorResponse,
  buildPage,
  createFeatureSchema,
  createProjectSchema,
  errorResponseSchema,
  featureSchema,
  geometryKindOf,
  geometrySchema,
  httpStatusByErrorCode,
  isGeometryCompatibleWith,
  layerSchema,
  linearRingSchema,
  listFeaturesQuerySchema,
  paginationQuerySchema,
  paginationSchema,
  positionSchema,
  projectSchema,
  updateFeatureSchema,
  uuidSchema,
} from '../src/index.js';
import type { Position } from '../src/index.js';

const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const isoDate = '2026-01-01T00:00:00.000Z';

const polygonCoordinates: Position[][] = [
  [
    [-45.0, -15.0],
    [-44.0, -15.0],
    [-44.0, -14.0],
    [-45.0, -15.0],
  ],
];

const polygon = { type: 'Polygon' as const, coordinates: polygonCoordinates };

describe('uuidSchema', () => {
  it('accepts a UUID', () => {
    expect(uuidSchema.safeParse(uuid).success).toBe(true);
  });

  it('rejects a non-UUID', () => {
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
  });
});

describe('projectSchema', () => {
  const valid = { id: uuid, name: 'Survey', createdAt: isoDate, updatedAt: isoDate };

  it('accepts a minimal project', () => {
    expect(projectSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(projectSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });

  it('rejects a non-ISO-UTC timestamp', () => {
    expect(projectSchema.safeParse({ ...valid, createdAt: '2026-01-01 00:00:00' }).success).toBe(false);
  });

  it('requires a name on create', () => {
    expect(createProjectSchema.safeParse({ name: 'Survey' }).success).toBe(true);
    expect(createProjectSchema.safeParse({}).success).toBe(false);
  });
});

describe('positionSchema', () => {
  it('accepts a 2D position', () => {
    expect(positionSchema.safeParse([-45, -15]).success).toBe(true);
  });

  it('accepts a 3D position', () => {
    expect(positionSchema.safeParse([-45, -15, 800]).success).toBe(true);
  });

  it('rejects a position with more than 3 values', () => {
    expect(positionSchema.safeParse([1, 2, 3, 4]).success).toBe(false);
  });

  it('rejects a non-finite coordinate', () => {
    expect(positionSchema.safeParse(['a', 'b']).success).toBe(false);
  });
});

describe('geometrySchema', () => {
  it('accepts a valid closed polygon', () => {
    expect(geometrySchema.safeParse(polygon).success).toBe(true);
  });

  it('accepts a MultiPolygon', () => {
    expect(geometrySchema.safeParse({ type: 'MultiPolygon', coordinates: [polygonCoordinates] }).success).toBe(true);
  });

  it('rejects an unknown geometry type', () => {
    expect(geometrySchema.safeParse({ type: 'Circle', coordinates: [0, 0] }).success).toBe(false);
  });

  it('rejects a ring with fewer than 4 positions', () => {
    expect(linearRingSchema.safeParse([[0, 0], [1, 1]]).success).toBe(false);
  });

  it('rejects an unclosed ring', () => {
    expect(
      linearRingSchema.safeParse([[0, 0], [1, 0], [1, 1], [0, 1]]).success,
    ).toBe(false);
  });

  it('rejects a LineString with a single position', () => {
    expect(geometrySchema.safeParse({ type: 'LineString', coordinates: [[0, 0]] }).success).toBe(false);
  });

  it('maps Multi* geometries to their kind', () => {
    expect(geometryKindOf({ type: 'MultiPolygon', coordinates: [polygonCoordinates] })).toBe('polygon');
    expect(geometryKindOf({ type: 'Point', coordinates: [-45, -15] })).toBe('point');
  });
});

describe('geometry compatibility with a layer', () => {
  it('rejects a polygon on a point layer', () => {
    expect(isGeometryCompatibleWith(polygon, 'Point')).toBe(false);
  });

  it('accepts a matching type', () => {
    expect(isGeometryCompatibleWith(polygon, 'Polygon')).toBe(true);
  });

  it('accepts anything when the layer declares no geometryType', () => {
    expect(isGeometryCompatibleWith(polygon, null)).toBe(true);
  });

  it('throws GeometryTypeMismatchError on mismatch', () => {
    expect(() => assertGeometryCompatible(polygon, 'Point')).toThrow(GeometryTypeMismatchError);
  });
});

describe('layerSchema', () => {
  const valid = {
    id: uuid,
    projectId: uuid,
    name: 'Parcels',
    description: null,
    kind: 'polygon',
    geometryType: 'Polygon',
    createdAt: isoDate,
    updatedAt: isoDate,
  };

  it('accepts a layer', () => {
    expect(layerSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an unsupported geometry type', () => {
    expect(layerSchema.safeParse({ ...valid, geometryType: 'Raster' }).success).toBe(false);
  });
});

describe('bbox query', () => {
  it('parses minLng,minLat,maxLng,maxLat', () => {
    const result = bboxSchema.safeParse('-45,-15,-44,-14');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ minLng: -45, minLat: -15, maxLng: -44, maxLat: -14 });
    }
  });

  it('rejects a bbox with the wrong number of values', () => {
    expect(bboxSchema.safeParse('-45,-15,-44').success).toBe(false);
  });

  it('rejects a non-numeric bbox', () => {
    expect(bboxSchema.safeParse('a,b,c,d').success).toBe(false);
  });

  it('rejects an inverted bbox', () => {
    expect(bboxSchema.safeParse('-44,-14,-45,-15').success).toBe(false);
  });

  it('composes with the features list query', () => {
    expect(listFeaturesQuerySchema.safeParse({ bbox: '-45,-15,-44,-14' }).success).toBe(true);
  });
});

describe('featureSchema', () => {
  const valid = {
    id: uuid,
    layerId: uuid,
    geometry: polygon,
    properties: { name: 'Parcel A' },
    version: 1,
    createdAt: isoDate,
    updatedAt: isoDate,
  };

  it('accepts a feature', () => {
    expect(featureSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a non-integer version', () => {
    expect(featureSchema.safeParse({ ...valid, version: 1.5 }).success).toBe(false);
  });

  it('requires a layerId on create', () => {
    expect(createFeatureSchema.safeParse({ layerId: uuid, geometry: polygon }).success).toBe(true);
    expect(createFeatureSchema.safeParse({ geometry: polygon }).success).toBe(false);
  });

  it('defaults properties to an empty object on create', () => {
    const result = createFeatureSchema.safeParse({ layerId: uuid, geometry: polygon });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.properties).toEqual({});
    }
  });

  it('requires an expected version on update', () => {
    expect(updateFeatureSchema.safeParse({ id: uuid, geometry: polygon }).success).toBe(false);
    expect(updateFeatureSchema.safeParse({ id: uuid, version: 2, properties: { a: 1 } }).success).toBe(true);
  });

  it('rejects a non-positive version on update', () => {
    expect(updateFeatureSchema.safeParse({ id: uuid, version: 0, properties: { a: 1 } }).success).toBe(false);
  });

  it('requires geometry or properties on update', () => {
    expect(updateFeatureSchema.safeParse({ id: uuid, version: 2 }).success).toBe(false);
  });
});

describe('pagination', () => {
  it('applies the default limit', () => {
    const result = paginationQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(DEFAULT_PAGE_LIMIT);
    }
  });

  it('rejects a limit above the cap', () => {
    expect(paginationQuerySchema.safeParse({ limit: String(MAX_PAGE_LIMIT + 1) }).success).toBe(false);
  });

  it('accepts the documented envelope with a null cursor', () => {
    expect(paginationSchema.safeParse({ items: [], nextCursor: null }).success).toBe(true);
  });

  it('rejects an envelope missing nextCursor', () => {
    expect(paginationSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it('returns a null cursor when the page is not full', () => {
    expect(buildPage([{ id: 'a' }], 2, (row) => row.id)).toEqual({
      items: [{ id: 'a' }],
      nextCursor: null,
    });
  });

  it('emits a cursor from the extra row and drops it', () => {
    const page = buildPage([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 2, (row) => row.id);
    expect(page.items).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(page.nextCursor).toBe('b');
  });
});

describe('error envelope', () => {
  it('validates the documented shape', () => {
    const result = errorResponseSchema.safeParse({
      error: { code: 'VERSION_CONFLICT', message: 'concurrent modification', requestId: uuid },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown code', () => {
    expect(
      errorResponseSchema.safeParse({ error: { code: 'NOPE', message: 'x', requestId: uuid } }).success,
    ).toBe(false);
  });

  it('builds the envelope from code, message and requestId', () => {
    expect(buildErrorResponse('FEATURE_NOT_FOUND', 'gone', uuid)).toEqual({
      error: { code: 'FEATURE_NOT_FOUND', message: 'gone', requestId: uuid },
    });
  });

  it('maps VERSION_CONFLICT to 409 and not-found codes to 404', () => {
    expect(httpStatusByErrorCode.VERSION_CONFLICT).toBe(409);
    expect(httpStatusByErrorCode.PROJECT_NOT_FOUND).toBe(404);
    expect(httpStatusByErrorCode.LAYER_NOT_FOUND).toBe(404);
    expect(httpStatusByErrorCode.FEATURE_NOT_FOUND).toBe(404);
    expect(httpStatusByErrorCode.INTERNAL_ERROR).toBe(500);
  });
});
