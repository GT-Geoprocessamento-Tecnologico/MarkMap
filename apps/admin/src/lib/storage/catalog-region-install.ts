// Desenvolvido por MtsFerreira. Catalog entries never bypass manifest checks.
import {
  offlineMapPackageManifestSchema,
  type OfflineMapPackageManifest,
} from "@markmap/contracts";
import { fetchRemoteRegionManifest } from "./remote-region-manifest.mjs";
import type {
  ResumableInstaller,
  InstallerProgress,
} from "./resumable-installer";
import type { PublicRegion } from "./public-region-catalog";

type Installer = Pick<ResumableInstaller, "checkResume" | "startInstall">;
type Options = {
  signal: AbortSignal;
  replaceCheckpoint?: boolean;
  onProgress?: (progress: InstallerProgress) => void;
  fetcher?: typeof fetch;
};
type Result =
  | { kind: "installed"; manifest: OfflineMapPackageManifest }
  | { kind: "confirm" }
  | { kind: "error"; code: string };

/** A changed catalog entry cannot silently download bytes from a different region. */
export async function installCatalogRegion(
  region: PublicRegion,
  installer: Installer,
  options: Options,
): Promise<Result> {
  const remote = await fetchRemoteRegionManifest(
    region.manifestUrl,
    options.fetcher ?? fetch,
    options.signal,
  );
  const manifest = offlineMapPackageManifestSchema.parse(remote.manifest);
  if (
    manifest.id !== region.id ||
    manifest.totalBytes !== region.sizeBytes ||
    manifest.bounds.some((value, i) => value !== region.bounds[i])
  )
    throw new Error(
      "O pacote publicado não corresponde à região escolhida. Atualize o catálogo.",
    );
  const resume = await installer.checkResume(manifest.id, manifest);
  if (resume.needsConfirmation && !options.replaceCheckpoint)
    return { kind: "confirm" };
  const result = await installer.startInstall({
    packageId: manifest.id,
    manifest: { ...manifest, archivePath: "package.pmtiles" },
    baseUrl: remote.baseUrl,
    forceValidate: Boolean(options.replaceCheckpoint),
    signal: options.signal,
    onProgress: options.onProgress,
  });
  return result.success
    ? { kind: "installed", manifest }
    : {
        kind: "error",
        code: result.error.code,
      };
}
