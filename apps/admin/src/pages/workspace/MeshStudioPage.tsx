import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearch } from "@tanstack/react-router";
import { MeshCanvas } from "../../components/mesh/MeshCanvas";
import {
  getMesh,
  listMeshes,
  removeMesh,
  saveMesh,
  saveMeshView,
  type MeshRecord,
  type MeshView,
} from "../../lib/mesh/mesh-store";
import { MeshValidationError } from "../../lib/mesh/validation";

function viewFrom(record: MeshRecord): MeshView {
  return { ...record.view };
}

export default function MeshStudioPage() {
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const projectId =
    typeof params.projectId === "string" ? params.projectId : undefined;
  const requestedMeshId =
    typeof search.meshId === "string" ? search.meshId : undefined;
  const [meshes, setMeshes] = useState<MeshRecord[]>([]);
  const [selected, setSelected] = useState<MeshRecord | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [view, setView] = useState<MeshView>({
    camera: "perspective",
    wireframe: false,
    opacity: 1,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingViews, setPendingViews] = useState(0);
  const viewRef = useRef(view);
  const viewWrites = useRef<Promise<void>>(Promise.resolve());
  const loadSequence = useRef(0);
  const reload = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const rows = await listMeshes(projectId);
      if (sequence !== loadSequence.current) return;
      setMeshes(rows);
      const record = requestedMeshId
        ? (rows.find((item) => item.id === requestedMeshId) ?? null)
        : (rows[0] ?? null);
      if (requestedMeshId && !record)
        throw new Error(
          "A malha solicitada não está disponível nesta coleção.",
        );
      setSelected(record);
      if (record) {
        const stored = await getMesh(record.id);
        if (sequence !== loadSequence.current) return;
        if (!stored)
          throw new Error(
            "O arquivo da malha não está disponível neste dispositivo.",
          );
        setBlob(stored.blob);
        const restored = viewFrom(stored.record);
        viewRef.current = restored;
        setView(restored);
      } else setBlob(null);
      setMessage(null);
    } catch (error) {
      if (sequence === loadSequence.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível abrir o armazenamento local.",
        );
    }
  }, [projectId, requestedMeshId]);
  useEffect(() => {
    void reload();
    return () => {
      loadSequence.current += 1;
    };
  }, [reload]);
  const updateView = async (patch: Partial<MeshView>) => {
    if (!selected) return;
    const next = { ...viewRef.current, ...patch };
    viewRef.current = next;
    setView(next);
    setPendingViews((count) => count + 1);
    try {
      const meshId = selected.id;
      const write = viewWrites.current
        .catch(() => undefined)
        .then(() => saveMeshView(meshId, next));
      viewWrites.current = write;
      await write;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a visualização.",
      );
    } finally {
      setPendingViews((count) => count - 1);
    }
  };
  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      await saveMesh({ file, projectId });
      await reload();
    } catch (error) {
      setMessage(
        error instanceof MeshValidationError || error instanceof Error
          ? error.message
          : "Falha ao importar GLB.",
      );
    } finally {
      setBusy(false);
    }
  };
  const selectMesh = async (record: MeshRecord) => {
    const sequence = ++loadSequence.current;
    try {
      await viewWrites.current.catch(() => undefined);
      const stored = await getMesh(record.id);
      if (sequence !== loadSequence.current) return;
      setSelected(stored?.record ?? record);
      if (!stored)
        throw new Error(
          "O arquivo da malha não está disponível neste dispositivo.",
        );
      setBlob(stored?.blob ?? null);
      const restored = viewFrom(stored?.record ?? record);
      viewRef.current = restored;
      setView(restored);
      setMessage(null);
    } catch (error) {
      if (sequence === loadSequence.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível abrir a malha local.",
        );
    }
  };
  const deleteSelected = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await viewWrites.current.catch(() => undefined);
      await removeMesh(selected.id);
      await reload();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível remover a malha.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto bg-background p-4 text-on-surface md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Estúdio de Malhas 3D</h1>
          <p className="text-sm text-on-surface-variant">
            GLB local auto-contido · sem envio para a rede
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={projectId ? "/projects/$projectId" : "/projects"}
            params={projectId ? { projectId } : undefined}
            className="rounded border border-outline-variant px-3 py-2 text-sm"
          >
            Voltar
          </Link>
          <label className="cursor-pointer rounded-lg bg-gradient-to-r from-brand-blue to-brand-cyan px-3 py-2 text-sm font-semibold text-white hover:brightness-110">
            {busy ? "Processando..." : "Importar GLB"}
            <input
              className="sr-only"
              type="file"
              accept=".glb,model/gltf-binary"
              disabled={busy}
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </header>
      {selected && (
        <p role="status" className="text-xs text-on-surface-variant">
          {pendingViews > 0
            ? "Salvando visualização…"
            : message
              ? "Visualização não confirmada"
              : "Visualização salva neste dispositivo"}
        </p>
      )}
      {message && (
        <div
          role="alert"
          className="rounded border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200"
        >
          {message}
        </div>
      )}
      <div className="grid min-w-0 shrink-0 grid-rows-[360px_auto] gap-4 lg:min-h-[360px] lg:flex-1 lg:grid-cols-[16rem_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="order-last rounded-xl border border-outline-variant bg-surface-container p-3 lg:order-none">
          <h2 className="mb-2 text-xs font-semibold uppercase text-on-surface-variant">
            Malhas locais
          </h2>
          {meshes.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              Nenhum GLB importado.
            </p>
          ) : (
            <ul className="space-y-1">
              {meshes.map((item) => (
                <li key={item.id}>
                  <button
                    className={`w-full rounded p-2 text-left text-sm ${selected?.id === item.id ? "bg-cyan-500/20 text-cyan-300" : "hover:bg-on-surface/5"}`}
                    onClick={() => {
                      void selectMesh(item);
                    }}
                  >
                    {item.name}
                    <span className="block text-xs text-on-surface-variant">
                      {Math.round(item.sizeBytes / 1024)} KiB
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="relative order-first min-h-[360px] min-w-0 overflow-hidden rounded-xl border border-outline-variant bg-[#08121d] lg:order-none">
          {blob && selected ? (
            <MeshCanvas blob={blob} view={view} onError={setMessage} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">
              Selecione um GLB local para visualizar a geometria.
            </div>
          )}
          {selected && (
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-3 rounded-lg bg-black/60 p-3 text-xs backdrop-blur">
              <span>{selected.name}</span>
              <button
                className="ml-auto rounded border border-red-400/40 px-2 py-1 text-red-200"
                disabled={busy}
                onClick={() => {
                  void deleteSelected();
                }}
              >
                Excluir
              </button>
              <select
                aria-label="Vista da malha"
                className="rounded border border-outline-variant bg-surface-container px-2 text-on-surface"
                value={view.camera}
                onChange={(event) => {
                  void updateView({
                    camera: event.target.value as MeshView["camera"],
                  });
                }}
              >
                <option value="perspective">Perspectiva</option>
                <option value="top">Topo</option>
                <option value="front">Frente</option>
              </select>
              <label>
                Opacidade{" "}
                <input
                  aria-label="Opacidade"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={view.opacity}
                  onChange={(event) => {
                    void updateView({
                      opacity: Number(event.target.value),
                    });
                  }}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={view.wireframe}
                  onChange={(event) => {
                    void updateView({
                      wireframe: event.target.checked,
                    });
                  }}
                />{" "}
                Wireframe
              </label>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
