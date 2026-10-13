import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureLocationPermission, isLocationPermissionGranted } from "./device-location-permission";

const checkPermissions = vi.fn();
const requestPermissions = vi.fn();

vi.mock("@capacitor/geolocation", () => ({
  Geolocation: { checkPermissions, requestPermissions },
}));

interface CapacitorStub {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

const setCapacitorGlobal = (value: CapacitorStub | undefined): void => {
  if (value === undefined) {
    delete (window as unknown as { Capacitor?: CapacitorStub }).Capacitor;
    return;
  }
  (window as unknown as { Capacitor?: CapacitorStub }).Capacitor = value;
};

describe("ensureLocationPermission", () => {
  beforeEach(() => {
    checkPermissions.mockReset();
    requestPermissions.mockReset();
    setCapacitorGlobal(undefined);
  });

  afterEach(() => {
    setCapacitorGlobal(undefined);
    vi.unstubAllGlobals();
  });

  it("resolves granted on the web without touching the native plugin", async () => {
    await expect(ensureLocationPermission()).resolves.toEqual({ state: "granted" });
    expect(checkPermissions).not.toHaveBeenCalled();
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("treats a Capacitor global reporting web as a no-op", async () => {
    setCapacitorGlobal({ isNativePlatform: () => false });
    await expect(ensureLocationPermission()).resolves.toEqual({ state: "granted" });
    expect(checkPermissions).not.toHaveBeenCalled();
  });

  it("detects the native shell from getPlatform when isNativePlatform is absent", async () => {
    setCapacitorGlobal({ getPlatform: () => "android" });
    checkPermissions.mockResolvedValue({ location: "granted" });

    await expect(ensureLocationPermission()).resolves.toEqual({ state: "granted" });
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("requests the permission natively when it is still unresolved", async () => {
    setCapacitorGlobal({ isNativePlatform: () => true });
    checkPermissions.mockResolvedValue({ location: "prompt" });
    requestPermissions.mockResolvedValue({ location: "granted" });

    await expect(ensureLocationPermission()).resolves.toEqual({ state: "granted" });
    expect(requestPermissions).toHaveBeenCalledWith({ permissions: ["location"] });
  });

  it("reports denied when the user refuses the native prompt", async () => {
    setCapacitorGlobal({ isNativePlatform: () => true });
    checkPermissions.mockResolvedValue({ location: "prompt" });
    requestPermissions.mockResolvedValue({ location: "denied" });

    await expect(ensureLocationPermission()).resolves.toEqual({
      state: "denied",
      reason: "denied",
    });
  });

  it("does not re-prompt once the user has permanently denied", async () => {
    setCapacitorGlobal({ isNativePlatform: () => true });
    checkPermissions.mockResolvedValue({ location: "denied" });

    await expect(ensureLocationPermission()).resolves.toEqual({
      state: "denied",
      reason: "denied",
    });
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("reads native authorization without requesting a second prompt", async () => {
    setCapacitorGlobal({ isNativePlatform: () => true });
    checkPermissions.mockResolvedValue({ location: "granted" });
    await expect(isLocationPermissionGranted()).resolves.toBe(true);
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("respects a revoked native authorization", async () => {
    setCapacitorGlobal({ isNativePlatform: () => true });
    checkPermissions.mockResolvedValue({ location: "denied" });
    await expect(isLocationPermissionGranted()).resolves.toBe(false);
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("reads browser permission without calling the GPS API", async () => {
    const query = vi.fn().mockResolvedValue({ state: "granted" });
    vi.stubGlobal("navigator", { geolocation: {}, permissions: { query } });
    await expect(isLocationPermissionGranted()).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith({ name: "geolocation" });
  });

  it("reports unavailable when the system location service is disabled", async () => {
    setCapacitorGlobal({ isNativePlatform: () => true });
    checkPermissions.mockRejectedValue(new Error("location services disabled"));

    await expect(ensureLocationPermission()).resolves.toEqual({
      state: "denied",
      reason: "unavailable",
    });
  });
});