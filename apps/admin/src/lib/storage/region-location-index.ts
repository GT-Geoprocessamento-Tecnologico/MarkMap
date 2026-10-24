import type { PublicRegion } from "./public-region-catalog";

export type RegionLocation = {
  regionId: string;
  stateCode: string;
  stateName: string;
  kind: "state" | "city";
  cityName?: string;
};

const MAX_BYTES = 64 * 1024;
const MAX_LOCATIONS = 100;
const BRAZIL_UF = new Set(["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"]);

function parse(data: unknown, regions: ReadonlySet<string>): RegionLocation[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Índice inválido");
  const value = data as Record<string, unknown>;
  if (Object.keys(value).some(key => key !== "version" && key !== "locations")) throw new Error("Índice inválido");
  if (value.version !== 1 || !Array.isArray(value.locations) || value.locations.length > MAX_LOCATIONS) {
    throw new Error("Índice inválido");
  }
  const ids = new Set<string>();
  return value.locations.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Índice inválido");
    const item = raw as Record<string, unknown>;
    const allowed = new Set(["regionId", "stateCode", "stateName", "kind", "cityName"]);
    if (Object.keys(item).some(key => !allowed.has(key))) throw new Error("Índice inválido");
    const regionId = typeof item.regionId === "string" ? item.regionId.trim() : "";
    const stateCode = typeof item.stateCode === "string" ? item.stateCode.trim().toUpperCase() : "";
    const stateName = typeof item.stateName === "string" ? item.stateName.trim() : "";
    const kind = item.kind === "state" || item.kind === "city" ? item.kind : null;
    const cityName = item.cityName === undefined ? undefined :
      typeof item.cityName === "string" ? item.cityName.trim() : null;
    if (!regionId || regionId.length > 128 || !regions.has(regionId) || ids.has(regionId) ||
        !BRAZIL_UF.has(stateCode) || stateName.length < 2 || stateName.length > 100 || !kind || cityName === null ||
        (cityName !== undefined && (cityName.length < 2 || cityName.length > 120)) ||
        (kind === "state" && cityName !== undefined) ||
        (kind === "city" && !cityName)) throw new Error("Índice inválido");
    ids.add(regionId);
    return { regionId, stateCode, stateName, kind, ...(cityName ? { cityName } : {}) };
  });
}

export async function fetchRegionLocationIndex(
  regions: readonly PublicRegion[], signal?: AbortSignal, fetcher: typeof fetch = fetch,
): Promise<RegionLocation[]> {
  const response = await fetcher("/maps/locations.json", {
    method: "GET", credentials: "omit", redirect: "error", cache: "no-store", signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok || !response.body) throw new Error("Índice indisponível");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error("Índice excede o limite permitido");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const regionsById = new Set(regions.map(region => region.id));
  return parse(JSON.parse(new TextDecoder().decode(bytes)) as unknown, regionsById);
}

export function filterRegionsByLocation(
  regions: readonly PublicRegion[], locations: readonly RegionLocation[],
  stateCode: string, kind: "all" | "state" | "city",
): PublicRegion[] {
  const byId = new Map(locations.map(location => [location.regionId, location]));
  return regions.filter(region => {
    const location = byId.get(region.id);
    if (kind === "all" && !stateCode) return true;
    return Boolean(location) && (!stateCode || location?.stateCode === stateCode) &&
      (kind === "all" || location?.kind === kind);
  });
}
