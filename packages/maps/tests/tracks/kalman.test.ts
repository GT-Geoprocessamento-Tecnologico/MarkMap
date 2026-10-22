import { describe, expect, it } from "vitest";
import { SimpleKalmanFilter, TrackKalmanEngine, type RawPoint } from "../../src/tracks/kalman.js";

describe("Kalman Filter for GPS Track Smoothing", () => {
  it("initializes with the first measurement without filtering", () => {
    const kf = new SimpleKalmanFilter();
    const result = kf.filter(10.5);
    expect(result).toBeCloseTo(10.5, 4);
  });

  it("smooths noisy measurements toward the true value", () => {
    const kf = new SimpleKalmanFilter(0.001, 1);
    const results: number[] = [];
    // Simulate measurement around true value 10 with noise
    for (let i = 0; i < 50; i++) {
      results.push(kf.filter(10 + (Math.random() - 0.5) * 4));
    }
    // Last 10 values should be closer to 10 than first 10
    const firstAvg = results.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    const lastAvg = results.slice(-10).reduce((a, b) => a + b, 0) / 10;
    expect(Math.abs(lastAvg - 10)).toBeLessThan(Math.abs(firstAvg - 10));
  });

  it("resets to a new initial value", () => {
    const kf = new SimpleKalmanFilter();
    kf.filter(100);
    kf.reset(0);
    expect(kf.filter(0)).toBeCloseTo(0, 4);
  });
});

describe("TrackKalmanEngine - 2D GPS point smoothing", () => {
  const makePoint = (lat: number, lon: number, alt: number, ts: number): RawPoint => ({
    lat,
    lon,
    alt,
    timestamp: ts,
  });

  it("filters first point as-is and marks filtered", () => {
    const engine = new TrackKalmanEngine();
    const p = engine.processPoint(makePoint(-23.5, -46.6, 750, 1000));
    expect(p.lat).toBeCloseTo(-23.5);
    expect(p.lon).toBeCloseTo(-46.6);
    expect(p.filtered).toBe(true);
  });

  it("applies Kalman smoothing to subsequent points with sufficient time delta", () => {
    const engine = new TrackKalmanEngine(0.0001, 10);
    engine.processPoint(makePoint(-23.5, -46.6, 750, 1000));
    const p1 = engine.processPoint(makePoint(-23.5001, -46.6001, 755, 1200));
    expect(p1.filtered).toBe(true);
    // Filtered values should not exactly equal raw values (noise reduced)
    expect(p1.lat).not.toBe(-23.5001);
    expect(p1.lon).not.toBe(-46.6001);
  });

  it("does not filter points too close in time (anti-jitter)", () => {
    const engine = new TrackKalmanEngine();
    engine.processPoint(makePoint(-23.5, -46.6, 750, 1000));
    const p = engine.processPoint(makePoint(-23.5001, -46.6001, 755, 1050));
    expect(p.filtered).toBe(false);
  });

  it("accumulates smoothed track points and allows clearing", () => {
    const engine = new TrackKalmanEngine();
    engine.processPoint(makePoint(-23.5, -46.6, 750, 1000));
    engine.processPoint(makePoint(-23.5001, -46.6001, 755, 1200));

    const track = engine.getTrack();
    expect(track).toHaveLength(2);
    expect(track[0].lat).toBeCloseTo(-23.5);

    engine.clear();
    expect(engine.getTrack()).toHaveLength(0);
  });
});