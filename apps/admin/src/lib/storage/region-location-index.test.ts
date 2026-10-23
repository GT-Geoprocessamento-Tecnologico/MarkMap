import { describe, expect, it } from "vitest";
import {
  fetchRegionLocationIndex,
  filterRegionsByLocation,
} from "./region-location-index";

const regions = [{ id: "araguaina" }, { id: "palmas" }] as never[];
const response = (value: unknown) =>
  new Response(JSON.stringify(value), { status: 200 });

describe("region location index", () => {
  it("accepts bounded metadata that references catalog IDs", async () => {
    const locations = await fetchRegionLocationIndex(
      regions,
      undefined,
      async () =>
        response({
          version: 1,
          locations: [
            {
              regionId: "araguaina",
              stateCode: "TO",
              stateName: "Tocantins",
              kind: "city",
              cityName: "Araguaína",
            },
          ],
        }),
    );
    expect(locations[0]?.cityName).toBe("Araguaína");
    expect(filterRegionsByLocation(regions, locations, "", "all")).toHaveLength(
      2,
    );
    expect(
      filterRegionsByLocation(regions, locations, "TO", "city"),
    ).toHaveLength(1);
  });

  it("rejects unknown fields and references instead of inventing locations", async () => {
    await expect(
      fetchRegionLocationIndex(regions, undefined, async () =>
        response({
          version: 1,
          locations: [
            {
              regionId: "unknown",
              stateCode: "TO",
              stateName: "Tocantins",
              kind: "city",
              extra: true,
            },
          ],
        }),
      ),
    ).rejects.toThrow("Índice inválido");
    await expect(
      fetchRegionLocationIndex(regions, undefined, async () =>
        response({
          version: 1,
          locations: [
            {
              regionId: "araguaina",
              stateCode: "TO",
              stateName: "Tocantins",
              kind: "state",
              cityName: "extra",
            },
          ],
        }),
      ),
    ).rejects.toThrow("Índice inválido");
    await expect(
      fetchRegionLocationIndex(regions, undefined, async () =>
        response({
          version: 1,
          locations: [
            {
              regionId: "araguaina",
              stateCode: "ZZ",
              stateName: "Tocantins",
              kind: "city",
              cityName: "Araguaína",
            },
          ],
        }),
      ),
    ).rejects.toThrow("Índice inválido");
    await expect(
      fetchRegionLocationIndex(regions, undefined, async () =>
        response({
          version: 1,
          locations: [],
          unexpected: true,
        }),
      ),
    ).rejects.toThrow("Índice inválido");
  });

  it("rejects an index larger than the 64 KiB response budget", async () => {
    const oversized = JSON.stringify({
      version: 1,
      locations: [],
      padding: "x".repeat(64 * 1024),
    });
    await expect(
      fetchRegionLocationIndex(
        regions,
        undefined,
        async () => new Response(oversized, { status: 200 }),
      ),
    ).rejects.toThrow("Índice excede");
  });

  it("cancels an in-flight bounded stream when its signal is aborted", async () => {
    const controller = new AbortController();
    let cancelled = false;
    const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(stream) {
            stream.enqueue(
              new TextEncoder().encode('{"version":1,"locations":['),
            );
            init?.signal?.addEventListener(
              "abort",
              () => {
                cancelled = true;
                stream.error(new DOMException("Cancelado", "AbortError"));
              },
              { once: true },
            );
          },
        }),
        { status: 200 },
      );
    const pending = fetchRegionLocationIndex(
      regions,
      controller.signal,
      fetcher,
    );
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(cancelled).toBe(true);
  });
});
