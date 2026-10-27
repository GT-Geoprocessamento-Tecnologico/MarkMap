import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  playBoundaryWarningSound,
  isBoundaryAudioMuted,
  setBoundaryAudioMuted,
  toggleBoundaryAudioMute,
  subscribeBoundaryAudioMute,
  resetBoundaryAudioThrottleForTests,
  resetBoundaryAudioContextForTests,
  initAudioOnUserGesture,
} from "./boundary-audio";
import {
  setupMockAudioContext,
  type MockAudioContext,
} from "../../test/mock-audio-context";

describe("boundary-audio Web Audio synthesis", () => {
  let audioContextScope: { mockCtx: MockAudioContext; restore: () => void };

  beforeEach(() => {
    localStorage.clear();
    setBoundaryAudioMuted(false);
    resetBoundaryAudioThrottleForTests();
    resetBoundaryAudioContextForTests();
    audioContextScope = setupMockAudioContext();
  });

  afterEach(() => {
    audioContextScope.restore();
    resetBoundaryAudioContextForTests();
    localStorage.clear();
  });

  it("plays dual-pulse approaching tone at 587.33Hz (D5)", async () => {
    await playBoundaryWarningSound("approaching", { force: true });

    const { mockCtx } = audioContextScope;
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
    expect(mockCtx.createGain).toHaveBeenCalledTimes(2);

    const osc1 = mockCtx.createdOscillators[0]!;
    expect(osc1.type).toBe("sine");
    expect(osc1.frequency.setValueAtTime).toHaveBeenCalledWith(
      587.33,
      expect.any(Number),
    );
    expect(osc1.start).toHaveBeenCalled();
    expect(osc1.stop).toHaveBeenCalled();

    const osc2 = mockCtx.createdOscillators[1]!;
    expect(osc2.type).toBe("sine");
    expect(osc2.frequency.setValueAtTime).toHaveBeenCalledWith(
      587.33,
      expect.any(Number),
    );
  });

  it("plays descending breach tone from 440Hz to 330Hz (A4 to E4)", async () => {
    await playBoundaryWarningSound("breach", { force: true });

    const { mockCtx } = audioContextScope;
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
    expect(mockCtx.createGain).toHaveBeenCalledTimes(1);

    const osc = mockCtx.createdOscillators[0]!;
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(
      440,
      expect.any(Number),
    );
    expect(osc.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      330,
      expect.any(Number),
    );
    expect(osc.start).toHaveBeenCalled();
  });

  it("respects muted state and does not create audio nodes when muted", async () => {
    setBoundaryAudioMuted(true);
    expect(isBoundaryAudioMuted()).toBe(true);
    expect(localStorage.getItem("markmap:boundary_audio_muted")).toBe("true");

    await playBoundaryWarningSound("approaching", { force: true });
    await playBoundaryWarningSound("breach", { force: true });

    const { mockCtx } = audioContextScope;
    expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    expect(mockCtx.createGain).not.toHaveBeenCalled();
  });

  it("toggles mute and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeBoundaryAudioMute(listener);

    const nextMute = toggleBoundaryAudioMute();
    expect(nextMute).toBe(true);
    expect(isBoundaryAudioMuted()).toBe(true);
    expect(listener).toHaveBeenCalledWith(true);

    const reverted = toggleBoundaryAudioMute();
    expect(reverted).toBe(false);
    expect(listener).toHaveBeenCalledWith(false);

    unsubscribe();
    toggleBoundaryAudioMute();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("enforces 15s throttle between same alerts unless force: true", async () => {
    const { mockCtx } = audioContextScope;

    // Disparo 1
    await playBoundaryWarningSound("approaching");
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);

    // Disparo 2 imediato (bloqueado por throttle)
    await playBoundaryWarningSound("approaching");
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);

    // Disparo 3 com force: true (reproduz)
    await playBoundaryWarningSound("approaching", { force: true });
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(4);

    // Transição para breach (tipo diferente: toca imediatamente)
    await playBoundaryWarningSound("breach");
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(5);
  });

  it("resumes audio context if suspended", async () => {
    const { mockCtx } = audioContextScope;
    mockCtx.state = "suspended";

    await playBoundaryWarningSound("breach", { force: true });
    expect(mockCtx.resume).toHaveBeenCalled();
  });

  it("unlocks audio context on user gesture", () => {
    const { mockCtx } = audioContextScope;
    mockCtx.state = "suspended";

    const cleanup = initAudioOnUserGesture();
    window.dispatchEvent(new Event("pointerdown"));

    expect(mockCtx.resume).toHaveBeenCalled();
    cleanup();
  });
});
