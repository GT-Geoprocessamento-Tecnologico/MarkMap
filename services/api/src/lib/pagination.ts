import { ValidationError, type ValidationIssue } from './errors.js';

import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, paginationQuerySchema } from '@geonexo/contracts';
import type { Pagination } from '@geonexo/contracts';

/**
 * Cursors are opaque to the client: it only ever passes back what we handed it.
 * Keyset pagination on (createdAt, id) keeps pages stable while rows are
 * inserted, which offset pagination cannot do.
 */
const cursorPayloadSchema = z.object({
  t: z.string().min(1),
  i: z.string().min(1),
});

export type Cursor = z.infer<typeof cursorPayloadSchema>;

const encodeBase64Url = (value: string): string =>
  Buffer.from(value, 'utf8').toString('base64url');

const decodeBase64Url = (value: string): string => Buffer.from(value, 'base64url').toString('utf8');

export const encodeCursor = (cursor: Cursor): string =>
  encodeBase64Url(JSON.stringify(cursor));

/** Returns null for an absent cursor and throws InvalidCursorError on a malformed one. */
export const decodeCursor = (raw: string | null | undefined): Cursor | null => {
  if (raw === null || raw === undefined || raw.length === 0) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(decodeBase64Url(raw));
  } catch {
    throw new InvalidCursorError(raw);
  }
  const parsed = cursorPayloadSchema.safeParse(decoded);
  if (!parsed.success) throw new InvalidCursorError(raw);
  return parsed.data;
};

/**
 * A cursor comes from the client, so a malformed one is a validation failure
 * (400), not an unexpected error. It extends ValidationError so the error
 * boundary maps it automatically.
 */
export class InvalidCursorError extends ValidationError {
  constructor(details?: FieldIssue[]) {
    super('The pagination cursor is not valid', details ?? [{ path: 'cursor', message: 'invalid cursor' }]);
    this.name = 'InvalidCursorError';
  }
}

export type PaginationParams = {
  limit: number;
  cursor: Cursor | null;
};

export const parsePaginationParams = (query: unknown): PaginationParams => {
  const parsed = paginationQuerySchema.parse(query);
  return { limit: parsed.limit, cursor: decodeCursor(parsed.cursor) };
};

/**
 * Turns `limit + 1` rows into a page. The extra row is the existence proof for
 * the next page, which avoids a second COUNT query per list endpoint.
 */
export const toPage = <T extends { createdAt: string; id: string }>(
  rows: readonly T[],
  limit: number,
): Pagination<T> => {
  if (rows.length > limit) {
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: [...page],
      nextCursor: last === undefined ? null : encodeCursor({ t: last.createdAt, i: last.id }),
    };
  }
  return { items: [...rows], nextCursor: null };
};

export { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT };
export { paginationQuerySchema };
