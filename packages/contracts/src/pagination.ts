import { z } from 'zod';

export const DEFAULT_PAGE_LIMIT = 100;
export const MAX_PAGE_LIMIT = 1000;

export const paginationCursorSchema = z.string().min(1).optional();

export const paginationQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .min(1, 'limit must be at least 1')
    .max(MAX_PAGE_LIMIT, `limit must be at most ${MAX_PAGE_LIMIT}`)
    .default(DEFAULT_PAGE_LIMIT),
  cursor: z.string().min(1).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * The documented envelope (50-CONTRATOS-DE-INTEGRACAO.md:115-120): `nextCursor`
 * is always present and nullable, so clients page without shape checks.
 */
export const paginationSchema = z.object({
  items: z.array(z.unknown()),
  nextCursor: z.string().nullable(),
});

export type Pagination<T> = {
  items: T[];
  nextCursor: string | null;
};

/**
 * Builds a page from `limit + 1` rows. The extra row proves another page exists
 * without a second count query.
 */
export const buildPage = <T>(
  rows: readonly T[],
  limit: number,
  toCursor: (row: T) => string,
): Pagination<T> => {
  if (rows.length > limit) {
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return { items: [...page], nextCursor: last === undefined ? null : toCursor(last) };
  }
  return { items: [...rows], nextCursor: null };
};
