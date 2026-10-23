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
          compatibilityReady={() =>
            typeof indexedDB !== "undefined" && typeof caches !== "undefined"
          }
        />
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  );
}
