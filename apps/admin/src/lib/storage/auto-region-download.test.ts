import { beforeEach, describe, expect, it, vi } from "vitest";
import { offlineDB } from "./offline-db";
import { getAutomaticRegionDownload, setAutomaticRegionDownload } from "./auto-region-download";

vi.mock("./offline-db", () => ({ offlineDB: { get: vi.fn(), save: vi.fn() } }));

describe("consent for automatic map downloads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults to disabled without an explicit preference", async () => {
    vi.mocked(offlineDB.get).mockResolvedValue(null);
    expect(await getAutomaticRegionDownload()).toBe(false);
  });
  it("remembers consent without storing device position", async () => {
    vi.mocked(offlineDB.get).mockResolvedValue({ enabled: true });
    expect(await getAutomaticRegionDownload()).toBe(true);
    await setAutomaticRegionDownload(false);
    expect(offlineDB.save).toHaveBeenCalledWith(
      "permissions", "auto-region-download", { enabled: false },
    );
  });
});
