import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_LIMIT,
  InvalidCursorError,
  decodeCursor,
  encodeCursor,
  parsePaginationParams,
  toPage,
} from "../src/lib/pagination.js";

const isoDate = "2026-01-01T00:00:00.000Z";
const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const row = (id: string, createdAt = isoDate) => ({ id, createdAt });

describe("cursor round trip", () => {
  it("encodes and decodes a cursor", () => {
    const encoded = encodeCursor({ t: isoDate, i: uuid });
    expect(decodeCursor(encoded)).toEqual({ t: isoDate, i: uuid });
  });

  it("is opaque, not raw JSON", () => {
    const encoded = encodeCursor({ t: isoDate, i: uuid });
    expect(encoded).not.toContain(isoDate);
    expect(encoded).not.toContain(uuid);
  });

  it("returns null when no cursor is supplied", () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });

  it("rejects a malformed cursor", () => {
    expect(() => decodeCursor("not-base64-json!!")).toThrow(InvalidCursorError);
  });

  it("rejects a base64 string that contains invalid JSON", () => {
    const invalidJsonBase64 = Buffer.from("{ invalid json", "utf8").toString(
      "base64url",
    );
    expect(() => decodeCursor(invalidJsonBase64)).toThrow(InvalidCursorError);
  });

  it("rejects a cursor that decodes to the wrong shape", () => {
    const tampered = Buffer.from(JSON.stringify({ nope: 1 }), "utf8").toString(
      "base64url",
    );
    expect(() => decodeCursor(tampered)).toThrow(InvalidCursorError);
  });
});

describe("parsePaginationParams", () => {
  it("applies the default limit", () => {
    const params = parsePaginationParams({});
    expect(params.limit).toBe(DEFAULT_PAGE_LIMIT);
    expect(params.cursor).toBeNull();
  });

  it("coerces a string limit from the query string", () => {
    expect(parsePaginationParams({ limit: "25" }).limit).toBe(25);
  });

  it("rejects a limit above the cap", () => {
    expect(() => parsePaginationParams({ limit: "100000" })).toThrow();
  });

  it("rejects a negative limit", () => {
    expect(() => parsePaginationParams({ limit: "-1" })).toThrow();
  });

  it("decodes a supplied cursor", () => {
    const encoded = encodeCursor({ t: isoDate, i: uuid });
    const params = parsePaginationParams({ limit: "10", cursor: encoded });
    expect(params.cursor).toEqual({ t: isoDate, i: uuid });
  });
});

describe("toPage", () => {
  it("returns a null cursor when the page is not full", () => {
    expect(toPage([row(uuid)], 2)).toEqual({
      items: [row(uuid)],
      nextCursor: null,
    });
  });

  it("drops the extra row and derives the cursor from the last kept row", () => {
    const page = toPage([row("a"), row("b"), row("c")], 2);
    expect(page.items).toEqual([row("a"), row("b")]);
    expect(page.nextCursor).not.toBeNull();
    expect(decodeCursor(page.nextCursor)).toEqual({ t: isoDate, i: "b" });
  });

  it("returns an empty page for no rows", () => {
    expect(toPage([], 10)).toEqual({ items: [], nextCursor: null });
  });
});
