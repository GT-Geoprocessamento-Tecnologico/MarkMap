import { describe, it, expect } from "vitest";
import { parseNmeaSentence } from "../../src/gnss/nmea.js";

describe("NMEA 0183 Parser", () => {
  it("parses $GPGGA sentence with RTK fix quality and HDOP", () => {
    const gga = "$GPGGA,123519,4807.038,N,01131.000,E,4,08,0.9,545.4,M,46.9,M,,*42";
    const fix = parseNmeaSentence(gga);
    expect(fix).not.toBeNull();
    expect(fix?.latitude).toBeCloseTo(48.1173);
    expect(fix?.longitude).toBeCloseTo(11.5166);
    expect(fix?.fixQuality).toBe("RTK_FIXED");
    expect(fix?.hdop).toBe(0.9);
    expect(fix?.satellitesCount).toBe(8);
    expect(new Date(fix!.timestamp).getUTCHours()).toBe(12);
  });

  it("rejects a bad checksum and malformed numeric fields", () => {
    expect(parseNmeaSentence("$GPGGA,123519,4807.038,N,01131.000,E,4,08,0.9,545.4,M,46.9,M,,*00")).toBeNull();
    expect(parseNmeaSentence("$GPGGA,123519,4807.038,N,01131.000,E,4,08,NaN,545.4,M,46.9,M,,")).toBeNull();
    expect(parseNmeaSentence("$GPGGA,123519,4807.038,N,01131.000,E,4,08,0.9x,545.4,M,46.9,M,,")).toBeNull();
    expect(parseNmeaSentence("$GPGGA,246000,4807.038,N,01131.000,E,4,08,0.9,545.4,M,46.9,M,,")).toBeNull();
    expect(parseNmeaSentence("$GPGGA,123519,9000.001,N,01131.000,E,4,08,0.9,545.4,M,46.9,M,,")).toBeNull();
    expect(parseNmeaSentence("$GPGGA,123519,4807.038,N,18000.001,E,4,08,0.9,545.4,M,46.9,M,,")).toBeNull();
  });

  it("accepts signed altitude and uses the supplied observation date", () => {
    const fix = parseNmeaSentence(
      "$GPGGA,235959,4807.038,N,01131.000,E,1,08,0.9,-12.5,M,46.9,M,,",
      new Date("2024-02-29T00:00:00.000Z"),
    );
    expect(fix?.altitude).toBe(-12.5);
    expect(new Date(fix!.timestamp).toISOString()).toBe("2024-02-29T23:59:59.000Z");
    expect(parseNmeaSentence(
      "$GPGGA,235959,4807.038,N,01131.000,E,1,08,0.9,-12.5,M,46.9,M,,",
      new Date("invalid"),
    )).toBeNull();
  });
});
