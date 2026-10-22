import { describe, it, expect, vi } from "vitest";
import { GnssDeviceAdapter } from "../../src/gnss/adapter.js";

describe("GNSS Device Adapter", () => {
  it("emits GnssFix event when valid NMEA chunk is pushed", () => {
    const adapter = new GnssDeviceAdapter();
    const fixListener = vi.fn();
    adapter.on("fix", fixListener);

    adapter.pushChunk("$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47\r\n");
    expect(fixListener).toHaveBeenCalledOnce();
    expect(fixListener.mock.calls[0]![0]!.latitude).toBeCloseTo(48.1173);
  });
});
