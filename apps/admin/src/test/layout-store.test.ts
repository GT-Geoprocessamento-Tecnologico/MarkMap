import { describe, it, expect } from "vitest";
import { useLayoutStore } from "../lib/store/layout";

describe("useLayoutStore", () => {
  it("should initialize with dashboard mode and mobile sidebar closed", () => {
    const { mode, sidebarOpen } = useLayoutStore.getState();
    expect(mode).toBe("dashboard");
    expect(sidebarOpen).toBe(false);
  });

  it("should toggle sidebar", () => {
    useLayoutStore.getState().toggleSidebar();
    expect(useLayoutStore.getState().sidebarOpen).toBe(true);
  });

  it("should set mode", () => {
    useLayoutStore.getState().setMode("canvas");
    expect(useLayoutStore.getState().mode).toBe("canvas");
  });
});
