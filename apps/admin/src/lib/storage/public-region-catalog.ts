// Desenvolvido por MtsFerreira. Only published, licensed packages appear here.
import { mapBoundsSchema } from "@geonexo/contracts";
import { z } from "zod";
import { normalizePublicRegionManifestUrl } from "./region-install-draft.mjs";

const entrySchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/),
  label: z.string().trim().min(2).max(160),
  area: z.string().trim().min(2).max(120),
  manifestUrl: z.string().max(1000).refine(
    (value) => normalizePublicRegionManifestUrl(value) === value,
    "A região precisa de uma origem HTTPS pública válida.",
  ),
  bounds: mapBoundsSchema,
  sizeBytes: z.number().int().positive().max(250 * 1024 * 1024),
  attribution: z.string().trim().min(2).max(300),
}).strict();

const catalogSchema = z.object({
  version: z.literal(1),
  regions: z.array(entrySchema).max(100),
}).strict().superRefine(({ regions }, ctx) => {
  const ids = new Set<string>();
  for (const [index, region] of regions.entries()) {
    if (ids.has(region.id)) ctx.addIssue({
      code: "custom", path: ["regions", index, "id"], message: "Região duplicada",
    });
    ids.add(region.id);
  }
});

export type PublicRegion = z.infer<typeof entrySchema>;

export function parsePublicRegionCatalog(data: unknown): PublicRegion[] {
  return catalogSchema.parse(data).regions;
}

// Search must work even when people omit accents in Portuguese place names.
export const normalizeRegionSearch = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function regionCoversPoint(region: PublicRegion, center?: readonly [number, number]): boolean {
  if (!center) return false;
  const [west, south, east, north] = region.bounds;
  return center[0] >= west && center[0] <= east &&
    center[1] >= south && center[1] <= north;
}

/** The catalog is same-origin and bounded; package bytes use the verified installer. */
export async function fetchPublicRegionCatalog(
  signal?: AbortSignal, fetcher: typeof fetch = fetch,
): Promise<PublicRegion[]> {
  const response = await fetcher("/maps/catalog.json", {
    method: "GET", credentials: "omit", redirect: "error", cache: "no-store", signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok || !response.body) throw new Error("Catálogo de mapas indisponível.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64 * 1024) throw new Error("O catálogo de mapas excede o limite permitido.");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
  return parsePublicRegionCatalog(JSON.parse(new TextDecoder().decode(bytes)) as unknown);
}
