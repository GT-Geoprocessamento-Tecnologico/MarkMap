import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { ToastProvider } from "@geonexo/ui";
import { router } from "./router";
import { isClientError } from "./lib/errors";
import { localRepository } from "./lib/local-repositories";
import { SyncController } from "./lib/sync/SyncController";
import { SyncStatus } from "./lib/sync/SyncStatus";
import { UpdatePrompt } from "./components/pwa/UpdatePrompt";
import { PwaInstallPrompt } from "./components/pwa/PwaInstallPrompt";
import { NetworkStatusBanner } from "./components/pwa/NetworkStatusBanner";

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
