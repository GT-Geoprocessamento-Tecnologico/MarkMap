/**
 * Stable failure classes raised by the persistence layer. Each carries a
 * `code` from `@markmap/contracts` so `services/api` can map it to the
 * documented HTTP envelope without string matching (50-CONTRATOS-DE-INTEGRACAO.md:108).
 *
 * Read/update helpers still return `null` for absent records; create operations
 * throw typed parent errors so the API can preserve the documented code.
 */

/** Optimistic concurrency: stored row moved past the expected version (PRD:301-305). */
export class VersionConflictError extends Error {
  readonly code = "VERSION_CONFLICT" as const;

  constructor(
    readonly expectedVersion: number,
    readonly currentVersion: number,
  ) {
    super(
      `Version conflict: expected ${expectedVersion}, current is ${currentVersion}`,
    );
    this.name = "VersionConflictError";
  }
}

/** A layer creation request referenced no live project. */
export class ProjectNotFoundError extends Error {
  readonly code = "PROJECT_NOT_FOUND" as const;

  constructor(readonly projectId: string) {
    super(`Project with id ${projectId} not found`);
    this.name = "ProjectNotFoundError";
  }
}

/** A feature creation request referenced no live layer. */
export class LayerNotFoundError extends Error {
  readonly code = "LAYER_NOT_FOUND" as const;

  constructor(readonly layerId: string) {
    super(`Layer with id ${layerId} not found`);
    this.name = "LayerNotFoundError";
  }
}

/** Geometry is empty, self-intersecting or not parseable by PostGIS. */
export class InvalidGeometryError extends Error {
  readonly code = "INVALID_GEOMETRY" as const;

  constructor(message = "Geometry is empty or invalid") {
    super(message);
    this.name = "InvalidGeometryError";
  }
}

/** Cursor failed to decode — callers map it to VALIDATION_ERROR (HTTP 400). */
export class InvalidCursorError extends Error {
  readonly code = "VALIDATION_ERROR" as const;

  constructor(message = "Invalid pagination cursor") {
    super(message);
    this.name = "InvalidCursorError";
  }
}
