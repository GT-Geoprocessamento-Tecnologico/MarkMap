import { describe, it, expect } from "vitest";
import { parseNmeaSentence } from "../../src/gnss/nmea.js";

describe("NMEA 0183 Parser", () => {
  it("parses $GPGGA sentence with RTK fix quality and HDOP", () => {
    const gga = "$GPGGA,123519,4807.038,N,01131.000,E,4,08,0.9,545.4,M,46.9,M,,*47";
    const fix = parseNmeaSentence(gga);
    expect(fix).not.toBeNull();
    expect(fix?.latitude).toBeCloseTo(48.1173);
    expect(fix?.longitude).toBeCloseTo(11.5166);
    expect(fix?.fixQuality).toBe("RTK_FIXED");
    expect(fix?.hdop).toBe(0.9);
    expect(fix?.satellitesCount).toBe(8);
  });
});
