import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { ToastProvider } from "@markmap/ui";
import { router } from "./router";
import { isClientError } from "./lib/errors";
import { localRepository } from "./lib/local-repositories";
import { SyncController } from "./lib/sync/SyncController";
import { SyncStatus } from "./lib/sync/SyncStatus";
import { UpdatePrompt } from "./components/pwa/UpdatePrompt";
import { BackupRestoreCard } from "./components/backup/BackupRestoreCard";
import { PwaInstallPrompt } from "./components/pwa/PwaInstallPrompt";
import { NetworkStatusBanner } from "./components/pwa/NetworkStatusBanner";
import { isPwaStandalone, shouldShowPwaInstallFlow } from "./lib/pwa-install";

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "offlineFirst",
        retry: (failureCount, error) =>
          failureCount < 1 && !isClientError(error),
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false, networkMode: "offlineFirst" },
    },
  });
}

export default function App() {
  const [queryClient] = useState(createQueryClient);

  // Marketing-site installs arrive here with ?install=1. Do not mount the
  // operational workspace or start synchronization until launched as a PWA.
  if (
    typeof window !== "undefined" &&
    shouldShowPwaInstallFlow(window.location.search, isPwaStandalone())
  ) {
    return <PwaInstallPrompt fullScreen />;
  }

  // Recovery must precede the router and sync: both can initialize a workspace
  // or queue work before the operator confirms a restore.
  if (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("restore") === "1"
  ) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <main className="min-h-screen bg-surface p-4 text-on-surface">
            <div className="mx-auto max-w-2xl space-y-4 py-8">
              <h1 className="text-2xl font-semibold">Recuperar backup</h1>
              <p>
                Use esta tela em um perfil novo ou vazio do aplicativo. A
                restauração só é permitida quando não há dados locais existentes;
                nenhuma informação será apagada automaticamente.
              </p>
              <BackupRestoreCard showRecoveryLink={false} />
              <p>Após concluir a restauração, volte ao aplicativo para acessar seus dados.</p>
              <a className="inline-flex min-h-[44px] items-center rounded-lg border border-outline-variant px-4 font-semibold" href="/">
                Voltar ao aplicativo
              </a>
            </div>
          </main>
        </ToastProvider>
      </QueryClientProvider>
    );
  }
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SyncController />
        <SyncStatus />
        <NetworkStatusBanner />
        <PwaInstallPrompt />
        <UpdatePrompt
          durableWritesReady={async () => {
            await localRepository.listOutbox();
            return true;
          }}
          compatibilityReady={() => typeof indexedDB !== 'undefined' && typeof caches !== 'undefined'}
        />
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  );
}
