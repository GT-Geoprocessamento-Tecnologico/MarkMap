// Desenvolvido por MtsFerreira. Installation and recovery remain owned by the verified installer.
import type { PublicRegion } from "./public-region-catalog";

export type CatalogQueueResult = {
  status: "completed" | "cancelled" | "stopped";
  installedIds: string[];
  skippedIds: string[];
  stoppedId?: string;
  reason?: "confirm" | "error";
};

type Options = {
  signal: AbortSignal;
  installedIds: ReadonlySet<string>;
  install: (region: PublicRegion) => Promise<"installed" | "confirm" | "error">;
  onProgress?: (progress: {
    total: number;
    completed: number;
    index: number;
    currentId: string;
  }) => void;
};

/** Snapshot a selection, install serially, and stop before starting another item after cancellation or failure. */
export async function runCatalogDownloadQueue(
  regions: readonly PublicRegion[], options: Options,
): Promise<CatalogQueueResult> {
  const unique = [...new Map(regions.map(region => [region.id, region])).values()];
  const skippedIds = unique.filter(region => options.installedIds.has(region.id)).map(region => region.id);
  const pending = unique.filter(region => !options.installedIds.has(region.id));
  const installedIds: string[] = [];
  const finish = (status: CatalogQueueResult["status"]): CatalogQueueResult => ({ status, installedIds, skippedIds });

  for (const [index, region] of pending.entries()) {
    if (options.signal.aborted) return finish("cancelled");
    options.onProgress?.({
      total: pending.length, completed: installedIds.length, index: index + 1, currentId: region.id,
    });
    if (options.signal.aborted) return finish("cancelled");
    let result: "installed" | "confirm" | "error";
    try {
      result = await options.install(region);
    } catch {
      result = "error";
    }
    if (result === "installed") installedIds.push(region.id);
    // A committed package is still recorded if cancellation arrives at the activation boundary.
    if (options.signal.aborted) return finish("cancelled");
    if (result !== "installed") {
      return { ...finish("stopped"), stoppedId: region.id, reason: result };
    }
  }
  return finish(options.signal.aborted ? "cancelled" : "completed");
}
