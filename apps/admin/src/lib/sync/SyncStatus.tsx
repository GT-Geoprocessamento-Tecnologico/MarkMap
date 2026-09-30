import { useEffect, useState } from "react";

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
    return `${status.conflicts} conflito${status.conflicts === 1 ? "" : "s"}`;
  if (status.pending > 0)
    return `${status.pending} alteração${status.pending === 1 ? "" : "ões"} pendente${status.pending === 1 ? "" : "s"}`;
  if (status.state === "synced") return "Sincronizado";
  return "Dados salvos neste aparelho";
};

export function SyncStatus() {
  const [status, setStatus] = useState<SyncResult>(initialState);

  useEffect(() => {
    let active = true;
    const refreshPending = () => {
      void localRepository
        .listOutbox()
        .then((outbox) => {
          if (!active) return;
          setStatus((current) => ({ ...current, pending: outbox.length }));
        })
        .catch(() => undefined);
    };
    const onStatus = (event: Event) => {
      const custom = event as CustomEvent<SyncResult>;
      if (custom.detail) setStatus(custom.detail);
    };
    const onOffline = () =>
      setStatus((current) => ({ ...current, state: "offline" }));
    const onOnline = () => {
      setStatus((current) => ({ ...current, state: "idle" }));
      void syncNow().catch(() => undefined);
    };
    const onMutation = () => refreshPending();

    window.addEventListener("geonexo-sync-status", onStatus);
    window.addEventListener("geonexo-local-mutation", onMutation);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    refreshPending();

    return () => {
      active = false;
      window.removeEventListener("geonexo-sync-status", onStatus);
      window.removeEventListener("geonexo-local-mutation", onMutation);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const retry =
    status.state === "error" ||
    (status.pending > 0 && status.state !== "offline");

  return (
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
            : status.state === "syncing"
              ? "animate-pulse bg-cyan-400"
              : "bg-emerald-400"
        }`}
      />
      <span className="truncate">{label(status)}</span>
      {retry && (
        <button
          type="button"
          className="min-h-[32px] rounded-full px-2 font-semibold text-cyan-400"
          onClick={() => void syncNow().catch(() => undefined)}
        >
          Sincronizar
        </button>
      )}
    </aside>
  );
}
