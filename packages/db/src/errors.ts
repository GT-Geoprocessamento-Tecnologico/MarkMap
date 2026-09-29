/**
 * Stable failure classes raised by the persistence layer. Each carries a
 * `code` from `@geonexo/contracts` so `services/api` can map it to the
 * documented HTTP envelope without string matching (50-CONTRATOS-DE-INTEGRACAO.md:108).
 *
 * Not-found cases are NOT classes: read/update helpers return `null` and the
 * API decides which *NOT_FOUND code applies (project vs layer vs feature).
 */

/** Optimistic concurrency: stored row moved past the expected version (PRD:301-305). */
export class VersionConflictError extends Error {
  readonly code = 'VERSION_CONFLICT' as const;

  constructor(
    readonly expectedVersion: number,
    readonly currentVersion: number,
  ) {
    super(`Version conflict: expected ${expectedVersion}, current is ${currentVersion}`);
    this.name = 'VersionConflictError';
  }
}

/** Geometry is empty, self-intersecting or not parseable by PostGIS. */
export class InvalidGeometryError extends Error {
  readonly code = 'INVALID_GEOMETRY' as const;

  constructor(message = 'Geometry is empty or invalid') {
    super(message);
    this.name = 'InvalidGeometryError';
  }
}

/** Cursor failed to decode — callers map it to VALIDATION_ERROR (HTTP 400). */
export class InvalidCursorError extends Error {
  readonly code = 'VALIDATION_ERROR' as const;

  constructor(message = 'Invalid pagination cursor') {
    super(message);
    this.name = 'InvalidCursorError';
  }
}
