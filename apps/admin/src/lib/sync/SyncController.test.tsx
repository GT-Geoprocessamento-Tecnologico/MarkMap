import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const syncMock = vi.hoisted(() => vi.fn(async () => ({
  state: "synced" as const, pushed: 0, pulled: 0, conflicts: 0, pending: 0,
})));
vi.mock("./sync-engine", () => ({ syncNow: syncMock }));

import { SyncController } from "./SyncController";

beforeEach(() => {
  vi.stubGlobal("indexedDB", {});
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
  vi.useRealTimers();
  syncMock.mockClear();
});

it("syncs when the local repository emits the MarkMap mutation event", async () => {
  vi.useFakeTimers();
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <SyncController />
    </QueryClientProvider>,
  );
  await act(async () => { await Promise.resolve(); });
  const previous = syncMock.mock.calls.length;
  expect(previous).toBeGreaterThan(0);
  window.dispatchEvent(new Event("markmap-local-mutation"));
  await act(async () => { await vi.advanceTimersByTimeAsync(2501); });
  expect(syncMock.mock.calls.length).toBe(previous + 1);
  client.clear();
});

it("syncs a resolved conflict using the MarkMap event name", async () => {
  vi.useFakeTimers();
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <SyncController />
    </QueryClientProvider>,
  );
  await act(async () => { await Promise.resolve(); });
  const previous = syncMock.mock.calls.length;
  window.dispatchEvent(new Event("markmap-conflict-resolved"));
  await act(async () => { await vi.advanceTimersByTimeAsync(2501); });
  expect(syncMock.mock.calls.length).toBe(previous + 1);
  client.clear();
});
