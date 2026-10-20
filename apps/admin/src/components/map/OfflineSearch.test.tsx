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
  postMessage(data: { type: string; requestId?: number; query?: string; records?: SearchWorker["records"] }) {
    if (data.type === "load") this.records = data.records ?? [];
    if (data.type === "search") {
      const text = (data.query ?? "").toLowerCase();
      const results = this.records.filter(item => item.normalized.includes(text));
      this.onmessage?.({ data: { requestId: data.requestId, results } } as MessageEvent);
    }
  }
  terminate() {}
}

class FailingSearchWorker extends SearchWorker {
  postMessage(data: Parameters<SearchWorker["postMessage"]>[0]) {
    if (data.type === "load") { this.records = data.records ?? []; return; }
    queueMicrotask(() => this.onerror?.());
  }
}

class PendingSearchWorker extends SearchWorker {
  postMessage(data: Parameters<SearchWorker["postMessage"]>[0]) {
    if (data.type === "load") this.records = data.records ?? [];
  }
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
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar no mapa offline" }));
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

  it("explains when the active map has no offline search index", async () => {
    render(<OfflineSearch open onClose={vi.fn()} onChoose={vi.fn()} records={[]} regionalCount={1} />);
    const input = screen.getByRole("searchbox", { name: "Pesquisar feições offline" });
    fireEvent.change(input, { target: { value: "Palmas" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("não possui índice de busca offline"));
  });

  it("falls back to the local index when workers cannot start", async () => {
    vi.stubGlobal("Worker", class { constructor() { throw new Error("worker unavailable"); } });
    const onChoose = vi.fn();
    render(<OfflineSearch open onClose={vi.fn()} onChoose={onChoose} records={[{
      id: "house2", name: "Avenida Tocantins, 20",
      normalized: "avenida tocantins 20", type: "Point", category: "address",
      lon: -48.2, lat: -7.2,
    }]} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Pesquisar feições offline" }), {
      target: { value: "Tocantins" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar no mapa offline" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Avenida Tocantins, 20" })).toBeTruthy());
  });

  it("shows an explicit empty state when the worker returns no matches", async () => {
    render(<OfflineSearch open onClose={vi.fn()} onChoose={vi.fn()} records={[{
      id: "house3", name: "Rua Central, 4", normalized: "rua central 4", type: "Point", category: "address", lon: -48, lat: -7,
    }]} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Pesquisar feições offline" }), { target: { value: "Praça inexistente" } });
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar no mapa offline" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Nenhum local encontrado"));
  });

  it("falls back when the worker fails during a pending search", async () => {
    vi.stubGlobal("Worker", FailingSearchWorker);
    render(<OfflineSearch open onClose={vi.fn()} onChoose={vi.fn()} records={[{
      id: "house4", name: "Rua Palmas, 8", normalized: "rua palmas 8", type: "Point", category: "address", lon: -48, lat: -7,
    }]} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Pesquisar feições offline" }), { target: { value: "Palmas" } });
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar no mapa offline" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Rua Palmas, 8" })).toBeTruthy());
  });

  it("searches automatically when records arrive after the query", async () => {
    const view = render(<OfflineSearch open onClose={vi.fn()} onChoose={vi.fn()} records={[]} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Pesquisar feições offline" }), { target: { value: "Tocantins" } });
    view.rerender(<OfflineSearch open onClose={vi.fn()} onChoose={vi.fn()} records={[{
      id: "house5", name: "Avenida Tocantins, 20", normalized: "avenida tocantins 20", type: "Point", category: "address", lon: -48, lat: -7,
    }]} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Avenida Tocantins, 20" })).toBeTruthy());
  });

  it("clears a pending search when the visible records disappear", async () => {
    vi.stubGlobal("Worker", PendingSearchWorker);
    const view = render(<OfflineSearch open onClose={vi.fn()} onChoose={vi.fn()} records={[{
      id: "house6", name: "Rua Palmas, 8", normalized: "rua palmas 8", type: "Point", category: "address", lon: -48, lat: -7,
    }]} />);
    const input = screen.getByRole("searchbox", { name: "Pesquisar feições offline" });
    fireEvent.change(input, { target: { value: "Palmas" } });
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar no mapa offline" }));
    view.rerender(<OfflineSearch open onClose={vi.fn()} onChoose={vi.fn()} records={[]} />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Não há nomes disponíveis"));
    expect(screen.getByRole("button", { name: "Pesquisar no mapa offline" })).not.toBeDisabled();
  });
});
