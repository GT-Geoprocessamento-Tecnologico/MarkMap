import { describe, it, expect } from 'vitest';
import {
  parseCoordinateSearch,
  formatCoordinate,
  geodesicDistanceM,
  initialBearingDeg,
  destinationPoint,
  geodesicPolygonAreaM2,
  calculateNavigationState,
  positionSampleFromBrowser,
} from '../src/index.js';

describe('High-Precision Geo Modules', () => {
  describe('coordinates.ts', () => {
    it('parses dot decimal coordinates correctly', () => {
      const res = parseCoordinateSearch('-20.397, -43.510');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.coordinate.latitude).toBe(-20.397);
        expect(res.coordinate.longitude).toBe(-43.510);
      }
    });

    it('parses Brazilian format (comma decimal with semicolon separator)', () => {
      const res = parseCoordinateSearch('-20,397; -43,510');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.coordinate.latitude).toBe(-20.397);
        expect(res.coordinate.longitude).toBe(-43.510);
      }
    });

    it('formats coordinates with locale support and custom precision', () => {
      const coord = { latitude: -20.3971234, longitude: -43.5101234 };
      const formattedPt = formatCoordinate(coord, { locale: 'pt-BR', decimalPlaces: 4 });
      expect(formattedPt).toBe('-20,3971; -43,5101');
    });
  });

  describe('geodesy.ts', () => {
    it('calculates exact Haversine distance between two coordinates', () => {
      const p1 = { latitude: -20.397, longitude: -43.510 };
      const p2 = { latitude: -20.400, longitude: -43.510 };
      const dist = geodesicDistanceM(p1, p2);
      expect(dist).toBeGreaterThan(300);
      expect(dist).toBeLessThan(350);
    });

    it('calculates initial bearing and destination point accurately', () => {
      const origin = { latitude: 0, longitude: 0 };
      const bearing = initialBearingDeg(origin, { latitude: 0, longitude: 1 });
      expect(bearing).toBeCloseTo(90, 1);

      const dest = destinationPoint(origin, 1000, 90);
      expect(dest.latitude).toBeCloseTo(0, 4);
      expect(dest.longitude).toBeGreaterThan(0);
    });

    it('calculates geodesic polygon area', () => {
      const polygon = [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 0.01 },
        { latitude: 0.01, longitude: 0.01 },
        { latitude: 0.01, longitude: 0 },
      ];
      const area = geodesicPolygonAreaM2(polygon);
      expect(area).toBeGreaterThan(1_000_000);
    });
  });

  describe('navigation.ts', () => {
    it('computes navigation state and arrival status', () => {
      const current = { latitude: -20.397, longitude: -43.510 };
      const destination = { latitude: -20.3971, longitude: -43.5101 };

      const state = calculateNavigationState(current, destination, {
        arrivalRadiusM: 50,
        accuracyM: 5,
        currentHeadingDeg: 180,
      });

      expect(state.arrived).toBe(true);
      expect(state.arrivalStatus).toBe('arrived');
      expect(state.turnAngleDeg).not.toBeNull();
    });
  });

  describe('location.ts', () => {
    it('validates and converts browser GeolocationPosition accurately', () => {
      const mockPos = {
        coords: {
          latitude: -20.397,
          longitude: -43.510,
          accuracy: 5,
          altitude: 800,
          altitudeAccuracy: 2,
          heading: 180,
          speed: 1.5,
        },
        timestamp: Date.now(),
      };

      const sample = positionSampleFromBrowser(mockPos);
      expect(sample.latitude).toBe(-20.397);
      expect(sample.longitude).toBe(-43.510);
      expect(sample.source).toBe('browser-foreground');
    });

    it('rejects stale or out of bounds positions', () => {
      const invalidPos = {
        coords: {
          latitude: 999, // Out of bounds
          longitude: -43.510,
          accuracy: 5,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      };

      expect(() => positionSampleFromBrowser(invalidPos)).toThrow();
    });
  });
});
