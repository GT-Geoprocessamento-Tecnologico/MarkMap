import { describe, expect, it } from 'vitest';

import {
  createImportSchema,
  importFormatSchema,
  importSchema,
  importStatusSchema,
} from '../src/import.js';

const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const otherUuid = '9c858901-8a57-4791-81fe-4c455b099bc9';
const isoDate = '2026-01-01T00:00:00.000Z';

const validRecord = {
  id: uuid,
  projectId: otherUuid,
  targetLayerId: uuid,
  originalName: 'parcelas.geojson',
  format: 'geojson',
  status: 'queued',
  rowCount: 120,
  errorCode: null,
  errorMessage: null,
  createdAt: isoDate,
  completedAt: null,
};

const validCreate = {
  projectId: uuid,
  targetLayerId: null,
  originalName: 'parcelas.geojson',
  format: 'geojson',
  contentBase64: 'eyJ0eXBlIjoiRmVhdHVyZUNvbGxlY3Rpb24ifQ==',
};

describe('importStatusSchema', () => {
  it('accepts queued', () => {
    expect(importStatusSchema.safeParse('queued').success).toBe(true);
  });

  it('rejects pending', () => {
    expect(importStatusSchema.safeParse('pending').success).toBe(false);
  });

  it('accepts the rest of the lifecycle', () => {
    for (const status of ['processing', 'completed', 'failed'] as const) {
      expect(importStatusSchema.safeParse(status).success).toBe(true);
    }
  });
});

describe('importFormatSchema', () => {
  it('accepts the formats the first stage supports', () => {
    for (const format of ['geojson', 'kml', 'shapefile'] as const) {
      expect(importFormatSchema.safeParse(format).success).toBe(true);
    }
  });

  it('rejects a format that is not in the first stage', () => {
    expect(importFormatSchema.safeParse('gpkg').success).toBe(false);
  });
});

describe('importSchema', () => {
  it('round-trips a full record', () => {
    const result = importSchema.safeParse(validRecord);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validRecord);
    }
  });

  it('accepts a failed record carrying a stable error code', () => {
    const result = importSchema.safeParse({
      ...validRecord,
      status: 'failed',
      rowCount: null,
      errorCode: 'IMPORT_UNSUPPORTED_FORMAT',
      errorMessage: 'detected format is not supported',
      completedAt: isoDate,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a negative rowCount', () => {
    expect(importSchema.safeParse({ ...validRecord, rowCount: -1 }).success).toBe(false);
  });

  it('rejects a fractional rowCount', () => {
    expect(importSchema.safeParse({ ...validRecord, rowCount: 1.5 }).success).toBe(false);
  });

  it('rejects an unknown format', () => {
    expect(importSchema.safeParse({ ...validRecord, format: 'geopackage' }).success).toBe(false);
  });

  it('rejects an errorCode that is not in errorCodeSchema', () => {
    expect(importSchema.safeParse({ ...validRecord, errorCode: 'IMPORT_EXPLODED' }).success).toBe(
      false,
    );
  });

  it('allows a null targetLayerId', () => {
    expect(importSchema.safeParse({ ...validRecord, targetLayerId: null }).success).toBe(true);
  });
});

describe('createImportSchema', () => {
  it('accepts an upload request', () => {
    const result = createImportSchema.safeParse(validCreate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentBase64).toBe(validCreate.contentBase64);
    }
  });

  it('trims originalName', () => {
    const result = createImportSchema.safeParse({ ...validCreate, originalName: '  a.kml  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.originalName).toBe('a.kml');
    }
  });

  it('requires contentBase64', () => {
    const { contentBase64: _omitted, ...withoutContent } = validCreate;
    expect(createImportSchema.safeParse(withoutContent).success).toBe(false);
  });

  it('rejects an empty contentBase64', () => {
    expect(createImportSchema.safeParse({ ...validCreate, contentBase64: '' }).success).toBe(false);
  });

  it('requires a non-empty originalName', () => {
    expect(createImportSchema.safeParse({ ...validCreate, originalName: '' }).success).toBe(false);
    expect(createImportSchema.safeParse({ ...validCreate, originalName: '   ' }).success).toBe(
      false,
    );
  });

  it('rejects an originalName longer than 255 characters', () => {
    expect(createImportSchema.safeParse({ ...validCreate, originalName: 'a'.repeat(256) }).success).toBe(
      false,
    );
  });

  it('accepts a null targetLayerId', () => {
    const result = createImportSchema.safeParse({ ...validCreate, targetLayerId: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetLayerId).toBeNull();
    }
  });

  it('omits targetLayerId when it is not provided', () => {
    const { targetLayerId: _omitted, ...withoutTarget } = validCreate;
    const result = createImportSchema.safeParse(withoutTarget);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetLayerId).toBeUndefined();
    }
  });
});
