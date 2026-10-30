import { useCallback, useEffect, useRef, useState } from "react";
import { PWA_UPDATE_REQUEST, type AppUpdateRequest, type AppUpdateResult } from "../../lib/pwa-update-request";
import { AppIcon } from "../AppIcon";

type ShellStatus = {
  type: "MARKMAP_SHELL_STATUS";
  protocol: number;
  approvedShell: string | null;
  approvedVersion: string | null;
  availableShell: string;
  availableVersion: string;
  updateAvailable: boolean;
  candidateReady: boolean;
  error?: string;
};
type AvailableUpdate = {
  registration: ServiceWorkerRegistration;
  worker: ServiceWorker;
  status: ShellStatus;
  waiting: boolean;
};

const MESSAGE_TIMEOUT_MS = 5000;
const APPROVAL_TIMEOUT_MS = 15000;
const REMIND_LATER_MS = 24 * 60 * 60 * 1000;
const DISMISSED_KEY = "markmap:pwa-update-deferred";
const NOT_READY = () => false;

function isValidStatus(value: unknown): value is ShellStatus {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<ShellStatus>;
  return data.type === "MARKMAP_SHELL_STATUS" && data.protocol === 1 &&
    typeof data.availableShell === "string" &&
    typeof data.availableVersion === "string" &&
    data.updateAvailable === true && data.candidateReady === true &&
    typeof data.approvedShell === "string" && data.approvedShell !== data.availableShell;
}

/** MessageChannel is shared by active and waiting workers; never infer readiness from online status. */
async function messageWorker<T>(worker: ServiceWorker, message: unknown): Promise<T | null> {
  if (typeof MessageChannel === "undefined") return null;
  return new Promise<T | null>((resolve) => {
    const channel = new MessageChannel();
    let settled = false;
    const finish = (result: T | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      channel.port1.close();
      channel.port2.close();
      resolve(result);
    };
    const timeout = setTimeout(() => finish(null), MESSAGE_TIMEOUT_MS);
    channel.port1.onmessage = (event: MessageEvent<T>) => finish(event.data);
    try { worker.postMessage(message, [channel.port2]); }
    catch { finish(null); }
  });
}

async function compatible(worker: ServiceWorker): Promise<boolean> {
  const result = await messageWorker<{
    type?: string; shellProtocolVersion?: number; localSchemaVersion?: number;
    regionPackageSchemaVersion?: number;
  }>(worker, { type: "CHECK_COMPATIBILITY" });
  return result?.type === "MARKMAP_COMPATIBILITY" &&
    result.shellProtocolVersion === 1 && result.localSchemaVersion === 1 &&
    result.regionPackageSchemaVersion === 2;
}

async function shellStatus(worker: ServiceWorker): Promise<ShellStatus | null> {
  const data = await messageWorker<ShellStatus>(worker, { type: "GET_SHELL_STATUS" });
  return isValidStatus(data) ? data : null;
}

async function waitForInstallation(registration: ServiceWorkerRegistration): Promise<void> {
  const worker = registration.installing;
  if (!worker || ["installed", "activated", "redundant"].includes(worker.state)) return;
  await new Promise<void>((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      worker.removeEventListener("statechange", onStateChange);
      resolve();
    };
    const onStateChange = () => {
      if (["installed", "activated", "redundant"].includes(worker.state)) done();
    };
    const timeout = setTimeout(done, APPROVAL_TIMEOUT_MS);
    worker.addEventListener("statechange", onStateChange);
    onStateChange();
  });
}

async function findCandidate(registration: ServiceWorkerRegistration): Promise<AvailableUpdate | null> {
  if (registration.waiting) {
    const status = await shellStatus(registration.waiting);
    if (status) return { registration, worker: registration.waiting, status, waiting: true };
  }
  if (registration.active) {
    const status = await shellStatus(registration.active);
    if (status) return { registration, worker: registration.active, status, waiting: false };
  }
  return null;
}

function isDeferred(shell: string): boolean {
  try {
    const saved = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) || "null") as {
      shell?: string; timestamp?: number;
    } | null;
    return saved?.shell === shell && typeof saved.timestamp === "number" &&
      Date.now() - saved.timestamp < REMIND_LATER_MS;
  } catch { return false; }
}
function defer(shell: string): void {
  try { window.localStorage.setItem(DISMISSED_KEY, JSON.stringify({ shell, timestamp: Date.now() })); }
  catch { /* Storage can be unavailable in private browsing. */ }
}

/** Wait for the new controller before authorizing the new app shell. */
async function activateWaiting(registration: ServiceWorkerRegistration, worker: ServiceWorker): Promise<ServiceWorker> {
  if (!('serviceWorker' in navigator)) throw new Error("Service worker indisponível.");
  if (registration.waiting !== worker) throw new Error("A atualização disponível mudou.");
  const serviceWorker = navigator.serviceWorker;
  return new Promise<ServiceWorker>((resolve, reject) => {
    let finished = false;
    const done = (value: ServiceWorker | null, cause?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      serviceWorker.removeEventListener("controllerchange", onChange);
      if (value) resolve(value);
      else reject(cause ?? new Error("A versão ainda não assumiu o controle."));
    };
    const onChange = () => {
      const controller = serviceWorker.controller;
      if (controller && controller !== previous) done(controller);
    };
    const previous = serviceWorker.controller;
    const timeout = setTimeout(() => done(null), APPROVAL_TIMEOUT_MS);
    serviceWorker.addEventListener("controllerchange", onChange);
    try {
      worker.postMessage({ type: "SKIP_WAITING", durableWritesReady: true, compatibilityVersion: 1 });
      onChange();
    } catch { done(null, new Error("Não foi possível ativar o service worker com segurança.")); }
  });
}

async function approveShell(worker: ServiceWorker, targetShell: string): Promise<boolean> {
  if (!(await compatible(worker))) return false;
  const response = await messageWorker<{ type?: string; approved?: boolean; reason?: string }>(worker, {
    type: "APPROVE_SHELL", targetShell, durableWritesReady: true, compatibilityVersion: 1,
  });
  if (response?.type !== "MARKMAP_SHELL_APPROVAL" || response.approved !== true) {
    if (response?.reason === "other-tabs") {
      throw new Error("Feche as outras janelas do MarkMap antes de atualizar.");
    }
    throw new Error("Não foi possível aprovar a versão sem arriscar os dados locais.");
  }
  return true;
}

export interface UpdatePromptProps {
  /** Must confirm that IndexedDB/outbox writes are durable before approval. */
  durableWritesReady?: () => boolean | Promise<boolean>;
  /** Must confirm that the approved data schema is compatible with the new shell. */
  compatibilityReady?: () => boolean | Promise<boolean>;
}

export function UpdatePrompt({
  durableWritesReady = NOT_READY,
  compatibilityReady = NOT_READY,
}: UpdatePromptProps) {
  const [available, setAvailable] = useState<AvailableUpdate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedShell, setDismissedShell] = useState<string | null>(null);
  const disposed = useRef(false);
  const reloading = useRef(false);

  const checkForUpdate = useCallback(async (updateRegistration: boolean): Promise<AvailableUpdate | null> => {
    if (!("serviceWorker" in navigator)) return null;
    try {
      const sw = navigator.serviceWorker;
      const registration = await sw.ready;
      if (!navigator.serviceWorker.controller || !window.location.href.startsWith(registration.scope)) return null;
      if (updateRegistration && navigator.onLine && typeof registration.update === "function") {
        try { await registration.update(); } catch { /* An already cached candidate may still be approved. */ }
        await waitForInstallation(registration);
      }
      const candidate = await findCandidate(registration);
      if (!disposed.current) setAvailable(candidate);
      return candidate;
    } catch {
      return null; // Keep the installed app operational while disconnected.
    }
  }, []);

  const accept = useCallback(async (candidate: AvailableUpdate): Promise<AppUpdateResult> => {
    setBusy(true);
    setError(null);
    try {
      const ready = await Promise.all([
        durableWritesReady(), compatibilityReady(), compatible(candidate.worker),
      ]);
      if (!ready.every(Boolean)) throw new Error("Salve as alterações e confira a compatibilidade dos dados antes de atualizar.");
      if (!candidate.status.candidateReady || !(await shellStatus(candidate.worker))) {
        throw new Error("Esta versão ainda não foi baixada completamente.");
      }
      let target = candidate.worker;
      if (candidate.waiting) {
        if (candidate.registration.waiting !== target) throw new Error("A atualização disponível mudou.");
        // Handshake above authorizes SKIP_WAITING, but NOT a shell change.
        target = await activateWaiting(candidate.registration, target);
      }
      // A new SW can also activate naturally while the app was closed. In
      // either case the persisted shell is updated only by this explicit call.
      await approveShell(target, candidate.status.availableShell);
      if (!reloading.current) {
        reloading.current = true;
        window.location.reload();
      }
      return { status: "updating" };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível atualizar com segurança.";
      setError(message);
      return { status: "error", message };
    } finally {
      setBusy(false);
    }
  }, [durableWritesReady, compatibilityReady]);

  useEffect(() => {
    disposed.current = false;
    if (!("serviceWorker" in navigator)) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    let currentRegistration: ServiceWorkerRegistration | null = null;
    const check = () => { void checkForUpdate(true); };
    const onVisibility = () => { if (document.visibilityState === "visible") check(); };
    const onControllerChange = () => { void checkForUpdate(false); };
    const onUpdateFound = () => {
      const installing = currentRegistration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed") void checkForUpdate(false);
      });
    };
    const onManualUpdate = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<AppUpdateRequest>;
      if (typeof event.detail?.respond !== "function") return;
      event.preventDefault();
      void (async (): Promise<AppUpdateResult> => {
        const next = await checkForUpdate(true);
        if (!next) return { status: navigator.onLine ? "current" : "offline" };
        return accept(next);
      })().then(event.detail.respond, (cause: unknown) => {
        event.detail.respond({ status: "error", message: String(cause) });
      });
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    window.addEventListener(PWA_UPDATE_REQUEST, onManualUpdate);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", onVisibility);
    void navigator.serviceWorker.ready.then((registration) => {
      if (disposed.current) return;
      currentRegistration = registration;
      registration.addEventListener("updatefound", onUpdateFound);
      void checkForUpdate(true);
    }).catch(() => undefined);
    interval = setInterval(() => { if (navigator.onLine) check(); }, 300000);
    return () => {
      disposed.current = true;
      if (interval) clearInterval(interval);
      currentRegistration?.removeEventListener("updatefound", onUpdateFound);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener(PWA_UPDATE_REQUEST, onManualUpdate);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [accept, checkForUpdate]);

  const handleLater = () => {
    if (available) {
      defer(available.status.availableShell);
      setDismissedShell(available.status.availableShell);
    }
    setAvailable(null);
  };

  if (!available || available.status.availableShell === dismissedShell ||
      isDeferred(available.status.availableShell)) return null;

  return (
    <aside role="status" aria-live="polite" aria-busy={busy}
      aria-label="Nova versão do MarkMap disponível." className="pwa-update-prompt">
      <div className="pwa-update-prompt__heading">
        <span className="pwa-update-prompt__icon"><AppIcon name="sync" size="lg" /></span>
        <div>
          <span className="pwa-update-prompt__eyebrow">ATUALIZAÇÃO DISPONÍVEL</span>
          <strong className="pwa-update-prompt__title">MarkMap {available.status.availableVersion}</strong>
        </div>
      </div>
      <p className="pwa-update-prompt__description">
        A nova versão está pronta. Ela só será aplicada depois da sua confirmação.
      </p>
      {error && <p role="alert" className="pwa-update-prompt__error">
        <AppIcon name="info" size="sm" /><span>{error}</span>
      </p>}
      <div className="pwa-update-prompt__actions">
        <button type="button" className="pwa-update-prompt__primary"
          onClick={() => { void accept(available); }} disabled={busy}>
          <AppIcon name={busy ? "loading" : "download"} size="sm" />
          {busy ? "Verificando…" : "Atualizar agora"}
        </button>
        <button type="button" className="pwa-update-prompt__secondary"
          onClick={handleLater} disabled={busy}>Depois</button>
      </div>
      <span className="pwa-update-prompt__note">Você escolhe quando atualizar.</span>
    </aside>
  );
}

export default UpdatePrompt;