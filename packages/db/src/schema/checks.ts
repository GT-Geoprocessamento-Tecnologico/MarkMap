import { sql, type SQL } from 'drizzle-orm';

/**
 * Builds `"column" IN ('a', 'b')` for CHECK constraints. Both the column name
 * and the literals are inlined with `sql.raw`, never bound as parameters:
 * drizzle-kit serializes params as `$1`, which is invalid inside DDL. All
 * inputs are fixed code constants (schema columns and enum-like arrays),
 * never user input.
 */
export const inList = (column: string, values: readonly string[]): SQL =>
  sql.raw(`"${column}" IN (${values.map((value) => `'${value}'`).join(', ')})`);
