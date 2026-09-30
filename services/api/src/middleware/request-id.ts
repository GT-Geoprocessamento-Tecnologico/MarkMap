import { randomUUID } from "node:crypto";

import type { Context, Next } from "hono";
import { z } from "zod";

export const REQUEST_ID_HEADER = "x-request-id";
export const REQUEST_ID_KEY = "requestId";

const requestIdSchema = z.string().uuid();

type Variables = {
  requestId: string;
};

export const requestId =
  () => async (c: Context<{ Variables: Variables }>, next: Next) => {
    const inbound = c.req.header(REQUEST_ID_HEADER);
    // Only trust a client-supplied id when it is a well-formed UUID; otherwise
    // mint one so the error envelope always carries a valid requestId.
    const parsed = requestIdSchema.safeParse(inbound);
    const id = parsed.success ? parsed.data : randomUUID();
    c.set(REQUEST_ID_KEY, id);
    c.header(REQUEST_ID_HEADER, id);
    await next();
  };

export const getRequestId = (c: Context<{ Variables: Variables }>): string =>
  c.get(REQUEST_ID_KEY);
