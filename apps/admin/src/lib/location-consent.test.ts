import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  granted: vi.fn(),
}));
vi.mock("./storage/offline-db", () => ({
  offlineDB: { get: mocks.get, save: mocks.save },
}));
vi.mock("./device-location-permission", () => ({
  isLocationPermissionGranted: mocks.granted,
}));
import {
  getFreshDevicePosition,
  isInsideOfflineRegion,
  rememberLocationApproval,
  shouldAutoLocateOnOpen,
} from "./location-consent";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.get.mockResolvedValue(null);
  mocks.save.mockResolvedValue(undefined);
  mocks.granted.mockResolvedValue(false);
});
afterEach(() => vi.unstubAllGlobals());

describe("local GPS choice and device authority", () => {
  it("does not ask for GPS before any permission", async () => {
    expect(await shouldAutoLocateOnOpen()).toBe(false);
    expect(mocks.granted).toHaveBeenCalledOnce();
  });
  it("accepts legacy records but stores only a preference, never coordinates", async () => {
    mocks.get.mockResolvedValue({ status: "granted", lat: -15, lng: -48 });
    mocks.granted.mockResolvedValue(true);
    expect(await shouldAutoLocateOnOpen()).toBe(true);
    await rememberLocationApproval();
    expect(mocks.save).toHaveBeenCalledWith("permissions", "gps", {
      status: "granted",
      autoCenter: true,
    });
  });
  it("does not trust old permission after OS revocation", async () => {
    mocks.get.mockResolvedValue({ status: "granted", autoCenter: true });
    expect(await shouldAutoLocateOnOpen()).toBe(false);
  });
  it("respects an explicit local opt-out", async () => {
    mocks.get.mockResolvedValue({ status: "granted", autoCenter: false });
    mocks.granted.mockResolvedValue(true);
    expect(await shouldAutoLocateOnOpen()).toBe(false);
    expect(mocks.granted).not.toHaveBeenCalled();
  });
  it("can use an OS grant even if IndexedDB is blocked", async () => {
    mocks.get.mockRejectedValue(new Error("IndexedDB unavailable"));
    mocks.granted.mockResolvedValue(true);
    expect(await shouldAutoLocateOnOpen()).toBe(true);
  });
  it("requests a current, high accuracy GPS fix without network access", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({
        coords: { latitude: -7.18, longitude: -48.22, accuracy: 13 },
      } as GeolocationPosition),
    );
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    await expect(getFreshDevicePosition()).resolves.toEqual({
      lat: -7.18,
      lon: -48.22,
      accuracyM: 13,
    });
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  });
  it("leaves viewport untouched after sensor errors or invalid coordinates", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (
          _: PositionCallback,
          error: PositionErrorCallback,
        ) => error({} as GeolocationPositionError),
      },
    });
    await expect(getFreshDevicePosition()).resolves.toBeNull();
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) =>
          success({
            coords: { latitude: 999, longitude: 0, accuracy: 10 },
          } as GeolocationPosition),
      },
    });
    await expect(getFreshDevicePosition()).resolves.toBeNull();
  });
  it("keeps regional offline tiles visible when GPS is outside coverage", () => {
    const bounds = [-49, -8, -47, -6] as const;
    expect(
      isInsideOfflineRegion({ lon: -48, lat: -7, accuracyM: 10 }, bounds),
    ).toBe(true);
    expect(
      isInsideOfflineRegion({ lon: -50, lat: -7, accuracyM: 10 }, bounds),
    ).toBe(false);
    expect(
      isInsideOfflineRegion({ lon: -50, lat: -7, accuracyM: 10 }, null),
    ).toBe(true);
  });
});
