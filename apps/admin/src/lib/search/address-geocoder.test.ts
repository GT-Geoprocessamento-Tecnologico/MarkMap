import { describe, expect, it, vi } from "vitest";
import { configuredAddressSearchEndpoint, searchAddressOnline } from "./address-geocoder";
import { addressSearchCache } from "./address-search-cache";

vi.mock("./address-search-cache", () => ({
  addressSearchCache: { read: vi.fn(async () => null), write: vi.fn(async () => undefined) },
}));

describe("configured online address search", () => {
  it("rejects absent or cross-origin provider routes", () => {
    expect(configuredAddressSearchEndpoint()).toBe("/api/address-search");
    expect(configuredAddressSearchEndpoint("https://somewhere.com/search")).toBeNull();
    expect(configuredAddressSearchEndpoint("/api/address-search")).toBe("/api/address-search");
  });
  it("queries only a first-party authorized route and checks coordinates", async () => {
    const request = vi.fn(async (_requestUrl: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify([
        { id: "99", label: "Avenida Tocantins, Araguaína", lat: -7.19, lon: -48.2, postalCode: "77800000", source: "BrasilAPI" },
        { id: "100", label: "Invalid", lat: 999, lon: 0 },
      ])));
    const result = await searchAddressOnline(
      "Avenida Tocantins, Araguaína", undefined, request as typeof fetch, "/api/address-search",
    );
    expect(result).toHaveLength(1);
    const [url, options] = request.mock.calls[0]!;
    expect(String(url)).toContain("/api/address-search?");
    expect(options?.credentials).toBe("same-origin");
    expect(result[0]).toMatchObject({ postalCode: "77800000", source: "BrasilAPI" });
  });
  it("declines unsupported or invalid queries", async () => {
    await expect(searchAddressOnline("R")).rejects.toThrow();
    await expect(searchAddressOnline("Rua Grande", undefined, fetch, null)).rejects.toThrow();
  });

  it("normalizes a formatted CEP and writes only validated positive results", async () => {
    const request = vi.fn(async (_url: RequestInfo | URL) => new Response(JSON.stringify([
      { id: "cep", label: "Rua A, Araguaína", lat: -7.19, lon: -48.2, postalCode: "77800000" },
    ])));
    await searchAddressOnline("77800-000", undefined, request as typeof fetch, "/api/address-search");
    expect(String(request.mock.calls[0]?.[0])).toContain("q=77800000");
    expect(vi.mocked(addressSearchCache.write)).toHaveBeenCalledWith("77800000", "/api/address-search", expect.any(Array));
  });

  it("uses a positive cache hit before the offline guard", async () => {
    vi.mocked(addressSearchCache.read).mockResolvedValueOnce([{ id: "cached", label: "Rua A", lat: -7.1, lon: -48.1 }]);
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const request = vi.fn();
    await expect(searchAddressOnline("Rua A", undefined, request as typeof fetch, "/api/address-search")).resolves.toHaveLength(1);
    expect(request).not.toHaveBeenCalled();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("rejects string coordinates and oversized streamed responses", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify([{ id: "bad", label: "Bad", lat: "-7.1", lon: -48.1 }])));
    await expect(searchAddressOnline("Rua Bad", undefined, request as typeof fetch, "/api/address-search")).resolves.toEqual([]);
    const oversized = vi.fn(async () => new Response(JSON.stringify(["x".repeat(130 * 1024)])));
    await expect(searchAddressOnline("Rua Grande", undefined, oversized as typeof fetch, "/api/address-search")).rejects.toThrow("muito grande");
  });

  it("maps network rejection to a safe Portuguese message", async () => {
    const request = vi.fn(async () => { throw new TypeError("fetch failed: secret host"); });
    await expect(searchAddressOnline("Rua Falha", undefined, request as typeof fetch, "/api/address-search")).rejects.toThrow("Busca online indisponível. Tente mais tarde.");
  });

  it("preserves an external abort signal instead of converting it to a network notice", async () => {
    const controller = new AbortController();
    const request = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      controller.abort();
      if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return new Response("[]");
    });
    await expect(searchAddressOnline("Rua Cancelada", controller.signal, request as typeof fetch, "/api/address-search")).rejects.toMatchObject({ name: "AbortError" });
  });
});
