import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OfflineSearch } from "./OfflineSearch";

vi.mock("./MapOfflinePanel", () => ({
  MapOfflinePanel: ({ open, title, children }: {
    open: boolean; title: string; children: React.ReactNode;
  }) => open ? <section aria-label={title}>{children}</section> : null,
}));

class SearchWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  records: Array<{ id: string; name: string; normalized: string; lon: number; lat: number; category: string }> = [];
  postMessage(data: { type: string; requestId?: number; query?: string; records?: typeof this.records }) {
    if (data.type === "load") this.records = data.records ?? [];
    if (data.type === "search") {
      const text = (data.query ?? "").toLowerCase();
      const results = this.records.filter(item => item.normalized.includes(text));
      this.onmessage?.({ data: { requestId: data.requestId, results } } as MessageEvent);
    }
  }
  terminate() {}
}

describe("address search panel", () => {
  beforeEach(() => vi.stubGlobal("Worker", SearchWorker));
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("finds locally saved street addresses without network requests", async () => {
    const onChoose = vi.fn();
    render(<OfflineSearch open onClose={vi.fn()} onChoose={onChoose} records={[{
      id: "house1", name: "Rua das Flores, 200",
      normalized: "rua das flores 200", type: "Point", category: "address",
      lon: -48.1, lat: -7.2,
    }]} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Pesquisar feições offline" }), {
      target: { value: "Rua das Flores 200" },
    });
    await waitFor(() => expect(screen.getByRole("button", {
      name: "Rua das Flores, 200",
    })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Rua das Flores, 200" }));
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ lon: -48.1, lat: -7.2 }));
  });

  it("does not expose an online search button without a licensed provider", () => {
    render(<OfflineSearch open onClose={vi.fn()} onChoose={vi.fn()} records={[]} />);
    expect(screen.queryByRole("button", { name: "Buscar endereço na internet" })).toBeNull();
  });
});
