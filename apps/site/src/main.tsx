import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
// The marketing site must not install itself as the operational MarkMap PWA.
// Retire only this origin's legacy worker/cache; never touch IndexedDB user data.
if (import.meta.env.PROD) {
  if ("serviceWorker" in navigator && typeof navigator.serviceWorker.getRegistrations === "function") {
    void navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations
        .filter((registration) => {
          const worker = registration.active ?? registration.waiting ?? registration.installing;
          return registration.scope === `${window.location.origin}/` &&
            worker != null && new URL(worker.scriptURL).pathname === "/sw.js";
        })
        .map((registration) => registration.unregister())))
      .catch(() => undefined);
  }
  if ("caches" in window) {
    void caches.keys()
      .then((names) => Promise.all(names
        .filter((name) => name.startsWith("markmap-site-app-"))
        .map((name) => caches.delete(name))))
      .catch(() => undefined);
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("MarkMap site: element #root not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
