import { useEffect, useState } from "react";

export interface UpdatePromptProps {
  /** Return true only after IndexedDB transactions and outbox writes are durable. */
  durableWritesReady?: () => boolean | Promise<boolean>;
  /** Return true only when this tab can read the new shell protocol safely. */
  compatibilityReady?: () => boolean | Promise<boolean>;
}

/** Controlled PWA update prompt. The app must explicitly opt into activation. */
export function UpdatePrompt({ durableWritesReady = () => false, compatibilityReady = () => false }: UpdatePromptProps) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    let disposed = false;
    const hadController = navigator.serviceWorker.controller !== null;
    const onControllerChange = () => {
      if (hadController) window.location.reload();
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
    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

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

  return (
    <aside role="status" aria-live="polite" className="pwa-update-prompt">
      <span>Uma atualização do MarkMap está pronta.</span>
      <button type="button" onClick={() => void accept()} disabled={busy}>
        {busy ? "Verificando…" : "Atualizar"}
      </button>
    </aside>
  );
}

export default UpdatePrompt;
