import { createHmac, timingSafeEqual } from "node:crypto";

import { syncCursorSchema } from "@markmap/contracts";

import { AppError, ErrorCode } from "./errors.js";

type CursorPayload = { workspaceId: string; sequence: string };

const sign = (payload: string, capabilityHash: string): string =>
  createHmac("sha256", Buffer.from(capabilityHash, "hex"))
    .update(payload)
    .digest("base64url");

export const createSyncCursor = (
  workspaceId: string,
  sequence: string,
  capabilityHash: string,
): string => {
  const payload = Buffer.from(
    JSON.stringify({ workspaceId, sequence } satisfies CursorPayload),
    "utf8",
  ).toString("base64url");
  return syncCursorSchema.parse(
    `v1.${payload}.${sign(payload, capabilityHash)}`,
  );
};

export const readSyncCursor = (
  token: string,
  expectedWorkspaceId: string,
  capabilityHash: string,
): CursorPayload => {
  const parsed = syncCursorSchema.safeParse(token);
  if (!parsed.success)
    throw new AppError("Invalid sync cursor", {
      status: 400,
      code: ErrorCode.VALIDATION_ERROR,
    });
  const [, payload, signature] = parsed.data.split(".");
  if (
    payload === undefined ||
    payload === "" ||
    signature === undefined ||
    signature === ""
  )
    throw new AppError("Invalid sync cursor", {
      status: 400,
      code: ErrorCode.VALIDATION_ERROR,
    });
  const expected = Buffer.from(sign(payload, capabilityHash));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new AppError("Invalid sync cursor", {
      status: 400,
      code: ErrorCode.VALIDATION_ERROR,
    });
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new AppError("Invalid sync cursor", {
      status: 400,
      code: ErrorCode.VALIDATION_ERROR,
    });
  }
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("workspaceId" in decoded) ||
    !("sequence" in decoded) ||
    typeof decoded.workspaceId !== "string" ||
    typeof decoded.sequence !== "string" ||
    decoded.workspaceId !== expectedWorkspaceId ||
    !/^(0|[1-9]\d*)$/.test(decoded.sequence)
  )
    throw new AppError("Invalid sync cursor", {
      status: 400,
      code: ErrorCode.VALIDATION_ERROR,
    });
  return { workspaceId: decoded.workspaceId, sequence: decoded.sequence };
};
