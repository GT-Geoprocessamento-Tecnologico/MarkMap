// ## Errors contract
// The API messages follow a single contract as defined in the PRD.

import { z } from "zod";

export const ErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().uuid(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorSchema>;
