import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { initializeAppInstall } from "./lib/app-install";

initializeAppInstall();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register("/sw.js").then(
    (registration) => registration.update(),
    () => undefined,
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("MarkMap site: element #root not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
