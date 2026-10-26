import { createHash, createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createSyncCursor, readSyncCursor } from "../src/lib/sync-cursor.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const capabilityHash = createHash("sha256")
  .update("capability-a")
  .digest("hex");

const signPayload = (payload: string, capHash: string): string =>
  createHmac("sha256", Buffer.from(capHash, "hex"))
    .update(payload)
    .digest("base64url");

describe("workspace-bound sync cursor", () => {
  it("round-trips sequence for the same workspace and capability", () => {
    const cursor = createSyncCursor(workspaceId, "42", capabilityHash);
    expect(readSyncCursor(cursor, workspaceId, capabilityHash)).toEqual({
      workspaceId,
      sequence: "42",
    });
  });

  it("rejects another workspace", () => {
    const cursor = createSyncCursor(workspaceId, "1", capabilityHash);
    expect(() =>
      readSyncCursor(
        cursor,
        "22222222-2222-4222-8222-222222222222",
        capabilityHash,
      ),
    ).toThrow("Invalid sync cursor");
  });

  it("rejects a rotated capability", () => {
    const cursor = createSyncCursor(workspaceId, "1", capabilityHash);
    const rotated = createHash("sha256").update("capability-b").digest("hex");
    expect(() => readSyncCursor(cursor, workspaceId, rotated)).toThrow(
      "Invalid sync cursor",
    );
  });

  it("rejects invalid JSON payload", () => {
    const invalidJsonPayload = Buffer.from("{invalid-json", "utf8").toString(
      "base64url",
    );
    const cursor = `v1.${invalidJsonPayload}.${signPayload(
      invalidJsonPayload,
      capabilityHash,
    )}`;
    expect(() => readSyncCursor(cursor, workspaceId, capabilityHash)).toThrow(
      "Invalid sync cursor",
    );
  });

  it("rejects non-object or malformed decoded payload structure", () => {
    const testCases = [
      "just-a-string",
      12345,
      null,
      { workspaceId },
      { sequence: "1" },
      { workspaceId, sequence: "-1" },
      { workspaceId, sequence: "123a" },
    ];

    for (const testCase of testCases) {
      const payload = Buffer.from(JSON.stringify(testCase), "utf8").toString(
        "base64url",
      );
      const cursor = `v1.${payload}.${signPayload(payload, capabilityHash)}`;
      expect(() => readSyncCursor(cursor, workspaceId, capabilityHash)).toThrow(
        "Invalid sync cursor",
      );
    }
  });

  it("rejects malformed token schema or signature", () => {
    const invalidTokens = [
      "invalid-token",
      `v1..${signPayload("test", capabilityHash)}`,
      `v1.${Buffer.from("{}", "utf8").toString("base64url")}.short-sig`,
    ];

    for (const token of invalidTokens) {
      expect(() => readSyncCursor(token, workspaceId, capabilityHash)).toThrow(
        "Invalid sync cursor",
      );
    }
  });
});
