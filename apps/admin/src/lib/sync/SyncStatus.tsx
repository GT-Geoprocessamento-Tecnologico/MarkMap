import { useEffect, useState } from "react";
import type { SyncConflict } from "@geonexo/contracts";

import { API_MODE } from "../api-client";
import { localRepository } from "../local-repositories";
import { syncNow, type SyncResult } from "./sync-engine";

const initialState = (): SyncResult => ({
  state:
    API_MODE !== "live"
      ? "disabled"
      : typeof navigator !== "undefined" && navigator.onLine === false
        ? "offline"
        : "idle",
  pushed: 0,
  pulled: 0,
  conflicts: 0,
  pending: 0,
});

const label = (status: SyncResult): string => {
  if (status.state === "disabled") return "Somente neste aparelho";
  if (status.state === "offline") return "Offline — salvo neste aparelho";
  if (status.state === "syncing") return "Sincronizando…";
  if (status.state === "error") return "Não foi possível sincronizar";
  if (status.conflicts > 0)
    return `${status.conflicts} conflito${status.conflicts === 1 ? "" : "s"} para revisar`;
  if (status.pending > 0)
    return `${status.pending} alteração${status.pending === 1 ? "" : "ões"} pendente${status.pending === 1 ? "" : "s"}`;
  if (status.state === "synced") return "Sincronizado";
  return "Dados salvos neste aparelho";
};

const entityName = (conflict: SyncConflict): string => {
  switch (conflict.entity) {
    case "project":
      return "Projeto";
    case "map":
      return "Mapa";
    case "layer":
      return "Camada";
    case "feature":
      return "Feição";
    case "import":
      return "Importação";
  }
};

export function SyncStatus() {
  const [status, setStatus] = useState<SyncResult>(initialState);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const refreshLocalState = async () => {
    const [outbox, localConflicts] = await Promise.all([
      localRepository.listOutbox(),
      localRepository.listConflicts(),
    ]);
    setConflicts(localConflicts);
    setStatus((current) => ({
      ...current,
      pending: outbox.length,
      conflicts: localConflicts.length,
    }));
    if (localConflicts.length === 0) setShowConflicts(false);
  };

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void Promise.all([
        localRepository.listOutbox(),
        localRepository.listConflicts(),
      ])
        .then(([outbox, localConflicts]) => {
          if (!active) return;
          setConflicts(localConflicts);
          setStatus((current) => ({
            ...current,
            pending: outbox.length,
            conflicts: localConflicts.length,
          }));
          if (localConflicts.length === 0) setShowConflicts(false);
        })
        .catch(() => undefined);
    };
    const onStatus = (event: Event) => {
      const custom = event as CustomEvent<SyncResult>;
      if (custom.detail) {
        setStatus(custom.detail);
        refresh();
      }
    };
    const onOffline = () =>
      setStatus((current) => ({ ...current, state: "offline" }));
    const onOnline = () => {
      setStatus((current) => ({ ...current, state: "idle" }));
      void syncNow().then(refresh).catch(() => undefined);
    };
    const onMutation = () => refresh();

    window.addEventListener("geonexo-sync-status", onStatus);
    window.addEventListener("geonexo-local-mutation", onMutation);
    window.addEventListener("geonexo-conflict-resolved", onMutation);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    refresh();

    return () => {
      active = false;
      window.removeEventListener("geonexo-sync-status", onStatus);
      window.removeEventListener("geonexo-local-mutation", onMutation);
      window.removeEventListener("geonexo-conflict-resolved", onMutation);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const retry =
    status.state === "error" ||
    (status.pending > 0 && status.state !== "offline");

  const resolve = async (
    conflict: SyncConflict,
    resolution: "keep-local" | "use-server",
  ) => {
    if (
      resolution === "use-server" &&
      !window.confirm(
        "Usar a versão do servidor vai descartar as alterações locais pendentes deste item. Continuar?",
      )
    )
      return;
    setResolving(conflict.operationId);
    try {
      await localRepository.resolveConflict(conflict.operationId, resolution);
      await refreshLocalState();
      if (navigator.onLine && API_MODE === "live")
        await syncNow().catch(() => undefined);
    } finally {
      setResolving(null);
    }
  };

  return (
    <>
      <aside
        role="status"
        aria-live="polite"
        className="fixed z-50 flex min-h-[44px] max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-outline-variant bg-surface-container/95 px-3 py-2 text-xs text-on-surface shadow-lg backdrop-blur"
        style={{
          bottom: "max(0.75rem, env(safe-area-inset-bottom))",
          left: "max(0.75rem, env(safe-area-inset-left))",
        }}
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${
            status.state === "offline" || status.state === "error"
              ? "bg-amber-400"
              : status.conflicts > 0
                ? "bg-red-400"
                : status.state === "syncing"
                  ? "animate-pulse bg-cyan-400"
                  : "bg-emerald-400"
          }`}
        />
        <span className="truncate">{label(status)}</span>
        {conflicts.length > 0 && (
          <button
            type="button"
            className="min-h-[32px] rounded-full px-2 font-semibold text-red-400"
            onClick={() => setShowConflicts(true)}
          >
            Resolver
          </button>
        )}
        {retry && conflicts.length === 0 && (
          <button
            type="button"
            className="min-h-[32px] rounded-full px-2 font-semibold text-cyan-400"
            onClick={() => void syncNow().catch(() => undefined)}
          >
            Sincronizar
          </button>
        )}
      </aside>

      {showConflicts && (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="sync-conflicts-title"
          className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] max-h-[70vh] overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container p-4 text-on-surface shadow-2xl md:left-auto md:right-4 md:w-[420px]"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="sync-conflicts-title" className="font-bold">
                Alterações em conflito
              </h2>
              <p className="mt-1 text-xs text-on-surface-variant">
                Nada será apagado sem você escolher qual versão manter.
              </p>
            </div>
            <button
              type="button"
              aria-label="Fechar conflitos"
              onClick={() => setShowConflicts(false)}
              className="min-h-[44px] min-w-[44px] rounded-lg text-on-surface-variant"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {conflicts.map((conflict) => (
              <article
                key={conflict.operationId}
                className="rounded-xl border border-outline-variant p-3"
              >
                <strong className="text-sm">
                  {entityName(conflict)}
                </strong>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Este item também foi alterado depois da sua última
                  sincronização.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={resolving === conflict.operationId}
                    onClick={() => void resolve(conflict, "keep-local")}
                    className="min-h-[44px] rounded-lg bg-cyan-500 px-3 text-sm font-bold text-slate-950 disabled:opacity-50"
                  >
                    Manter deste aparelho
                  </button>
                  <button
                    type="button"
                    disabled={resolving === conflict.operationId}
                    onClick={() => void resolve(conflict, "use-server")}
                    className="min-h-[44px] rounded-lg border border-outline-variant px-3 text-sm disabled:opacity-50"
                  >
                    Usar versão do servidor
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
