import { describe, it, expect } from "vitest";
import {
  convertDistance,
  convertArea,
  convertAngle,
  formatArea,
  AREA_UNITS,
  measurePointsAreaSquareMeters,
  type AreaUnit,
} from "../../src/index.js";

describe("Surveying Units & Brazilian Agrarian Units (@markmap/geo)", () => {
  describe("Distance Conversions", () => {
    it("converts meters to US Survey Feet, Chains, Rods, and Nautical Miles accurately", () => {
      expect(convertDistance(100, "meters", "survey_feet")).toBeCloseTo(
        328.0833,
        3,
      );
      expect(convertDistance(201.168, "meters", "chains")).toBeCloseTo(10.0, 3);
      expect(convertDistance(5.0292, "meters", "rods")).toBeCloseTo(1.0, 3);
      expect(convertDistance(1852, "meters", "nautical_miles")).toBeCloseTo(
        1.0,
        3,
      );
      expect(convertDistance(1000, "meters", "kilometers")).toBe(1.0);
    });

    it("throws RangeError for invalid distance values", () => {
      expect(() => convertDistance(NaN, "meters", "kilometers")).toThrow(
        RangeError,
      );
      expect(() => convertDistance(Infinity, "meters", "kilometers")).toThrow(
        RangeError,
      );
    });
  });

  describe("Brazilian Rural Area Units & Conversions", () => {
    it("converts square meters to Hectare and regional Brazilian Alqueires", () => {
      // Hectare (10.000 m²)
      expect(convertArea(10_000, "hectares")).toBe(1.0);
      expect(convertArea(50_000, "hectares")).toBe(5.0);

      // Alqueire Paulista (2,42 ha = 24.200 m²)
      expect(convertArea(24_200, "alqueire_paulista")).toBe(1.0);
      expect(convertArea(48_400, "alqueire_paulista")).toBe(2.0);

      // Alqueire Mineiro / Goiano (4,84 ha = 48.400 m²)
      expect(convertArea(48_400, "alqueire_mineiro")).toBe(1.0);

      // Alqueire Baiano (9,68 ha = 96.800 m²)
      expect(convertArea(96_800, "alqueire_baiano")).toBe(1.0);

      // Alqueirão do Norte (2,72 ha = 27.200 m²)
      expect(convertArea(27_200, "alqueire_norte")).toBe(1.0);

      // Metros quadrados e quilômetros quadrados
      expect(convertArea(1, "square_meters")).toBe(1.0);
      expect(convertArea(1_000_000, "square_kilometers")).toBe(1.0);
    });

    it("throws RangeError for negative or non-finite area values", () => {
      expect(() => convertArea(-100, "hectares")).toThrow(RangeError);
      expect(() => convertArea(NaN, "hectares")).toThrow(RangeError);
      expect(() => convertArea(Infinity, "alqueire_paulista")).toThrow(
        RangeError,
      );
    });

    it("throws RangeError for unknown or prototype area units", () => {
      expect(() =>
        convertArea(10_000, "toString" as unknown as AreaUnit),
      ).toThrow(RangeError);
      expect(() =>
        convertArea(10_000, "valueOf" as unknown as AreaUnit),
      ).toThrow(RangeError);
      expect(() =>
        convertArea(10_000, "unknown_unit" as unknown as AreaUnit),
      ).toThrow(RangeError);
    });
  });

  describe("Angle Conversions", () => {
    it("converts degrees to Gon, Mils, and Radians", () => {
      expect(convertAngle(360, "degrees", "gon")).toBeCloseTo(400.0, 3);
      expect(convertAngle(180, "degrees", "mils")).toBeCloseTo(3200.0, 3);
      expect(convertAngle(180, "degrees", "radians")).toBeCloseTo(Math.PI, 6);
      expect(convertAngle(Math.PI, "radians", "degrees")).toBeCloseTo(180.0, 6);
    });

    it("throws RangeError for invalid angle values", () => {
      expect(() => convertAngle(NaN, "degrees", "radians")).toThrow(RangeError);
      expect(() => convertAngle(Infinity, "degrees", "radians")).toThrow(
        RangeError,
      );
    });
  });

  describe("formatArea", () => {
    it("formats areas in pt-BR locale with short labels", () => {
      expect(formatArea(10_000, "hectares")).toBe("1,00 ha");
      expect(formatArea(24_200, "alqueire_paulista")).toBe(
        "1,00 alq. paulista",
      );
      expect(formatArea(48_400, "alqueire_mineiro")).toBe("1,00 alq. mineiro");
      expect(formatArea(96_800, "alqueire_baiano")).toBe("1,00 alq. baiano");
      expect(formatArea(27_200, "alqueire_norte")).toBe("1,00 alq. norte");
      expect(formatArea(500, "square_meters")).toBe("500,00 m²");
    });

    it("handles includeUnit false and custom decimals", () => {
      expect(
        formatArea(15_000, "hectares", { decimals: 3, includeUnit: false }),
      ).toBe("1,500");
    });

    it("safely handles non-finite or negative inputs", () => {
      expect(formatArea(-10, "hectares")).toBe("0,00 m²");
      expect(formatArea(NaN, "alqueire_paulista")).toBe("0,00 m²");
    });

    it("throws RangeError for prototype property unit names", () => {
      expect(() =>
        formatArea(10_000, "toString" as unknown as AreaUnit),
      ).toThrow(RangeError);
      expect(() =>
        formatArea(10_000, "valueOf" as unknown as AreaUnit),
      ).toThrow(RangeError);
    });
  });

  describe("AREA_UNITS catalog metadata", () => {
    it("defines all required Brazilian and metric agrarian units", () => {
      expect(AREA_UNITS.hectares.squareMeters).toBe(10_000);
      expect(AREA_UNITS.alqueire_paulista.squareMeters).toBe(24_200);
      expect(AREA_UNITS.alqueire_mineiro.squareMeters).toBe(48_400);
      expect(AREA_UNITS.alqueire_baiano.squareMeters).toBe(96_800);
      expect(AREA_UNITS.alqueire_norte.squareMeters).toBe(27_200);
      expect(AREA_UNITS.square_meters.squareMeters).toBe(1);
      expect(AREA_UNITS.square_kilometers.squareMeters).toBe(1_000_000);
    });
  });

  describe("measurePointsAreaSquareMeters", () => {
    it("returns 0 when fewer than 3 points are provided", () => {
      expect(measurePointsAreaSquareMeters([])).toBe(0);
      expect(measurePointsAreaSquareMeters([{ lat: -15, lng: -47 }])).toBe(0);
      expect(
        measurePointsAreaSquareMeters([
          { lat: -15, lng: -47 },
          { lat: -15.1, lng: -47 },
        ]),
      ).toBe(0);
    });

    it("computes geodesic area from { lat, lng } points array", () => {
      // Triângulo em torno de Brasília
      const points = [
        { lat: -15.78, lng: -47.92 },
        { lat: -15.78, lng: -47.91 },
        { lat: -15.77, lng: -47.91 },
      ];
      const areaM2 = measurePointsAreaSquareMeters(points);
      expect(areaM2).toBeGreaterThan(500_000);
      expect(areaM2).toBeLessThan(1_500_000);
    });

    it("computes geodesic area from [lng, lat] GeoJSON coordinates", () => {
      const coords: [number, number][] = [
        [-47.92, -15.78],
        [-47.91, -15.78],
        [-47.91, -15.77],
      ];
      const areaM2 = measurePointsAreaSquareMeters(coords);
      expect(areaM2).toBeGreaterThan(500_000);
      expect(areaM2).toBeLessThan(1_500_000);
    });

    it("computes geodesic area from Coordinate objects { latitude, longitude }", () => {
      const coords = [
        { latitude: -15.78, longitude: -47.92 },
        { latitude: -15.78, longitude: -47.91 },
        { latitude: -15.77, longitude: -47.91 },
      ];
      const areaM2 = measurePointsAreaSquareMeters(coords);
      expect(areaM2).toBeGreaterThan(500_000);
      expect(areaM2).toBeLessThan(1_500_000);
    });

    it("safely handles non-array objects and hostile inputs returning 0", () => {
      expect(
        measurePointsAreaSquareMeters({ length: 4 } as unknown as [
          number,
          number,
        ][]),
      ).toBe(0);
      expect(
        measurePointsAreaSquareMeters(null as unknown as [number, number][]),
      ).toBe(0);
      expect(
        measurePointsAreaSquareMeters(
          undefined as unknown as [number, number][],
        ),
      ).toBe(0);
      expect(
        measurePointsAreaSquareMeters(
          "invalid" as unknown as [number, number][],
        ),
      ).toBe(0);
    });

    it("safely handles arrays with null, undefined or corrupted elements returning 0", () => {
      expect(
        measurePointsAreaSquareMeters([null, null, null] as unknown as [
          number,
          number,
        ][]),
      ).toBe(0);
      expect(
        measurePointsAreaSquareMeters([
          undefined,
          undefined,
          undefined,
        ] as unknown as [number, number][]),
      ).toBe(0);
      expect(
        measurePointsAreaSquareMeters([1, 2, 3] as unknown as [
          number,
          number,
        ][]),
      ).toBe(0);
      expect(
        measurePointsAreaSquareMeters([{}, {}, {}] as unknown as [
          number,
          number,
        ][]),
      ).toBe(0);
      expect(
        measurePointsAreaSquareMeters([
          { lat: -15.78, lng: -47.92 },
          null as unknown as { lat: number; lng: number },
          { lat: -15.77, lng: -47.91 },
        ]),
      ).toBe(0);
    });
  });
});
