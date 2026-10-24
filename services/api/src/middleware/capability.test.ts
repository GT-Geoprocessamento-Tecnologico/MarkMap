import { describe, it, expect, vi, beforeEach } from "vitest";
import { findWorkspaceByCapabilityHash, getDb } from "@markmap/db";

import { resolveWorkspaceCapability, hashCapability } from "./capability.js";
import { AppError, ErrorCode } from "../lib/errors.js";

vi.mock("@markmap/db", () => ({
  findWorkspaceByCapabilityHash: vi.fn(),
  getDb: vi.fn(),
}));

describe("resolveWorkspaceCapability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validToken = "123456789012345678901234567890123456789012A";
  const validBearer = `Bearer ${validToken}`;

  it("should throw error if authorization header is missing", async () => {
    await expect(resolveWorkspaceCapability(undefined)).rejects.toThrow(
      new AppError("Workspace capability is required", {
        status: 401,
        code: ErrorCode.VALIDATION_ERROR,
      }),
    );
  });

  it("should throw error if token is not a bearer token", async () => {
    await expect(
      resolveWorkspaceCapability(`Basic ${validToken}`),
    ).rejects.toThrow(
      new AppError("Workspace capability is required", {
        status: 401,
        code: ErrorCode.VALIDATION_ERROR,
      }),
    );
  });

  it("should throw error if token does not match pattern", async () => {
    await expect(
      resolveWorkspaceCapability("Bearer invalid-token"),
    ).rejects.toThrow(
      new AppError("Workspace capability is required", {
        status: 401,
        code: ErrorCode.VALIDATION_ERROR,
      }),
    );
  });

  it("should throw error if workspace is not found", async () => {
    vi.mocked(findWorkspaceByCapabilityHash).mockResolvedValue(null);

    await expect(resolveWorkspaceCapability(validBearer)).rejects.toThrow(
      new AppError("Workspace capability is invalid or revoked", {
        status: 401,
        code: ErrorCode.VALIDATION_ERROR,
      }),
    );
  });

  it("should return workspace capability access if successful", async () => {
    const mockWorkspace = {
      workspaceId: "ws-123",
      capabilityHash: hashCapability(validToken),
      generation: "gen-1",
    };
    vi.mocked(findWorkspaceByCapabilityHash).mockResolvedValue(
      mockWorkspace as NonNullable<Awaited<ReturnType<typeof findWorkspaceByCapabilityHash>>>,
    );
    vi.mocked(getDb).mockReturnValue({} as ReturnType<typeof getDb>);

    const result = await resolveWorkspaceCapability(validBearer);

    expect(result).toEqual({
      workspaceId: mockWorkspace.workspaceId,
      capabilityHash: mockWorkspace.capabilityHash,
      generation: mockWorkspace.generation,
    });
    expect(findWorkspaceByCapabilityHash).toHaveBeenCalledWith(
      {},
      mockWorkspace.capabilityHash,
    );
  });
});
