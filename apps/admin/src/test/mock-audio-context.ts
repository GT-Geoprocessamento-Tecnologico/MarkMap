import { vi, type Mock } from "vitest";

export class MockAudioNode {
  connect: Mock = vi.fn();
  disconnect: Mock = vi.fn();
}

export class MockAudioParam {
  value = 1;
  setValueAtTime: Mock = vi.fn();
  exponentialRampToValueAtTime: Mock = vi.fn();
  linearRampToValueAtTime: Mock = vi.fn();
}

export class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

export class MockOscillatorNode extends MockAudioNode {
  type: OscillatorType = "sine";
  frequency = new MockAudioParam();
  start: Mock = vi.fn();
  stop: Mock = vi.fn();
  onended: (() => void) | null = null;
}

export class MockAudioContext {
  state: AudioContextState = "running";
  currentTime = 0;
  destination = new MockAudioNode();
  createdOscillators: MockOscillatorNode[] = [];
  createdGains: MockGainNode[] = [];

  createGain: Mock = vi.fn(() => {
    const gain = new MockGainNode();
    this.createdGains.push(gain);
    return gain;
  });

  createOscillator: Mock = vi.fn(() => {
    const osc = new MockOscillatorNode();
    this.createdOscillators.push(osc);
    return osc;
  });

  resume: Mock = vi.fn().mockResolvedValue(undefined);
  close: Mock = vi.fn().mockResolvedValue(undefined);
}

export function setupMockAudioContext(): {
  mockCtx: MockAudioContext;
  restore: () => void;
} {
  const mockCtx = new MockAudioContext();
  const originalAudioContext = window.AudioContext;

  function MockAudioContextConstructor(this: unknown) {
    return mockCtx;
  }

  Object.defineProperty(window, "AudioContext", {
    value: vi.fn(MockAudioContextConstructor),
    writable: true,
    configurable: true,
  });

  return {
    mockCtx,
    restore: () => {
      Object.defineProperty(window, "AudioContext", {
        value: originalAudioContext,
        writable: true,
        configurable: true,
      });
    },
  };
}
