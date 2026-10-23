import type { OfflineMapStore } from "../storage/offline-map-store";
import type { LocalSearchRecord } from "./local-map-search";
import {
  MAX_REGIONAL_SEARCH_RECORDS,
  MAX_REGIONAL_SHARD_BYTES,
  MAX_REGIONAL_SEARCH_BYTES,
  parseRegionalShard,
} from "@markmap/maps/search/regional-shards";

/** Only stable, authored text can reach the regional search UI. */
const KNOWN_SEARCH_ERRORS = new Set([
  "Índice regional ausente; reinstale este mapa offline.",
  "Índice regional excede tamanho seguro",
  "Busca regional excede orçamento local",
  "Índice regional inválido; reinstale este mapa offline.",
  "Região possui registros demais para busca offline",
  "O mapa regional foi atualizado. Reabra a busca offline.",
]);

export function describeRegionalSearchLoadError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : null;
  return message && KNOWN_SEARCH_ERRORS.has(message)
    ? message
    : "Busca regional indisponível. Verifique o pacote offline em Configurações.";
}

/** Reads only verified assets from the active generation, never a network API. */
export async function loadRegionalPackageSearch(
  store: Pick<OfflineMapStore, "getActiveRevision" | "assetAtRevision">,
  packageId: string,
): Promise<LocalSearchRecord[]> {
  const installed = await store.getActiveRevision(packageId);
  if (!installed) return [];
  const refs = installed.manifest.searchShards ?? [];
  if (refs.length === 0) return [];
  const records: LocalSearchRecord[] = [];
  const seen = new Set<string>();
  let byteCount = 0;
  for (const ref of refs) {
    const blob = await store.assetAtRevision(
      packageId,
      ref.path,
      installed.generation,
    );
    if (!blob) {
      if (
        (await store.getActiveRevision(packageId))?.generation !==
        installed.generation
      )
        throw new Error(
          "O mapa regional foi atualizado. Reabra a busca offline.",
        );
      throw new Error("Índice regional ausente; reinstale este mapa offline.");
    }
    if (blob.size > MAX_REGIONAL_SHARD_BYTES)
      throw new Error("Índice regional excede tamanho seguro");
    byteCount += blob.size;
    if (byteCount > MAX_REGIONAL_SEARCH_BYTES)
      throw new Error("Busca regional excede orçamento local");
    let shard;
    try {
      shard = parseRegionalShard(JSON.parse(await blob.text()), ref.path);
    } catch {
      throw new Error("Índice regional inválido; reinstale este mapa offline.");
    }
    if (records.length + shard.records.length > MAX_REGIONAL_SEARCH_RECORDS)
      throw new Error("Região possui registros demais para busca offline");
    for (const item of shard.records) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      // Namespace regional avoids collisions with project-feature IDs.
      records.push({ ...item, id: `${packageId}:${item.id}` });
    }
  }
  // A region updated in another tab must not surface a mixed/stale index.
  if (
    (await store.getActiveRevision(packageId))?.generation !==
    installed.generation
  )
    throw new Error("O mapa regional foi atualizado. Reabra a busca offline.");
  return records;
}
