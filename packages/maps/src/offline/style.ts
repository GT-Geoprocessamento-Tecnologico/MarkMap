// @ts-expect-error contracts emits runtime JS without declarations in this workspace
import type { OfflineMapPackageManifest } from "../../../contracts/dist/src/offline-map.js";
import { isSafePackagePath } from "./package.js";

export type OfflineStyle = Record<string, unknown>;
const replaceLocal = (value: string, protocolId: string): string => {
  if (value === "pmtiles://package.pmtiles") return `pmtiles://geonexo-offline:${protocolId}`;
  return `geonexo-package://${protocolId}/${value}`;
};

export function adaptOfflineStyle(
  style: OfflineStyle, manifest: OfflineMapPackageManifest, protocolId = manifest.id,
): OfflineStyle {
  if (protocolId !== manifest.id && !/^mk[a-z0-9]+$/.test(protocolId))
    throw new Error("Invalid offline protocol lease identity");
  const copy = structuredClone(style) as OfflineStyle;
  const sourceMap = copy.sources as Record<string, Record<string, unknown>> | undefined;
  if (!sourceMap) throw new Error("offline style has no sources");
  for (const source of Object.values(sourceMap)) {
    if (typeof source.url === "string") source.url = replaceLocal(source.url, protocolId);
    if (Array.isArray(source.tiles)) source.tiles = source.tiles.map((v) => typeof v === "string" ? replaceLocal(v, protocolId) : v);
    const existing = typeof source.attribution === "string" && source.attribution.trim() ? source.attribution.trim() : "";
    source.attribution = existing && existing !== manifest.attribution ? `${existing}; ${manifest.attribution}` : manifest.attribution;
  }
  for (const key of ["glyphs", "sprite"]) {
    const value = copy[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || !isSafePackagePath(value.replace(/\{(?:fontstack|range)\}/g, "placeholder"))) throw new Error(`invalid offline ${key} resource`);
    copy[key] = replaceLocal(value, protocolId);
  }
  copy.attribution = manifest.attribution;
  return copy;
}
