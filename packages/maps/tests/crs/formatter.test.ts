import { describe, expect, it } from "vitest";
import { formatAll, formatDMS, formatDecimalDegrees, formatUtmText } from "../../src/crs/formatter.js";

describe("CRS Engine - Multi-Coordinate Formatter", () => {
  const coord = { latitude: -7.1932, longitude: -48.2045 };

  it("formats decimal degrees with standard directions", () => {
    const formatted = formatDecimalDegrees(coord);
    expect(formatted).toContain("7.193200°S");
    expect(formatted).toContain("48.204500°W");
  });

  it("formats DMS string accurately", () => {
    const dms = formatDMS(coord);
    expect(dms).toContain("7°11'");
    expect(dms).toContain("S");
    expect(dms).toContain("48°12'");
    expect(dms).toContain("W");
  });

  it("formats UTM text with zone and hemisphere prefix", () => {
    const utm = formatUtmText(coord);
    expect(utm.startsWith("22S")).toBe(true);
  });

  it("produces simultaneous multi-coordinate payload", () => {
    const all = formatAll(coord);
    expect(all.decimal).toBeDefined();
    expect(all.dms).toBeDefined();
    expect(all.utm).toBeDefined();
    expect(all.mgrs).toBeDefined();
  });
});
