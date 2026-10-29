import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OfflineSearch } from "./OfflineSearch";

type OnlineResult = { id: string; label: string; lat: number; lon: number; source?: string };
const onlineSearch = vi.fn(async (_query: string, _signal?: AbortSignal): Promise<OnlineResult[]> => []);
vi.mock("../../lib/search/address-geocoder", () => ({
  configuredAddressSearchEndpoint: () => "/api/address-search",
  searchAddressOnline: (query: string, signal?: AbortSignal) => onlineSearch(query, signal),
}));

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

class DelayedSearchWorker extends SearchWorker {
  postMessage(data: Parameters<SearchWorker["postMessage"]>[0]) {
    if (data.type === "load") this.records = data.records ?? [];
    if (data.type === "search") setTimeout(() => {
      const text = (data.query ?? "").toLowerCase();
      this.onmessage?.({ data: { requestId: data.requestId, results: this.records.filter(item => item.normalized.includes(text)) } } as MessageEvent);
    }, 220);
  }
}

describe("address search panel", () => {
  beforeEach(() => vi.stubGlobal("Worker", SearchWorker));
  afterEach(() => { cleanup(); onlineSearch.mockClear(); vi.unstubAllGlobals(); });

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
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
    await waitFor(() => expect(screen.getByRole("button", {
      name: "Rua das Flores, 200",
    })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Rua das Flores, 200" }));
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ lon: -48.1, lat: -7.2 }));
  });

  it("keeps one submit control and does not expose a separate online button", () => {
    render(<OfflineSearch open onClose={vi.fn()} onChoose={vi.fn()} records={[]} />);
    expect(screen.queryByRole("button", { name: "Buscar endereço na internet" })).toBeNull();
    expect(screen.getByRole("button", { name: "Pesquisar" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Organic Maps Project" })).toBeTruthy();
  });

  it("enriches local search automatically on one submit", async () => {
    onlineSearch.mockResolvedValueOnce([{ id: "remote-1", label: "Avenida Online, Araguaína", lat: -7.19, lon: -48.2, source: "BrasilAPI" }]);
    render(<OfflineSearch open onClose={vi.fn()} onChoose={vi.fn()} records={[]} />);
    const input = screen.getByRole("searchbox", { name: "Pesquisar feições offline" });
    fireEvent.change(input, { target: { value: "77800-000" } });
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Avenida Online, Araguaína" })).toBeTruthy());
    expect(onlineSearch).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/BrasilAPI/)).toBeTruthy();
    expect(screen.queryByText(/Photon/)).toBeNull();
  });

  it("keeps local hits while a slow online submit outlives the local debounce", async () => {
    let resolveOnline!: (value: OnlineResult[]) => void;
    onlineSearch.mockImplementationOnce(() => new Promise(resolve => { resolveOnline = resolve; }));
    render(<OfflineSearch open onClose={vi.fn()} onChoose={vi.fn()} records={[{
      id: "local-slow", name: "Rua Local, 1", normalized: "rua local 1", type: "Point", category: "address", lon: -48, lat: -7,
    }]} />);
    const input = screen.getByRole("searchbox", { name: "Pesquisar feições offline" });
    fireEvent.change(input, { target: { value: "Rua Local" } });
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Rua Local, 1" })).toBeTruthy());
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 220));
      resolveOnline([{ id: "remote-slow", label: "Rua Remota, 2", lat: -7.2, lon: -48.2 }]);
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Rua Remota, 2" })).toBeTruthy());
    expect(screen.getByRole("button", { name: "Rua Local, 1" })).toBeTruthy();
    expect(onlineSearch).toHaveBeenCalledTimes(1);
  });

  it("ignores a delayed worker reply for a query that was edited", async () => {
    vi.stubGlobal("Worker", DelayedSearchWorker);
    render(<OfflineSearch open onClose={vi.fn()} onChoose={vi.fn()} records={[{
      id: "old", name: "Rua Antiga", normalized: "rua antiga", type: "Point", category: "address", lon: -48, lat: -7,
    }, {
      id: "new", name: "Rua Nova", normalized: "rua nova", type: "Point", category: "address", lon: -48.1, lat: -7.1,
    }]} />);
    const input = screen.getByRole("searchbox", { name: "Pesquisar feições offline" });
    fireEvent.change(input, { target: { value: "Antiga" } });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 180));
    });
    fireEvent.change(input, { target: { value: "Nova" } });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 260));
    });
    expect(screen.queryByRole("button", { name: "Rua Antiga" })).toBeNull();
  });

  it("keeps local hits visible when online enrichment fails", async () => {
    onlineSearch.mockRejectedValueOnce(new Error("Sem internet. Use os locais do mapa baixado."));
    render(<OfflineSearch open onClose={vi.fn()} onChoose={vi.fn()} records={[{
      id: "local-error", name: "Rua Local", normalized: "rua local", type: "Point", category: "address", lon: -48, lat: -7,
    }]} />);
    const input = screen.getByRole("searchbox", { name: "Pesquisar feições offline" });
    fireEvent.change(input, { target: { value: "Rua Local" } });
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Rua Local" })).toBeTruthy());
    expect(screen.queryByText("Sem internet. Use os locais do mapa baixado.")).toBeNull();
  });

  it("aborts online enrichment when unmounted", async () => {
    let receivedSignal!: AbortSignal;
    onlineSearch.mockImplementationOnce((_query, signal) => { receivedSignal = signal!; return new Promise<OnlineResult[]>(() => undefined); });
    const view = render(<OfflineSearch open onClose={vi.fn()} onChoose={vi.fn()} records={[]} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Pesquisar feições offline" }), { target: { value: "Rua Longe" } });
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
    await waitFor(() => expect(receivedSignal).toBeTruthy());
    view.unmount();
    expect(receivedSignal.aborted).toBe(true);
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
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Avenida Tocantins, 20" })).toBeTruthy());
  });

  it("shows an explicit empty state when the worker returns no matches", async () => {
    render(<OfflineSearch open onClose={vi.fn()} onChoose={vi.fn()} records={[{
      id: "house3", name: "Rua Central, 4", normalized: "rua central 4", type: "Point", category: "address", lon: -48, lat: -7,
    }]} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Pesquisar feições offline" }), { target: { value: "Praça inexistente" } });
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Nenhum local encontrado"));
  });

  it("falls back when the worker fails during a pending search", async () => {
    vi.stubGlobal("Worker", FailingSearchWorker);
    render(<OfflineSearch open onClose={vi.fn()} onChoose={vi.fn()} records={[{
      id: "house4", name: "Rua Palmas, 8", normalized: "rua palmas 8", type: "Point", category: "address", lon: -48, lat: -7,
    }]} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Pesquisar feições offline" }), { target: { value: "Palmas" } });
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
    view.rerender(<OfflineSearch open onClose={vi.fn()} onChoose={vi.fn()} records={[]} />);
    await waitFor(() => expect(screen.getByText("Não há nomes disponíveis na área exibida. Aproxime ou mova o mapa para carregar mais ruas.")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Pesquisar" })).not.toBeDisabled();
  });
});
