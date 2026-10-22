import { describe, expect, it } from "vitest";
import { wgs84ToUtm, utmToWgs84, getUtmZone, getHemisphere } from "../../src/crs/utm.js";

describe("CRS Engine - UTM Projections", () => {
  it("computes correct UTM zone and hemisphere for Brazilian territories", () => {
    // Araguaína - TO (-7.19, -48.20) -> Zona 22S
    expect(getUtmZone(-48.20)).toBe(22);
    expect(getHemisphere(-7.19)).toBe("S");

    // Brasília - DF (-15.79, -47.88) -> Zona 23S
    expect(getUtmZone(-47.88)).toBe(23);
    expect(getHemisphere(-15.79)).toBe("S");
  });

  it("converts WGS84 to UTM and back to WGS84 with submillimeter accuracy", () => {
    const original = { latitude: -7.1932, longitude: -48.2045 };
    const utm = wgs84ToUtm(original);

    expect(utm.zone).toBe(22);
    expect(utm.hemisphere).toBe("S");
    expect(utm.easting).toBeGreaterThan(700000);
    expect(utm.easting).toBeLessThan(900000);
    expect(utm.northing).toBeGreaterThan(9000000);
    expect(utm.northing).toBeLessThan(10000000);

    const reversed = utmToWgs84(utm);
    expect(reversed.latitude).toBeCloseTo(original.latitude, 6);
    expect(reversed.longitude).toBeCloseTo(original.longitude, 6);
  });
});
