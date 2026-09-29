export { closeDb, createDb, getDb } from './client.js';
export type { Db, DbHandle } from './client.js';
export { InvalidCursorError, InvalidGeometryError, VersionConflictError } from './errors.js';
export * from './queries/index.js';
export * from './schema/index.js';

import * as schema from './schema/index.js';

/** Drizzle schema - table objects for typed reads and future migrations. */
export { schema };
