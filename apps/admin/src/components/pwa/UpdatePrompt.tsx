import { useCallback, useEffect, useRef, useState } from "react";
import {
  PWA_UPDATE_REQUEST,
  type AppUpdateRequest,
  type AppUpdateResult,
} from "../../lib/pwa-update-request";
import { AppIcon } from "../AppIcon";

/** Ask the WAITING worker for protocol information; do not infer it from network status. */
async function waitingWorkerCompatible(
  waiting: ServiceWorker,
): Promise<boolean> {
  if (typeof MessageChannel === "undefined") return false;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        channel.port1.close();
        channel.port2.close();
      } finally {
        resolve(ok);
      }
    };
    const timeout = setTimeout(() => finish(false), 4000);
    channel.port1.onmessage = (
      event: MessageEvent<{
        type?: string;
        shellProtocolVersion?: number;
        localSchemaVersion?: number;
        regionPackageSchemaVersion?: number;
      }>,
    ) => {
      const data = event.data;
      finish(
        data?.type === "MARKMAP_COMPATIBILITY" &&
          data.shellProtocolVersion === 1 &&
          data.localSchemaVersion === 1 &&
          data.regionPackageSchemaVersion === 2,
      );
    };
    try {
      waiting.postMessage({ type: "CHECK_COMPATIBILITY" }, [channel.port2]);
    } catch {
      finish(false);
    }
  });
}

/** Wait for an in-progress installation before deciding whether an update exists. */
async function waitForInstallation(
  registration: ServiceWorkerRegistration,
): Promise<void> {
  const installing = registration.installing;
  if (
    !installing ||
    ["installed", "activated", "redundant"].includes(installing.state)
  )
    return;
  await new Promise<void>((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      installing.removeEventListener("statechange", onStateChange);
      resolve();
    };
    const onStateChange = () => {
      if (["installed", "activated", "redundant"].includes(installing.state))
        done();
    };
    const timeout = setTimeout(done, 15000);
    installing.addEventListener("statechange", onStateChange);
    onStateChange();
  });
}

export interface UpdatePromptProps {
  /** Return true only after IndexedDB transactions and outbox writes are durable. */
  durableWritesReady?: () => boolean | Promise<boolean>;
  /** Return true only when this tab can read the new shell protocol safely. */
  compatibilityReady?: () => boolean | Promise<boolean>;
}

/** Controlled PWA update prompt. The app must explicitly opt into activation. */
export function UpdatePrompt({
  durableWritesReady = () => false,
  compatibilityReady = () => false,
}: UpdatePromptProps) {
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [busy, setBusy] = useState(false);
  const activationApproved = useRef(false);
  const reloadStarted = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] =
    useState<ServiceWorker | null>(null);

  const accept = useCallback(
    async (target: ServiceWorkerRegistration): Promise<AppUpdateResult> => {
      const waiting = target.waiting;
      if (!waiting) return { status: "current" };
      setBusy(true);
      setError(null);
      try {
        const [writesReady, appCompatible, workerCompatible] =
          await Promise.all([
            durableWritesReady(),
            compatibilityReady(),
            waitingWorkerCompatible(waiting),
          ]);
        if (!writesReady || !appCompatible) {
          const message =
            "Os dados locais ainda não estão prontos. Salve as alterações antes de atualizar.";
          setError(message);
          return { status: "error", message };
        }
        if (!workerCompatible) {
          const message =
            "Esta versão não confirmou compatibilidade dos dados locais. Atualização bloqueada por segurança.";
          setError(message);
          return { status: "error", message };
        }
        if (target.waiting !== waiting || waiting.state !== "installed") {
          const message =
            "A versão disponível mudou. Verifique novamente antes de atualizar.";
          setError(message);
          return { status: "error", message };
        }
        activationApproved.current = true;
        try {
          waiting.postMessage({
            type: "SKIP_WAITING",
            durableWritesReady: true,
            compatibilityVersion: 1,
          });
        } catch (cause) {
          activationApproved.current = false;
          throw cause;
        }
        return { status: "updating" };
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Não foi possível ativar a atualização com segurança.";
        setError(message);
        return { status: "error", message };
      } finally {
        setBusy(false);
      }
    },
    [durableWritesReady, compatibilityReady],
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;

    let disposed = false;
    let updateInterval: NodeJS.Timeout | null = null;

    const onControllerChange = () => {
      // A different tab may activate a worker. Never force-reload unsaved local UI
      // unless THIS tab approved an update and finished its durable write check.
      if (activationApproved.current && !reloadStarted.current) {
        reloadStarted.current = true;
        window.location.reload();
      }
    };

    const checkForUpdate = async () => {
      if (!("serviceWorker" in navigator)) return;
      const sw = navigator.serviceWorker;
      if (!sw.controller) return;

      try {
        const registration = await sw.ready;
        if (disposed) return;
        if (navigator.onLine && typeof registration.update === "function") {
          await registration.update();
        }

        if (registration.waiting && registration.waiting !== dismissedVersion) {
          setRegistration(registration);
        } else if (!registration.waiting) {
          setRegistration(null);
        }
      } catch {
        // service worker not ready yet
      }
    };

    const goOnline = async () => {
      if (!("onLine" in navigator)) return;
      await checkForUpdate();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        goOnline();
      }
    };

    const startPeriodicCheck = () => {
      if (updateInterval) clearInterval(updateInterval);
      updateInterval = setInterval(() => {
        if (!navigator.onLine) return;
        goOnline();
      }, 300000);
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );
    void navigator.serviceWorker.ready.then((ready) => {
      if (disposed) return;
      // Only a worker registered for this document's scope can prompt activation.
      if (!window.location.href.startsWith(ready.scope)) return;
      if (ready.waiting && ready.waiting !== dismissedVersion)
        setRegistration(ready);
      ready.addEventListener("updatefound", () => {
        const worker = ready.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (
            !disposed &&
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            setRegistration(ready);
          }
        });
      });
      void checkForUpdate();
    });

    // Settings delegates to this single guarded activation flow, not a second updater.
    const onManualUpdate = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<AppUpdateRequest>;
      if (typeof event.detail?.respond !== "function") return;
      event.preventDefault();
      void (async (): Promise<AppUpdateResult> => {
        if (
          !("serviceWorker" in navigator) ||
          !navigator.serviceWorker.controller
        ) {
          return { status: "unavailable" };
        }
        if (!navigator.onLine) return { status: "offline" };
        const ready = await navigator.serviceWorker.ready;
        if (
          disposed ||
          !window.location.href.startsWith(ready.scope) ||
          typeof ready.update !== "function"
        ) {
          return { status: "unavailable" };
        }
        try {
          await ready.update();
        } catch (cause) {
          // An already downloaded version can still be activated when another
          // update check fails; otherwise surface the real network error.
          if (!ready.waiting) throw cause;
        }
        await waitForInstallation(ready);
        if (disposed) return { status: "unavailable" };
        if (!ready.waiting)
          return { status: ready.installing ? "pending" : "current" };
        setRegistration(ready);
        return accept(ready);
      })().then(event.detail.respond, (cause: unknown) => {
        event.detail.respond({
          status: "error",
          message:
            cause instanceof Error
              ? cause.message
              : "Falha ao verificar atualização.",
        });
      });
    };
    window.addEventListener(PWA_UPDATE_REQUEST, onManualUpdate);
    window.addEventListener("online", goOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    startPeriodicCheck();

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      window.removeEventListener(PWA_UPDATE_REQUEST, onManualUpdate);
      window.removeEventListener("online", goOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (updateInterval) clearInterval(updateInterval);
    };
  }, [dismissedVersion, accept]);

  const handleLater = () => {
    if (registration?.waiting) {
      activationApproved.current = false;
      setDismissedVersion(registration.waiting);
    }
    setRegistration(null);
  };

  if (!registration?.waiting) return null;

  // Desenvolvido por MtsFerreira. Apenas a apresentação muda; o aceite continua seguro.
  return (
    <aside
      role="status"
      aria-live="polite"
      aria-busy={busy}
      aria-label="Nova versão do MarkMap disponível."
      className="pwa-update-prompt"
    >
      <div className="pwa-update-prompt__heading">
        <span className="pwa-update-prompt__icon">
          <AppIcon name="sync" size="lg" />
        </span>
        <div>
          <span className="pwa-update-prompt__eyebrow">
            ATUALIZAÇÃO DISPONÍVEL
          </span>
          <strong className="pwa-update-prompt__title">
            MarkMap tem novidades
          </strong>
        </div>
      </div>
      <p className="pwa-update-prompt__description">
        Uma nova versão está pronta. Verificamos seus dados locais antes de
        atualizar.
      </p>
      {error && (
        <p role="alert" className="pwa-update-prompt__error">
          <AppIcon name="info" size="sm" />
          <span>{error}</span>
        </p>
      )}
      <div className="pwa-update-prompt__actions">
        <button
          type="button"
          className="pwa-update-prompt__primary"
          onClick={() => void accept(registration)}
          disabled={busy}
        >
          <AppIcon name={busy ? "loading" : "download"} size="sm" />
          {busy ? "Verificando…" : "Atualizar agora"}
        </button>
        <button
          type="button"
          className="pwa-update-prompt__secondary"
          onClick={handleLater}
          disabled={busy}
        >
          Depois
        </button>
      </div>
      <span className="pwa-update-prompt__note">
        Você escolhe quando atualizar.
      </span>
    </aside>
  );
}

export default UpdatePrompt;
