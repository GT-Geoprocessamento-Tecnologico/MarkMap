import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@geonexo/contracts";
import { describe, expect, it } from "vitest";

import {
  InvalidCursorError,
  InvalidGeometryError,
  VersionConflictError,
} from "../../src/index.js";
import {
  decodeCursor,
  encodeCursor,
  resolveLimit,
} from "../../src/pagination.js";

const UUID = "9f1d3b2e-5c4a-4f8b-9a7d-1e2f3a4b5c6d";
const AT = new Date("2026-01-02T03:04:05.678Z");

describe("cursor codec", () => {
  it("round-trips created_at + id through base64url", () => {
    const decoded = decodeCursor(encodeCursor({ createdAt: AT, id: UUID }));
    expect(decoded.createdAt.toISOString()).toBe(AT.toISOString());
    expect(decoded.id).toBe(UUID);
  });

  it("never emits URL-unsafe characters", () => {
    const cursor = encodeCursor({ createdAt: AT, id: UUID });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ["plain garbage", "not-a-cursor"],
    ["empty string", ""],
    ["base64 without separator", Buffer.from(UUID).toString("base64url")],
    [
      "non-uuid id",
      Buffer.from(`${AT.toISOString()}|nope`).toString("base64url"),
    ],
    ["invalid date", Buffer.from(`yesterday|${UUID}`).toString("base64url")],
    [
      "extra segment",
      Buffer.from(`${AT.toISOString()}|${UUID}|extra`).toString("base64url"),
    ],
  ])("rejects %s with InvalidCursorError", (_label, cursor) => {
    expect(() => decodeCursor(cursor)).toThrow(InvalidCursorError);
  });

  it("carries the contract error code (VALIDATION_ERROR)", () => {
    expect(new InvalidCursorError().code).toBe("VALIDATION_ERROR");
  });
});

describe("resolveLimit", () => {
  it("defaults to the contract default", () => {
    expect(resolveLimit()).toBe(DEFAULT_PAGE_LIMIT);
  });

  it("clamps below minimum and above maximum", () => {
    expect(resolveLimit(0)).toBe(1);
    expect(resolveLimit(-10)).toBe(1);
    expect(resolveLimit(MAX_PAGE_LIMIT + 1)).toBe(MAX_PAGE_LIMIT);
    expect(resolveLimit(250)).toBe(250);
  });
});

describe("error codes", () => {
  it("maps stable contract codes without string matching", () => {
    expect(new VersionConflictError(1, 2).code).toBe("VERSION_CONFLICT");
    expect(new InvalidGeometryError().code).toBe("INVALID_GEOMETRY");
    expect(new InvalidCursorError().code).toBe("VALIDATION_ERROR");
  });

  it("exposes both versions on a conflict", () => {
    const error = new VersionConflictError(3, 5);
    expect(error.expectedVersion).toBe(3);
    expect(error.currentVersion).toBe(5);
    expect(error.name).toBe("VersionConflictError");
  });
});
