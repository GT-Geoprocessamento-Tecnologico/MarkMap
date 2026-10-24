import { describe, expect, it, vi } from "vitest";
import { runCatalogDownloadQueue } from "./catalog-download-queue";
import type { PublicRegion } from "./public-region-catalog";

const region = (id: string): PublicRegion => ({
  id, label: id, area: "Brasil", bounds: [-49, -11, -47, -9], sizeBytes: 1024,
  attribution: "OpenStreetMap contributors", manifestUrl: `https://example.org/${id}/manifest.json`,
});
const options = () => ({ signal: new AbortController().signal, installedIds: new Set<string>() });

describe("catalog download queue", () => {
  it("waits for one verified install to finish before starting the next", async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const events: string[] = [];
    const progress = vi.fn();
    const operation = runCatalogDownloadQueue([region("first"), region("second")], {
      ...options(), onProgress: progress,
      install: async item => {
        events.push(`start:${item.id}`);
        if (item.id === "first") await gate;
        events.push(`finish:${item.id}`);
        return "installed";
      },
    });
    expect(events).toEqual(["start:first"]);
    release();
    expect(await operation).toEqual({ status: "completed", installedIds: ["first", "second"], skippedIds: [] });
    expect(events).toEqual(["start:first", "finish:first", "start:second", "finish:second"]);
    expect(progress.mock.calls.map(([value]) => [value.index, value.completed, value.total])).toEqual([[1, 0, 2], [2, 1, 2]]);
  });

  it("deduplicates the snapshot and skips maps already installed", async () => {
    const install = vi.fn(async () => "installed" as const);
    const result = await runCatalogDownloadQueue([region("first"), region("first"), region("saved"), region("second")], {
      ...options(), installedIds: new Set(["saved"]), install,
    });
    expect(install.mock.calls).toHaveLength(2);
    expect(result).toEqual({ status: "completed", installedIds: ["first", "second"], skippedIds: ["saved"] });
  });

  it.each(["error", "confirm"] as const)("stops on %s without touching later maps", async reason => {
    const install = vi.fn(async (item: PublicRegion) => item.id === "second" ? reason : "installed" as const);
    const result = await runCatalogDownloadQueue([region("first"), region("second"), region("third")], { ...options(), install });
    expect(result).toEqual({ status: "stopped", installedIds: ["first"], skippedIds: [], stoppedId: "second", reason });
    expect(install.mock.calls.map(([item]) => item.id)).toEqual(["first", "second"]);
  });

  it("makes no installer calls when cancelled before starting", async () => {
    const controller = new AbortController();
    controller.abort();
    const install = vi.fn(async () => "installed" as const);
    const result = await runCatalogDownloadQueue([region("first")], { ...options(), signal: controller.signal, install });
    expect(result.status).toBe("cancelled");
    expect(install).not.toHaveBeenCalled();
  });

  it("records an activated item but stops the rest if cancellation arrives at commit", async () => {
    const controller = new AbortController();
    const install = vi.fn(async () => { controller.abort(); return "installed" as const; });
    const result = await runCatalogDownloadQueue([region("first"), region("second")], { ...options(), signal: controller.signal, install });
    expect(result).toEqual({ status: "cancelled", installedIds: ["first"], skippedIds: [] });
    expect(install).toHaveBeenCalledTimes(1);
  });

  it("stops after an unexpected failure and preserves earlier successes", async () => {
    const result = await runCatalogDownloadQueue([region("first"), region("second"), region("third")], {
      ...options(), install: async item => { if (item.id === "second") throw new Error("storage unavailable"); return "installed"; },
    });
    expect(result).toEqual({ status: "stopped", installedIds: ["first"], skippedIds: [], stoppedId: "second", reason: "error" });
  });

  it("does not start an install if its progress observer cancels the queue", async () => {
    const controller = new AbortController();
    const install = vi.fn(async () => "installed" as const);
    const result = await runCatalogDownloadQueue([region("first")], {
      ...options(), signal: controller.signal, install, onProgress: () => controller.abort(),
    });
    expect(result.status).toBe("cancelled");
    expect(install).not.toHaveBeenCalled();
  });
});
