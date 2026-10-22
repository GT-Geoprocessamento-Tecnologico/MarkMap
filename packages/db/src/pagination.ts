import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  uuidSchema,
} from "@markmap/contracts";

import { InvalidCursorError } from "./errors.js";

/**
 * Keyset cursor over `(created_at, id)` — stable, no OFFSET scans.
 * Opaque base64url on the wire (50-CONTRATOS-DE-INTEGRACAO.md:63).
 */
export type CursorKey = { createdAt: Date; id: string };

export const encodeCursor = ({ createdAt, id }: CursorKey): string =>
  Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");

export const decodeCursor = (cursor: string): CursorKey => {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const [iso, id, extra] = decoded.split("|");
  if (iso === undefined || id === undefined || extra !== undefined) {
    throw new InvalidCursorError();
  }
  const createdAt = new Date(iso);
  if (Number.isNaN(createdAt.getTime()) || !uuidSchema.safeParse(id).success) {
    throw new InvalidCursorError();
  }
  return { createdAt, id };
};

/** Trusts API validation but never allows an unbounded page (PRD:253-272). */
export const resolveLimit = (limit?: number): number =>
  Math.min(Math.max(limit ?? DEFAULT_PAGE_LIMIT, 1), MAX_PAGE_LIMIT);
