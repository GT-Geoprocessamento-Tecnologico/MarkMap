import { describe, expect, it } from "vitest";
import { TrackRecorder } from "../../src/tracks/recorder.js";

describe("TrackRecorder - Real-time Track Recording", () => {
  it("records GPS points only when active", () => {
    const recorder = new TrackRecorder({
      id: "trk-01",
      name: "Trilha da Serra",
      startTime: 1000,
    });

    const p1 = { lat: -23.5, lon: -46.6, alt: 750, timestamp: 1000 };
    const p2 = { lat: -23.5001, lon: -46.6001, alt: 755, timestamp: 1200 };

    // Point before start should be ignored
    expect(recorder.addPoint(p1)).toBeNull();
    expect(recorder.getTrack()).toHaveLength(0);

    // Start recording
    recorder.start();
    recorder.addPoint(p1);
    recorder.addPoint(p2);

    expect(recorder.getTrack()).toHaveLength(2);

    // Stop recording
    const finalTrack = recorder.stop();
    expect(finalTrack).toHaveLength(2);

    // Point after stop should be ignored
    expect(recorder.addPoint(p2)).toBeNull();
  });
});
