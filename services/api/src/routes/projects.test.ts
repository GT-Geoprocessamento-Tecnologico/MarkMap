import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { toProjectWire } from "./projects.js";

const validUuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("toProjectWire", () => {
  it("converts Date objects for createdAt and updatedAt to ISO strings", () => {
    const createdDate = new Date("2026-01-01T10:00:00.000Z");
    const updatedDate = new Date("2026-01-02T12:00:00.000Z");

    const input = {
      id: validUuid,
      name: "Project A",
      description: "Sample description",
      status: "active",
      createdAt: createdDate,
      updatedAt: updatedDate,
    };

    const result = toProjectWire(input);

    expect(result).toEqual({
      id: validUuid,
      name: "Project A",
      description: "Sample description",
      status: "active",
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-02T12:00:00.000Z",
    });
  });

  it("preserves createdAt and updatedAt when provided as ISO strings", () => {
    const input = {
      id: validUuid,
      name: "Project B",
      description: "Another description",
      status: "active",
      createdAt: "2026-03-01T08:00:00.000Z",
      updatedAt: "2026-03-02T09:00:00.000Z",
    };

    const result = toProjectWire(input);

    expect(result).toEqual({
      id: validUuid,
      name: "Project B",
      description: "Another description",
      status: "active",
      createdAt: "2026-03-01T08:00:00.000Z",
      updatedAt: "2026-03-02T09:00:00.000Z",
    });
  });

  it("removes description field when description is null", () => {
    const input = {
      id: validUuid,
      name: "Project C",
      description: null,
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const result = toProjectWire(input);

    expect(result).toEqual({
      id: validUuid,
      name: "Project C",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result).not.toHaveProperty("description");
  });

  it("retains description field when description is a valid string", () => {
    const input = {
      id: validUuid,
      name: "Project D",
      description: "Valid string description",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const result = toProjectWire(input);

    expect(result.description).toBe("Valid string description");
  });

  it("applies default status 'active' when status is omitted", () => {
    const input = {
      id: validUuid,
      name: "Project E",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const result = toProjectWire(input);

    expect(result.status).toBe("active");
  });

  it("throws ZodError when required fields are missing or invalid", () => {
    const missingNameInput = {
      id: validUuid,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(() => toProjectWire(missingNameInput)).toThrow(ZodError);

    const invalidUuidInput = {
      id: "invalid-uuid",
      name: "Project F",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(() => toProjectWire(invalidUuidInput)).toThrow(ZodError);

    const invalidDateInput = {
      id: validUuid,
      name: "Project G",
      createdAt: "not-a-date",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(() => toProjectWire(invalidDateInput)).toThrow(ZodError);
  });
});
