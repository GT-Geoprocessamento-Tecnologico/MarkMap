import { useEffect, useState } from "react";

/** Ask the WAITING worker for protocol information; do not infer it from network status. */
async function waitingWorkerCompatible(waiting: ServiceWorker): Promise<boolean> {
  if (typeof MessageChannel === 'undefined') return false;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try { channel.port1.close(); channel.port2.close(); }
      finally { resolve(ok); }
    };
    const timeout = setTimeout(() => finish(false), 4000);
    channel.port1.onmessage = (event: MessageEvent<{
      type?: string; shellProtocolVersion?: number; localSchemaVersion?: number;
      regionPackageSchemaVersion?: number;
    }>) => {
      const data = event.data;
      finish(data?.type === 'MARKMAP_COMPATIBILITY' &&
        data.shellProtocolVersion === 1 && data.localSchemaVersion === 1 &&
        data.regionPackageSchemaVersion === 2);
    };
    try { waiting.postMessage({ type: 'CHECK_COMPATIBILITY' }, [channel.port2]); }
    catch { finish(false); }
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
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;

    let disposed = false;
    let updateInterval: NodeJS.Timeout | null = null;

    const hadController = navigator.serviceWorker.controller !== null;
    const onControllerChange = () => {
      if (hadController) window.location.reload();
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

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    void navigator.serviceWorker.ready.then((ready) => {
      if (disposed) return;
      if (ready.waiting && ready.waiting !== dismissedVersion) setRegistration(ready);
      ready.addEventListener("updatefound", () => {
        const worker = ready.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (!disposed && worker.state === "installed" && navigator.serviceWorker.controller) {
            setRegistration(ready);
          }
        });
      });
      void checkForUpdate();
    });

    window.addEventListener("online", goOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    startPeriodicCheck();

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("online", goOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (updateInterval) clearInterval(updateInterval);
    };
  }, [dismissedVersion]);

  if (!registration?.waiting) return null;

  const accept = async () => {
    const waiting = registration.waiting;
    if (!waiting) return;
    setBusy(true);
    setError(null);
    try {
      const [writesReady, appCompatible, workerCompatible] = await Promise.all([
        durableWritesReady(), compatibilityReady(), waitingWorkerCompatible(waiting),
      ]);
      if (!writesReady || !appCompatible) {
        setError('Aguarde o salvamento local dos dados antes de atualizar.');
        return;
      }
      if (!workerCompatible) {
        setError('Esta versão não confirmou compatibilidade dos dados locais. Atualização bloqueada por segurança.');
        return;
      }
      waiting.postMessage({
        type: "SKIP_WAITING",
        durableWritesReady: true,
        compatibilityVersion: 1,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível ativar a atualização com segurança.');
    } finally {
      setBusy(false);
    }
  };

  const handleLater = () => {
    if (registration.waiting) {
      setDismissedVersion(registration.waiting);
    }
    setRegistration(null);
  };

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Nova versão do MarkMap disponível."
      className="pwa-update-prompt"
    >
      <span>Nova versão do MarkMap disponível.</span>
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button
          type="button"
          onClick={() => void accept()}
          disabled={busy}
        >
          {busy ? "Verificando…" : "Atualizar agora"}
        </button>
        <button
          type="button"
          onClick={() => handleLater()}
          style={{ flex: "1" }}
        >
          Depois
        </button>
      </div>
    </aside>
  );
}

export default UpdatePrompt;