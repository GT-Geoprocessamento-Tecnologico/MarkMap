import { useEffect, useRef, useState } from "react";
import type { SyncConflict } from "@markmap/contracts";

import { API_MODE } from "../api-client";
import { localRepository } from "../local-repositories";
import {
  RECOVERY_SYNC_PAUSE_KEY, SYNC_ACTIVE_KEY, recoveryPauseGeneration,
  recoverStaleSyncClaim, resumeRecoveryPause, syncNow, webLockClaimToken, type SyncResult,
} from "./sync-engine";

const isOffline = (): boolean =>
  typeof navigator !== "undefined" && navigator.onLine === false;

type RecoveryGate =
  | { state: "clear" | "blocked" }
  | { state: "locked"; token: string | null }
  | { state: "paused"; generation: string };

const readRecoveryGate = async (): Promise<RecoveryGate> => {
  try {
    const [marker, active] = await Promise.all([
      localRepository.getMeta<unknown>(RECOVERY_SYNC_PAUSE_KEY),
      localRepository.getMeta<unknown>(SYNC_ACTIVE_KEY),
    ]);
    if (active !== undefined) return { state: "locked", token: webLockClaimToken(active) };
    const generation = recoveryPauseGeneration(marker);
    if (generation) return { state: "paused", generation };
    if (marker === undefined || marker === false) return { state: "clear" };
    return { state: "blocked" };
  } catch {
    return { state: "blocked" };
  }
};

const initialState = (): SyncResult => ({
  state: isOffline() ? "offline" : API_MODE !== "live" ? "disabled" : "idle",
  pushed: 0,
  pulled: 0,
  conflicts: 0,
  pending: 0,
});

const label = (status: SyncResult): string => {
  if (status.state === "paused") return "Sincronização pausada após restauração";
  if (status.state === "locked") return "Sincronização em outra aba ou interrompida. Verifique antes de continuar.";
  if (status.state === "blocked") return "Não foi possível verificar a sincronização local.";
  if (status.state === "error") return "Não foi possível sincronizar";
  if (status.conflicts > 0)
    return `${status.conflicts} conflito${status.conflicts === 1 ? "" : "s"} para revisar`;
  if (status.pending > 0)
    return `${status.pending} ${status.pending === 1 ? "alteração pendente" : "alterações pendentes"}`;
  return "Sincronizando…";
};

/**
 * O pill só aparece quando há algo que exige ação do usuário.
 *
 * O campo é local-first: informar "offline", "somente neste aparelho" ou
 * "sincronizado" só polui a tela, porque salvar localmente já é o caminho
 * normal e esperado. Conflitos, falhas e pendências continuam visíveis porque
 * exigem decisão ou nova tentativa.
 *
 * Sem `API_MODE === "live"` não existe servidor para sincronizar: qualquer
 * pendência da outbox ficaria na tela para sempre, já que nada a consome. Nesse
 * modo o aplicativo é apenas local, e o pill inteiro fica oculto.
 */
const needsAttention = (status: SyncResult, conflicts: number): boolean => {
  if (["paused", "locked", "blocked"].includes(status.state)) return true;
  if (API_MODE !== "live") return false;
  return conflicts > 0 || status.state === "error" || status.pending > 0;
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

const DESKTOP_LAYOUT_QUERY = "(min-width: 768px)";
const LANE_GAP_PX = 8;
const LANE_FALLBACK_OFFSET_PX = 12;
const SHELL_WAIT_MS = 3000;

const reserveShellLane = (pill: HTMLElement): (() => void) | null => {
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia(DESKTOP_LAYOUT_QUERY).matches
  )
    return null;
  const shell = document.querySelector("main");
  if (!shell) return null;
  const offset = Number.parseFloat(getComputedStyle(pill).bottom);
  const lane =
    Math.ceil(pill.getBoundingClientRect().height) +
    (Number.isFinite(offset) ? offset : LANE_FALLBACK_OFFSET_PX) +
    LANE_GAP_PX;
  const previous = shell.style.paddingBottom;
  const computedPadding = Number.parseFloat(getComputedStyle(shell).paddingBottom);
  const basePadding = Number.isFinite(computedPadding) ? computedPadding : 0;
  shell.style.paddingBottom = `${basePadding + lane}px`;
  return () => {
    shell.style.paddingBottom = previous;
  };
};

export function SyncStatus() {
  const [status, setStatus] = useState<SyncResult>(initialState);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [pauseGeneration, setPauseGeneration] = useState<string | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const pillRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    let release: (() => void) | null = null;
    let frame = 0;
  const sync = () => {
    release?.();
    release = reserveShellLane(pill);
  };
    const deadline = performance.now() + SHELL_WAIT_MS;
    const tick = () => {
      sync();
      if (!document.querySelector("main") && performance.now() < deadline)
        frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(sync) : null;
    observer?.observe(pill);
    const desktop =
      typeof window.matchMedia === "function"
        ? window.matchMedia(DESKTOP_LAYOUT_QUERY)
        : null;
    desktop?.addEventListener("change", sync);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      desktop?.removeEventListener("change", sync);
      release?.();
    };
  }, [status.state, status.pending, conflicts.length]);

  const refreshLocalState = async () => {
    const [outbox, localConflicts, gate] = await Promise.all([
      localRepository.listOutbox(),
      localRepository.listConflicts(),
      readRecoveryGate(),
    ]);
    setConflicts(localConflicts);
    setPauseGeneration(gate.state === "paused" ? gate.generation : null);
    setClaimToken(gate.state === "locked" ? gate.token : null);
    setStatus((current) => ({
      ...current,
      state: gate.state !== "clear" ? gate.state : current.state === "paused" ? initialState().state : current.state,
      pending: outbox.length,
      conflicts: localConflicts.length,
    }));
    if (localConflicts.length === 0) setShowConflicts(false);
  };

  useEffect(() => {
    let active = true;
    let refreshGeneration = 0;
    const refresh = () => {
      const generation = ++refreshGeneration;
      // The controller does not run while offline: inspect the durable gate
      // independently, even if loading the outbox or conflicts fails.
      void readRecoveryGate().then((gate) => {
        if (!active || generation !== refreshGeneration) return;
        setPauseGeneration(gate.state === "paused" ? gate.generation : null);
        setClaimToken(gate.state === "locked" ? gate.token : null);
        setStatus((current) => ({
          ...current,
          state: current.state === "syncing" && gate.state === "locked" ? current.state :
            gate.state !== "clear" ? gate.state : current.state === "paused" ? initialState().state : current.state,
        }));
      });
      void Promise.all([
        localRepository.listOutbox(),
        localRepository.listConflicts(),
      ])
        .then(([outbox, localConflicts]) => {
          if (!active || generation !== refreshGeneration) return;
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
      setStatus((current) => ({ ...current, state: ["paused", "locked", "blocked"].includes(current.state) ? current.state : "offline" }));
    const onOnline = () => {
      setStatus((current) => ({ ...current, state: ["paused", "locked", "blocked"].includes(current.state) ? current.state : "idle" }));
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
    (status.pending > 0 && !["offline", "paused", "locked", "blocked"].includes(status.state));

  const resume = async () => {
    const expectedGeneration = pauseGeneration;
    if (API_MODE !== "live" || resumeBusy || !expectedGeneration) return;
    if (!window.confirm(
      "Retomar permitirá enviar alterações locais, inclusive as restauradas, quando houver conexão. Feche outras abas antes de continuar. Deseja continuar?",
    )) return;
    setResumeBusy(true);
    setResumeError(null);
    // This transaction checks both the exact displayed pause and the active
    // claim; a new restore or concurrent sync cannot be accidentally cleared.
    if (!(await resumeRecoveryPause(expectedGeneration))) {
      setResumeError("A pausa mudou ou existe sincronização em outra aba. Verifique novamente antes de retomar.");
      const gate = await readRecoveryGate();
      setPauseGeneration(gate.state === "paused" ? gate.generation : null);
      setClaimToken(gate.state === "locked" ? gate.token : null);
      setStatus((current) => ({ ...current, state: gate.state === "locked" ? "locked" : "blocked" }));
      setResumeBusy(false);
      return;
    }
    try {
      await syncNow();
    } catch {
      setStatus((current) => ({ ...current, state: "error" }));
    } finally {
      setResumeBusy(false);
    }
  };

  const reviewInterruptedSync = async () => {
    const expectedToken = claimToken;
    if (!expectedToken || claimBusy || typeof navigator === "undefined" ||
        typeof navigator.locks?.request !== "function") return;
    if (!window.confirm(
      "Feche as outras abas do aplicativo antes de continuar. Uma requisição anterior pode já ter sido enviada e esta ação não a desfaz. Verificar e liberar apenas a trava observada?",
    )) return;
    setClaimBusy(true);
    setClaimMessage(null);
    const recovered = await recoverStaleSyncClaim(expectedToken);
    if (!recovered) {
      setClaimMessage("Não foi possível liberar a trava: ela pode estar em uso, ter mudado ou não estar acessível.");
      setClaimBusy(false);
      return;
    }
    const gate = await readRecoveryGate();
    setPauseGeneration(gate.state === "paused" ? gate.generation : null);
    setClaimToken(gate.state === "locked" ? gate.token : null);
    setStatus((current) => ({ ...current, state: gate.state === "clear" ? initialState().state : gate.state }));
    setClaimMessage("Trava verificada. Confirme a retomada separadamente; esta ação não iniciou sincronização.");
    setClaimBusy(false);
  };

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
      {needsAttention(status, conflicts.length) && (
        <aside
          ref={pillRef}
          role="status"
          aria-live="polite"
          className="markmap-sync-status pointer-events-none fixed z-50 flex min-h-[44px] max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-surface-container/95 px-3 py-2 text-xs text-on-surface shadow-lg backdrop-blur"
          style={{
            left: "max(0.75rem, env(safe-area-inset-left))",
          }}
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 shrink-0 rounded-full ${
              ["offline", "error", "paused", "locked", "blocked"].includes(status.state)
                ? "bg-amber-400"
                : status.conflicts > 0
                  ? "bg-red-400"
                  : status.state === "syncing"
                    ? "animate-pulse bg-cyan-400"
                    : "bg-emerald-400"
            }`}
          />
          <span className={status.state === "locked" || status.state === "blocked" ? "whitespace-normal" : "truncate"}>{label(status)}</span>
          {status.state === "paused" && pauseGeneration && API_MODE === "live" && (
            <button type="button" className="pointer-events-auto min-h-[44px] px-2 font-semibold"
              disabled={resumeBusy} onClick={() => void resume()}>
              {resumeBusy ? "Retomando…" : "Retomar sincronização"}
            </button>
          )}
          {status.state === "locked" && claimToken &&
            typeof navigator !== "undefined" && typeof navigator.locks?.request === "function" && (
            <button type="button" className="pointer-events-auto min-h-[44px] px-2 font-semibold"
              disabled={claimBusy} onClick={() => void reviewInterruptedSync()}>
              {claimBusy ? "Verificando…" : "Verificar sincronização interrompida"}
            </button>
          )}
          {claimMessage && <span role="alert">{claimMessage}</span>}
          {resumeError && <span role="alert">{resumeError}</span>}
          {conflicts.length > 0 && (
            <button
              type="button"
              className="pointer-events-auto min-h-[44px] min-w-[44px] rounded-full px-2 font-semibold text-red-400"
              onClick={() => setShowConflicts(true)}
            >
              Resolver
            </button>
          )}
          {retry && conflicts.length === 0 && (
            <button
              type="button"
              className="pointer-events-auto min-h-[44px] min-w-[44px] rounded-full px-2 font-semibold text-cyan-400"
              onClick={() => void syncNow().catch(() => undefined)}
            >
              Sincronizar
            </button>
          )}
        </aside>
      )}

      {showConflicts && (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="sync-conflicts-title"
          className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] max-h-[70vh] overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container p-4 text-on-surface shadow-2xl md:left-auto md:right-4 md:w-[420px]"
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
                    className="min-h-[44px] rounded-lg bg-gradient-to-r from-brand-blue to-brand-cyan px-3 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
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
