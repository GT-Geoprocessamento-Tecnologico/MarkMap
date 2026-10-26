import { createHash, createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createSyncCursor, readSyncCursor } from "../src/lib/sync-cursor.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const capabilityHash = createHash("sha256")
  .update("capability-a")
  .digest("hex");

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

  it("rejects non-JSON payload even with valid signature", () => {
    const payload = Buffer.from("not-valid-json", "utf8").toString("base64url");
    const signature = createHmac("sha256", Buffer.from(capabilityHash, "hex"))
      .update(payload)
      .digest("base64url");
    const token = `v1.${payload}.${signature}`;

    expect(() => readSyncCursor(token, workspaceId, capabilityHash)).toThrow(
      "Invalid sync cursor",
    );
  });

  it("rejects invalid token schema format", () => {
    expect(() =>
      readSyncCursor("invalid-token-format", workspaceId, capabilityHash),
    ).toThrow("Invalid sync cursor");
  });

  it("rejects payload with invalid content structure", () => {
    const payload = Buffer.from(
      JSON.stringify({ workspaceId, sequence: "not-a-number" }),
      "utf8",
    ).toString("base64url");
    const signature = createHmac("sha256", Buffer.from(capabilityHash, "hex"))
      .update(payload)
      .digest("base64url");
    const token = `v1.${payload}.${signature}`;

    expect(() => readSyncCursor(token, workspaceId, capabilityHash)).toThrow(
      "Invalid sync cursor",
    );
  });
});
