import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/main.css";
import { initializePwaInstall } from "./lib/pwa-install";

initializePwaInstall();

// Registra o Service Worker cedo para que a instalação PWA possa ficar elegível
// na primeira navegação de produção.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register("/sw.js").then(
    (registration) => registration.update(),
    (err) => {
      console.warn("Falha no registro do PWA ServiceWorker:", err);
    },
  );
}

const container = document.getElementById("root");
if (container === null) {
  throw new Error("MarkMap: element #root not found in index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
