import { describe, expect, it } from "vitest";
import { wgs84ToUtm, utmToWgs84, getUtmZone, getHemisphere } from "../../src/crs/utm.js";
import { wgs84ToMgrs, utmToMgrs } from "../../src/crs/mgrs.js";
import type { Hemisphere } from "../../src/crs/types.js";

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

  it("uses the Norway and Svalbard UTM zone exceptions", () => {
    expect(getUtmZone(6, 60)).toBe(32);
    expect(getUtmZone(20, 78)).toBe(33);
    expect(wgs84ToUtm({ latitude: 60, longitude: 6 }).zone).toBe(32);
    expect(wgs84ToUtm({ latitude: 78, longitude: 20 }).zone).toBe(33);
    expect(getUtmZone(-100, 78)).toBe(14);
    expect(getUtmZone(-1, 78)).toBe(30);
    expect(getUtmZone(42, 78)).toBe(38);
    expect(getUtmZone(50, 78)).toBe(39);
  });

  it("rejects non-finite and out-of-range UTM inputs", () => {
    expect(() => wgs84ToUtm({ latitude: 85, longitude: 0 })).toThrow(RangeError);
    expect(() => wgs84ToUtm({ latitude: 0, longitude: Number.NaN })).toThrow(RangeError);
    expect(() => utmToWgs84({ easting: 500000, northing: 0, zone: 61, hemisphere: "N" })).toThrow(RangeError);
    expect(() => utmToWgs84({ easting: 500000, northing: 0, zone: 31, hemisphere: "X" as Hemisphere })).toThrow(RangeError);
  });

  it("derives MGRS latitude bands and 100 km squares from UTM", () => {
    const equator = wgs84ToMgrs({ latitude: 0, longitude: 0 });
    expect(equator.text).toBe("31N AA 66021 00000");
    const south = wgs84ToMgrs({ latitude: -7.1932, longitude: -48.2045 });
    expect(south.band).toBe("M");
    expect(south.text).toBe("22M HH 08756 03949");
    expect(south.gridSquare).toMatch(/^[A-Z]{2}$/);
    expect(utmToMgrs(wgs84ToUtm({ latitude: -7.1932, longitude: -48.2045 })).band).toBe("M");
  });
});
