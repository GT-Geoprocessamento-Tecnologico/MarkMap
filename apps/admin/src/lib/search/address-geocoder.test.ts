import { describe, expect, it, vi } from "vitest";
import { configuredAddressSearchEndpoint, searchAddressOnline } from "./address-geocoder";

describe("configured online address search", () => {
  it("rejects absent or cross-origin provider routes", () => {
    expect(configuredAddressSearchEndpoint()).toBeNull();
    expect(configuredAddressSearchEndpoint("https://somewhere.com/search")).toBeNull();
    expect(configuredAddressSearchEndpoint("/api/address-search")).toBe("/api/address-search");
  });
  it("queries only a first-party authorized route and checks coordinates", async () => {
    const request = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify([
        { id: "99", label: "Avenida Tocantins, Araguaína", lat: -7.19, lon: -48.2 },
        { id: "100", label: "Invalid", lat: 999, lon: 0 },
      ])));
    const result = await searchAddressOnline(
      "Avenida Tocantins, Araguaína", undefined, request as typeof fetch, "/api/address-search",
    );
    expect(result).toHaveLength(1);
    const [url, options] = request.mock.calls[0]!;
    expect(String(url)).toContain("/api/address-search?");
    expect(options?.credentials).toBe("same-origin");
  });
  it("declines unsupported or invalid queries", async () => {
    await expect(searchAddressOnline("R")).rejects.toThrow();
    await expect(searchAddressOnline("Rua Grande", undefined, fetch, null)).rejects.toThrow();
  });
});
