import { useEffect, useState } from "react";

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
  const [dismissedVersion, setDismissedVersion] = useState<string | number | null>(null);

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
      if (ready.waiting) setRegistration(ready);
      ready.addEventListener("updatefound", () => {
        const worker = ready.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (!disposed && worker.state === "installed" && navigator.serviceWorker.controller) setRegistration(ready);
        });
      });
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
    try {
      const [writesReady, compatible] = await Promise.all([durableWritesReady(), compatibilityReady()]);
      if (!writesReady || !compatible) return;
      waiting.postMessage({
        type: "SKIP_WAITING",
        durableWritesReady: true,
        compatibilityVersion: 1,
      });
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
      className="pwa-update-prompt"
    >
      <span>Nova versão do MarkMap disponível.</span>
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