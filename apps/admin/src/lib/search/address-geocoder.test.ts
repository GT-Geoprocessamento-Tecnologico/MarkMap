import { describe, expect, it, vi } from "vitest";
import { searchAddressOnline } from "./address-geocoder";
describe("manual online address search", () => {
  it("uses manual GET without credentials and validates coordinates", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify([
      { place_id: 99, display_name: "Avenida Tocantins, Araguaína", lat: "-7.19", lon: "-48.2" },
      { place_id: 100, display_name: "Invalid", lat: "999", lon: "0" },
    ])));
    const result = await searchAddressOnline("Avenida Tocantins, Araguaína", undefined, request as typeof fetch);
    expect(result).toHaveLength(1);
    expect(result[0]?.lat).toBeCloseTo(-7.19);
    const [url, options] = request.mock.calls[0]!;
    expect(String(url)).toContain("nominatim.openstreetmap.org/search");
    expect(options?.credentials).toBe("omit");
  });
  it("refuses very short or oversized queries before network", async () => {
    await expect(searchAddressOnline("R")).rejects.toThrow();
    await expect(searchAddressOnline("X".repeat(200))).rejects.toThrow();
  });
});
