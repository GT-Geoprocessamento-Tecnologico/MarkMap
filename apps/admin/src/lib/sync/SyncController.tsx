import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { syncNow } from "./sync-engine";

const PERIODIC_SYNC_MS = 60_000;
const MUTATION_DEBOUNCE_MS = 2_500;

export function SyncController() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof indexedDB === "undefined") return undefined;
    let disposed = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      if (
        disposed ||
        (typeof navigator !== "undefined" && navigator.onLine === false)
      )
        return;
      try {
        const result = await syncNow();
        if (disposed) return;
        if (result.pulled > 0 || result.pushed > 0 || result.conflicts > 0)
          await queryClient.invalidateQueries();
      } catch {
        // Field work is local-first; sync failure never blocks local editing.
      }
    };

    const schedule = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void run(), MUTATION_DEBOUNCE_MS);
    };
    const onOnline = () => void run();
    const onLocalMutation = () => schedule();
    const onConflictResolved = () => {
      void queryClient.invalidateQueries();
      schedule();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void run();
    };
    // BFCache restores and mobile WebView focus do not always emit
    // visibilitychange. Never force a remote sync while offline or hidden.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && document.visibilityState === "visible") void run();
    };
    const onFocus = () => {
      if (document.visibilityState === "visible") void run();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    window.addEventListener("geonexo-local-mutation", onLocalMutation);
    window.addEventListener("geonexo-conflict-resolved", onConflictResolved);
    document.addEventListener("visibilitychange", onVisibility);
    const periodic = setInterval(() => void run(), PERIODIC_SYNC_MS);
    void run();

    return () => {
      disposed = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("geonexo-local-mutation", onLocalMutation);
      window.removeEventListener("geonexo-conflict-resolved", onConflictResolved);
      document.removeEventListener("visibilitychange", onVisibility);
      if (periodic) clearInterval(periodic);
      if (debounce) clearTimeout(debounce);
    };
  }, [queryClient]);

  return null;
}
