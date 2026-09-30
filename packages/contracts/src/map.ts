import { z } from "zod";

import { timestampSchema, uuidSchema } from "./project.js";

const decimal = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/, "must be a decimal number");
const boundedDecimal = (min: number, max: number) =>
  decimal.refine((value) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max;
  }, "decimal is outside the supported range");

export const mapSchema = z
  .object({
    id: uuidSchema,
    projectId: uuidSchema,
    name: z.string().min(1).max(160),
    description: z.string().nullable(),
    defaultCenterLng: boundedDecimal(-180, 180).nullable(),
    defaultCenterLat: boundedDecimal(-90, 90).nullable(),
    defaultZoom: boundedDecimal(0, 24).nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export type Map = z.infer<typeof mapSchema>;
