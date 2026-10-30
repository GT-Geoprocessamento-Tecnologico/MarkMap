import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProjectMapFeature } from "../../pages/workspace/map-data";
import {
  deleteLocalFeature,
  listLocalFeatures,
  updateLocalFeature,
} from "../../lib/hooks/features";
import {
  filterProjectPoints,
  projectPointTitle,
  updatedPointProperties,
} from "./project-point-model.mjs";

interface ProjectPointsPanelProps {
  projectId: string;
  features: readonly ProjectMapFeature[];
  selectionRequest?: { id: string } | null;
  onLocate: (coordinates: [number, number]) => void;
  onChanged: () => void | Promise<unknown>;
}

const MAX_VISIBLE_POINTS = 100;

/** Operates only on project-owned features, never on imported dataset vertices. */
export function ProjectPointsPanel({
  projectId,
  features,
  selectionRequest,
  onLocate,
  onChanged,
}: ProjectPointsPanelProps) {
  const lastAppliedRequest = useRef<{ id: string } | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openedSnapshot, setOpenedSnapshot] = useState<{ name: unknown; description: unknown } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const points = useMemo(() => filterProjectPoints(features, query), [features, query]);
  const selected = useMemo(
    () => filterProjectPoints(features).find((item) => item.id === selectedId) ?? null,
    [features, selectedId],
  );

  const choose = useCallback((point: ProjectMapFeature) => {
    setSelectedId(String(point.id));
    setName(projectPointTitle(point));
    setDescription(typeof point.properties?.description === "string" ? point.properties.description : "");
    setError(null);
    setNotice(null);
    setConfirmDelete(false);
    setOpenedSnapshot({ name: point.properties?.name, description: point.properties?.description });
  }, []);

  useEffect(() => {
    if (!selectionRequest || lastAppliedRequest.current === selectionRequest) return;
    const point = filterProjectPoints(features).find((item) => item.id === selectionRequest.id);
    if (!point) return;
    lastAppliedRequest.current = selectionRequest;
    choose(point);
  }, [features, selectionRequest, choose]);

  const latestPoint = async () => {
    if (!selected) throw new Error("Selecione um ponto do projeto.");
    const found = (await listLocalFeatures(selected.layerId)).find((item) => item.id === selected.id);
    if (!found || found.geometry.type !== "Point" || found.layerId !== selected.layerId) {
      throw new Error("O ponto foi alterado ou removido. Reabra o projeto.");
    }
    if (!openedSnapshot || found.properties.name !== openedSnapshot.name ||
        found.properties.description !== openedSnapshot.description) {
      throw new Error("O ponto mudou desde que a ficha foi aberta. Reabra para editar ou excluir.");
    }
    return found;
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const point = await latestPoint();
      const properties = updatedPointProperties(point.properties, name, description);
      await updateLocalFeature({ id: point.id, version: point.version, properties });
      await onChanged();
      setOpenedSnapshot({ name: properties.name, description: properties.description });
      setNotice("Ponto atualizado neste dispositivo.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o ponto.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy || !confirmDelete) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const point = await latestPoint();
      await deleteLocalFeature(point.id);
      await onChanged();
      setSelectedId(null);
      setOpenedSnapshot(null);
      setConfirmDelete(false);
      setNotice("Ponto excluído; alteração registrada para sincronização.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir o ponto.");
    } finally {
      setBusy(false);
    }
  };

  const locate = () => {
    if (selected?.geometry?.type !== "Point") return;
    const coords = selected.geometry.coordinates;
    if (!Array.isArray(coords) || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return;
    onLocate([coords[0] as number, coords[1] as number]);
  };

  return (
    <section className="min-w-0 max-w-full space-y-4 px-4 py-4 text-on-surface" aria-label="Gerenciar pontos do projeto">
      {!projectId ? (
        <p role="status" className="text-sm text-on-surface-variant">Abra o mapa a partir de um projeto para gerenciar seus pontos.</p>
      ) : (
        <>
          <label className="block min-w-0 text-sm font-medium">
            Buscar pontos do projeto
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome ou descrição"
              className="mt-2 block w-full min-w-0 max-w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-3 text-sm" />
          </label>
          <p className="text-xs text-on-surface-variant" role="status">
            {points.length} ponto(s) encontrado(s){points.length > MAX_VISIBLE_POINTS ? ` — exibindo ${MAX_VISIBLE_POINTS}; refine a busca` : ""}.
          </p>
          {!points.length && (
            <p className="rounded-lg border border-outline-variant p-3 text-sm text-on-surface-variant">
              Nenhum ponto encontrado. Use “Adicionar ponto” no mapa para marcar um local.
            </p>
          )}
          <ul aria-label="Pontos salvos do projeto" className="max-h-44 space-y-1 overflow-y-auto overscroll-contain">
            {points.slice(0, MAX_VISIBLE_POINTS).map((point) => (
              <li key={String(point.id)}>
                <button type="button" onClick={() => choose(point)}
                  className="min-h-[44px] w-full min-w-0 rounded-lg border border-outline-variant px-3 py-2 text-left text-sm hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary"
                  aria-pressed={selectedId === String(point.id)}>
                  <span className="block break-words font-semibold [overflow-wrap:anywhere]">{projectPointTitle(point)}</span>
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <div className="min-w-0 space-y-3 rounded-xl border border-outline-variant bg-surface-container p-3">
              <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">Ficha do ponto</p>
              {selected.geometry?.type === "Point" && (
                <p className="break-all font-mono text-xs text-on-surface-variant">
                  {Number(selected.geometry.coordinates[1]).toFixed(6)}, {Number(selected.geometry.coordinates[0]).toFixed(6)}
                </p>
              )}
              <label className="block text-sm font-medium">Nome do ponto
                <input value={name} maxLength={120} onChange={(event) => setName(event.target.value)}
                  className="mt-1 block w-full min-w-0 rounded-lg border border-outline-variant bg-background px-3 py-3" />
              </label>
              <label className="block text-sm font-medium">Descrição / observações
                <textarea value={description} maxLength={1200} rows={3} onChange={(event) => setDescription(event.target.value)}
                  className="mt-1 block w-full min-w-0 max-w-full resize-y rounded-lg border border-outline-variant bg-background px-3 py-3" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={locate} disabled={busy}
                  className="min-h-[44px] rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold">Localizar</button>
                <button type="button" onClick={() => void save()} disabled={busy || !name.trim()}
                  className="min-h-[44px] rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-on-secondary disabled:opacity-50">
                  {busy ? "Salvando…" : "Salvar alterações"}
                </button>
                {!confirmDelete ? (
                  <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)}
                    className="min-h-[44px] rounded-lg border border-error px-3 py-2 text-sm text-error">Excluir ponto</button>
                ) : (
                  <>
                    <button type="button" disabled={busy} onClick={() => void remove()}
                      className="min-h-[44px] rounded-lg bg-error px-3 py-2 text-sm font-semibold text-on-error">Confirmar exclusão</button>
                    <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}
                      className="min-h-[44px] rounded-lg border border-outline-variant px-3 py-2 text-sm">Cancelar</button>
                  </>
                )}
              </div>
            </div>
          )}
          {notice && <p role="status" className="break-words text-sm text-secondary">{notice}</p>}
          {error && <p role="alert" className="break-words text-sm text-error">{error}</p>}
        </>
      )}
    </section>
  );
}