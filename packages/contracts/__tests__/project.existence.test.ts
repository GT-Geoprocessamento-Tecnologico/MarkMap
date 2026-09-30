import { describe, expect, it } from "vitest";

import { createProjectSchema, projectSchema } from "../project.js";

describe("project contract validation", () => {
  it("requires a UUID for a stored project", () => {
    expect(
      projectSchema.safeParse({
        id: "not-a-uuid",
        name: "Survey",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("does not let clients choose server-owned fields", () => {
    const result = createProjectSchema.safeParse({
      name: "Survey",
      status: "archived",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("status");
  });
});
