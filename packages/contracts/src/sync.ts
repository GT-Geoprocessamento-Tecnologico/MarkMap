import { z } from "zod";

import { featureSchema } from "./feature.js";
import { geometryTypeSchema, layerKindSchema } from "./layer.js";
import { mapSchema } from "./map.js";
import { importMetadataSchema } from "./pdf.js";
import { projectSchema, timestampSchema, uuidSchema } from "./project.js";

export const syncEntitySchema = z.enum([
  "project",
  "map",
  "layer",
  "feature",
  "import",
]);
export type SyncEntity = z.infer<typeof syncEntitySchema>;

export const projectSyncDataSchema = projectSchema.strict();
const boundedJsonValueSchema: z.ZodType<
  | string
  | number
  | boolean
  | null
  | readonly unknown[]
  | { readonly [key: string]: unknown }
> = z.lazy(() =>
  z.union([
    z.string().max(4_096),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(boundedJsonValueSchema).max(100),
    z.record(boundedJsonValueSchema).superRefine((value, ctx) => {
      if (Object.keys(value).length > 100)
        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: 100,
          type: "array",
          inclusive: true,
          message: "object has too many keys",
        });
    }),
  ]),
);
const boundedJsonObjectSchema = z
  .record(boundedJsonValueSchema)
  .superRefine((value, ctx) => {
    if (Object.keys(value).length > 100)
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 100,
        type: "array",
        inclusive: true,
        message: "object has too many keys",
      });
    const visit = (entry: unknown, depth: number): void => {
      if (depth > 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "JSON values must not exceed depth 5",
        });
        return;
      }
      if (Array.isArray(entry))
        entry.forEach((child) => visit(child, depth + 1));
      else if (entry !== null && typeof entry === "object")
        Object.values(entry).forEach((child) => visit(child, depth + 1));
    };
    visit(value, 0);
  });
export const mapSyncDataSchema = mapSchema;
/** Strict wire projection of a layer; style/metadata remain bounded JSON. */
export const layerSyncDataSchema = z
  .object({
    id: uuidSchema,
    projectId: uuidSchema,
    name: z.string().min(1).max(160),
    description: z.string().nullable(),
    kind: layerKindSchema,
    geometryType: geometryTypeSchema.nullable(),
    srid: z.number().int().positive(),
    style: boundedJsonObjectSchema,
    metadata: boundedJsonObjectSchema,
    visibleByDefault: z.boolean(),
    sortOrder: z.number().int(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict()
  .refine(
    (layer) =>
      layer.geometryType === null ||
      ["point", "line", "polygon", "mixed"].includes(layer.kind),
    "geometryType is only allowed for feature-bearing layers",
  );
export const featureSyncDataSchema = featureSchema.strict();
export const syncEntityPayloadSchema = z.discriminatedUnion("entity", [
  z
    .object({ entity: z.literal("project"), data: projectSyncDataSchema })
    .strict(),
  z.object({ entity: z.literal("map"), data: mapSyncDataSchema }).strict(),
  z.object({ entity: z.literal("layer"), data: layerSyncDataSchema }).strict(),
  z
    .object({ entity: z.literal("feature"), data: featureSyncDataSchema })
    .strict(),
  z
    .object({ entity: z.literal("import"), data: importMetadataSchema })
    .strict(),
]);

const operationBase = {
  operationId: uuidSchema,
  workspaceId: uuidSchema,
  entity: syncEntitySchema,
  entityId: uuidSchema,
  baseVersion: z.number().int().min(0).nullable(),
  predecessorOperationId: uuidSchema.optional(),
  createdAt: timestampSchema,
};

const syncUpsert = z
  .object({
    ...operationBase,
    operation: z.literal("upsert"),
    payload: syncEntityPayloadSchema,
  })
  .strict();
const syncDelete = z
  .object({ ...operationBase, operation: z.literal("delete") })
  .strict();
const entityIdMatchesPayload = (
  operation: z.infer<typeof syncUpsert>,
  ctx: z.RefinementCtx,
) => {
  if (operation.entity !== operation.payload.entity)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["payload", "entity"],
      message: "payload entity must match operation",
    });
  const data = operation.payload.data as { id: string };
  if (data.id !== operation.entityId)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["entityId"],
      message: "entityId must match payload id",
    });
};
export const syncUpsertOperationSchema = syncUpsert.superRefine(
  entityIdMatchesPayload,
);
export const syncDeleteOperationSchema = syncDelete;
// The upsert carries a refinement across two discriminants (entity and payload
// entity), which Zod's discriminatedUnion cannot represent after refinement.
export const syncOperationSchema = z.union([
  syncUpsertOperationSchema,
  syncDeleteOperationSchema,
]);

const bigintDecimalSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/)
  .refine(
    (value) => BigInt(value) <= 9_223_372_036_854_775_807n,
    "sequence exceeds PostgreSQL bigint",
  );
/** Opaque v1.<base64url payload>.<base64url HMAC-SHA256> cursor token. */
export const syncCursorSchema = z
  .string()
  .min(20)
  .max(512)
  .regex(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
export const tombstoneSchema = z
  .object({
    entity: syncEntitySchema,
    entityId: uuidSchema,
    version: z.number().int().positive(),
    sequence: bigintDecimalSchema.refine(
      (value) => value !== "0",
      "sequence must be positive",
    ),
    deletedAt: timestampSchema,
  })
  .strict();
const conflictBase = z
  .object({
    operationId: uuidSchema,
    entity: syncEntitySchema,
    entityId: uuidSchema,
    baseVersion: z.number().int().min(0).nullable(),
    serverVersion: z.number().int().min(0),
    localPayload: syncEntityPayloadSchema.optional(),
    serverPayload: syncEntityPayloadSchema.optional(),
    reason: z.enum(["VERSION_CONFLICT", "SCOPE_REJECTED"]),
  })
  .strict();
export const syncConflictSchema = conflictBase.superRefine((conflict, ctx) => {
  if (conflict.reason === "SCOPE_REJECTED") {
    if (conflict.serverVersion !== 0)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["serverVersion"],
        message: "scope rejection uses zero serverVersion",
      });
    if (conflict.serverPayload !== undefined)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["serverPayload"],
        message: "scope rejection cannot disclose server payload",
      });
  } else if (conflict.serverVersion < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["serverVersion"],
      message: "version conflict requires a serverVersion",
    });
  }
  for (const [name, payload] of [
    ["localPayload", conflict.localPayload],
    ["serverPayload", conflict.serverPayload],
  ] as const) {
    if (
      payload &&
      (payload.entity !== conflict.entity ||
        payload.data.id !== conflict.entityId)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [name],
        message: "conflict payload must match entity and entityId",
      });
    }
  }
});
export const pushSyncAckSchema = z
  .object({
    operationId: uuidSchema,
    version: z.number().int().positive(),
    sequence: bigintDecimalSchema.refine(
      (value) => value !== "0",
      "sequence must be positive",
    ),
    predecessorOperationId: uuidSchema.optional(),
  })
  .strict();
export const pushSyncRequestSchema = z
  .object({ operations: z.array(syncOperationSchema).max(500) })
  .strict();
export const pushSyncResponseSchema = z
  .object({
    accepted: z.array(pushSyncAckSchema),
    conflicts: z.array(syncConflictSchema),
    alreadyApplied: z.array(pushSyncAckSchema),
  })
  .strict();
const serverUpsertChange = z
  .object({
    operationId: uuidSchema,
    entity: syncEntitySchema,
    entityId: uuidSchema,
    operation: z.literal("upsert"),
    payload: syncEntityPayloadSchema,
    version: z.number().int().positive(),
    sequence: bigintDecimalSchema.refine(
      (value) => value !== "0",
      "sequence must be positive",
    ),
  })
  .strict()
  .superRefine((change, ctx) => {
    if (
      change.payload.entity !== change.entity ||
      change.payload.data.id !== change.entityId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payload"],
        message: "server payload must match entity and entityId",
      });
    }
  });
const serverDeleteChange = z
  .object({
    operationId: uuidSchema,
    entity: syncEntitySchema,
    entityId: uuidSchema,
    operation: z.literal("delete"),
    version: z.number().int().positive(),
    sequence: bigintDecimalSchema.refine(
      (value) => value !== "0",
      "sequence must be positive",
    ),
  })
  .strict();
// Refinement is required for the outer entity/entityId invariant, so a regular
// union is used instead of Zod's discriminatedUnion (which rejects effects).
export const serverChangeSchema = z.union([
  serverUpsertChange,
  serverDeleteChange,
]);
export const pullSyncResponseSchema = z
  .object({
    changes: z.array(serverChangeSchema).max(500),
    tombstones: z.array(tombstoneSchema).max(500),
    nextCursor: syncCursorSchema,
    hasMore: z.boolean(),
  })
  .strict();

export type ProjectSyncData = z.infer<typeof projectSyncDataSchema>;
export type MapSyncData = z.infer<typeof mapSyncDataSchema>;
export type LayerSyncData = z.infer<typeof layerSyncDataSchema>;
export type FeatureSyncData = z.infer<typeof featureSyncDataSchema>;
export type SyncEntityPayload = z.infer<typeof syncEntityPayloadSchema>;
export type SyncOperation = z.infer<typeof syncOperationSchema>;
export type SyncCursor = z.infer<typeof syncCursorSchema>;
export type Tombstone = z.infer<typeof tombstoneSchema>;
export type SyncConflict = z.infer<typeof syncConflictSchema>;
export type PushSyncAck = z.infer<typeof pushSyncAckSchema>;
export type PushSyncRequest = z.infer<typeof pushSyncRequestSchema>;
export type PushSyncResponse = z.infer<typeof pushSyncResponseSchema>;
export type ServerChange = z.infer<typeof serverChangeSchema>;
export type PullSyncResponse = z.infer<typeof pullSyncResponseSchema>;
