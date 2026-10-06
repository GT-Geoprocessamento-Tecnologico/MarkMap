import { useEffect, useState, type InputHTMLAttributes } from "react";
import { useToast, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, Button, Checkbox } from "@geonexo/ui";
import {
  offlineMapPackageManifestSchema,
  type OfflineMapPackageManifest,
} from "@geonexo/contracts";
import { offlineMapStore } from "../../lib/storage/offline-map-store";
import {
  getSelectedOfflineMapId,
  setSelectedOfflineMapId,
} from "../../lib/storage/offline-map-selection";
import { offlineDB } from "../../lib/storage/offline-db";
import { ensureLocationPermission } from "../../lib/device-location-permission";
import { getStorageBreakdown, cleanStorageCategories, type StorageBreakdownItem, type StorageCategory } from "../../lib/storage/storage-management";

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type GpsState = "prompt" | "granted" | "denied";
const directoryPickerAttributes = {
  webkitdirectory: "",
  directory: "",
} as unknown as InputHTMLAttributes<HTMLInputElement>;

function packageRelativePath(file: File): string {
  const path =
    (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
    file.name;
  const segments = path.replace(/\\/g, "/").split("/");
  return segments.length > 1 ? segments.slice(1).join("/") : segments[0] || "";
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(
    () => window.matchMedia("(display-mode: standalone)").matches,
  );
  const [gps, setGps] = useState<GpsState>("prompt");
  const [gpsBusy, setGpsBusy] = useState(false);
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("theme") !== "light";
    } catch {
      return document.documentElement.classList.contains("dark");
    }
  });
  const [storage, setStorage] = useState<{
    usage?: number;
    quota?: number;
    persistent?: boolean;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [offlinePackages, setOfflinePackages] = useState<OfflineMapPackageManifest[]>([]);
  const [selectedOfflineMapId, setSelectedOfflineMapIdState] = useState<string | null>(getSelectedOfflineMapId);
  const [packageBusy, setPackageBusy] = useState(false);
  const [storageBreakdown, setStorageBreakdown] = useState<StorageBreakdownItem[]>([]);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const refreshStorage = async () => {
    try {
      const estimate = await navigator.storage?.estimate?.();
      const persistent = await navigator.storage?.persisted?.();
      const breakdown = await getStorageBreakdown();
      setStorage({ ...estimate, persistent });
      setStorageBreakdown(breakdown.categories);
    } catch {
      setError("Não foi possível consultar o armazenamento deste dispositivo.");
    }
  };
  const performCleanup = async () => {
    if (selectedCategories.size === 0) return;
    setCleanupBusy(true);
    setError(null);
    try {
      const result = await cleanStorageCategories(Array.from(selectedCategories));
      if (result.errors.length > 0) {
        setError(`Erro ao limpar algumas categorias: ${result.errors.map(e => e.category).join(", ")}`);
      }
      setCleanupDialogOpen(false);
      setSelectedCategories(new Set());
      await refreshStorage();
      await refreshOfflinePackages();
      toast({
        title: "Limpeza concluída",
        description: `${result.cleaned.length} categoria(s) limpa(s) com sucesso.`,
        variant: "success",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha na limpeza.");
    } finally {
      setCleanupBusy(false);
    }
  };
  const toggleCategory = (category: StorageCategory) => {
    const next = new Set(selectedCategories);
    if (next.has(category)) next.delete(category);
    else next.add(category);
    setSelectedCategories(next);
  };
  const refreshOfflinePackages = async () => {
    const installed = await offlineMapStore.list();
    const manifests = installed.map((value) => value.manifest);
    setOfflinePackages(manifests);
    const selected = getSelectedOfflineMapId();
    if (selected && manifests.some((manifest) => manifest.id === selected)) {
      setSelectedOfflineMapIdState(selected);
      return;
    }
    if (selected) setSelectedOfflineMapId(null);
    const latest = [...installed].sort((a, b) => b.installedAt.localeCompare(a.installedAt))[0];
    const next = latest?.manifest.id ?? null;
    if (next) setSelectedOfflineMapId(next);
    setSelectedOfflineMapIdState(next);
  };
  useEffect(() => {
    let disposed = false;
    let permission: PermissionStatus | undefined;
    const capturePrompt = (event: Event) => {
      if ("prompt" in event && "userChoice" in event) {
        event.preventDefault();
        setPrompt(event as InstallPrompt);
      }
    };
    const appInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    const themeChanged = () =>
      setDark(document.documentElement.classList.contains("dark"));
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", appInstalled);
    window.addEventListener("geonexo-theme-change", themeChanged);
    const permissionChanged = () => {
      if (!disposed && permission) setGps(permission.state);
    };
    void navigator.permissions
      ?.query({ name: "geolocation" })
      .then((status) => {
        if (disposed) return;
        permission = status;
        permissionChanged();
        status.addEventListener("change", permissionChanged);
      })
      .catch(() => undefined);
    void refreshStorage();
    void refreshOfflinePackages().catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os mapas offline."),
    );
    return () => {
      disposed = true;
      permission?.removeEventListener("change", permissionChanged);
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", appInstalled);
      window.removeEventListener("geonexo-theme-change", themeChanged);
    };
  }, []);
  const install = async () => {
    if (!prompt) {
      toast({
        title: "Adicionar à tela inicial",
        description:
          "Use a opção de instalação ou Adicionar à Tela Inicial no menu do navegador.",
      });
      return;
    }
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setPrompt(null);
      if (choice.outcome === "accepted")
        toast({
          title: "Instalação solicitada",
          description: "Aguarde o dispositivo concluir a instalação.",
        });
    } catch {
      setError(
        "Não foi possível abrir a instalação. Tente pelo menu do navegador.",
      );
    }
  };
  const locate = async () => {
    if (!navigator.geolocation) {
      setError("Localização indisponível neste dispositivo.");
      return;
    }
    setGpsBusy(true);
    setError(null);
    // No WebView Android a permissão do sistema precisa existir antes de a Web
    // Geolocation API funcionar; na web este passo é um no-op.
    const permission = await ensureLocationPermission();
    if (permission.state === "denied") {
      setGpsBusy(false);
      setGps("denied");
      setError(
        permission.reason === "unavailable"
          ? "Serviço de localização desligado no dispositivo. Ligue o GPS e tente novamente."
          : "Permissão de localização negada. Altere a permissão do dispositivo para tentar novamente.",
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsBusy(false);
        setGps("granted");
        void offlineDB
          .save("permissions", "gps", {
            status: "granted",
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
          .catch(() =>
            setError(
              "A localização foi obtida, mas não foi possível salvá-la localmente.",
            ),
          );
        toast({
          title: "Localização obtida",
          description: `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)} (precisão ${Math.round(position.coords.accuracy)} m)`,
        });
      },
      (cause) => {
        setGpsBusy(false);
        if (cause.code === 1) setGps("denied");
        setError(
          cause.code === 1
            ? "Permissão de localização negada. Altere a permissão do dispositivo para tentar novamente."
            : "Não foi possível obter a localização. Tente novamente em uma área com sinal.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };
  const changeTheme = (next: boolean) => {
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next);
      setDark(next);
      window.dispatchEvent(new Event("geonexo-theme-change"));
    } catch {
      setError("Não foi possível salvar a preferência de tema.");
    }
  };
  const preserveStorage = async () => {
    try {
      const granted = await navigator.storage?.persist?.();
      await refreshStorage();
      toast({
        title: granted ? "Armazenamento protegido" : "Proteção não concedida",
        description: granted
          ? "O dispositivo concedeu armazenamento persistente para os dados locais."
          : "O navegador controla essa permissão. Exporte uma cópia dos arquivos importantes.",
      });
    } catch {
      setError("Não foi possível solicitar armazenamento persistente.");
    }
  };
  const installOfflinePackage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length === 0) return;
    setPackageBusy(true);
    setError(null);
    try {
      const filesByPath = new Map<string, File>();
      for (const file of files) {
        const path = packageRelativePath(file);
        if (!path || filesByPath.has(path)) throw new Error(`Caminho ausente ou duplicado no pacote: ${path || file.name}`);
        filesByPath.set(path, file);
      }
      const manifestFile = filesByPath.get("manifest.json");
      if (!manifestFile) throw new Error("A pasta selecionada precisa conter manifest.json na raiz.");
      const manifest: OfflineMapPackageManifest = offlineMapPackageManifestSchema.parse(
        JSON.parse(await manifestFile.text()) as unknown,
      );
      const archives = [...filesByPath.entries()].filter(([path]) => /\.pmtiles$/i.test(path));
      if (archives.length !== 1) throw new Error("A pasta precisa conter exatamente um arquivo PMTiles.");
      const assets = new Map<string, Blob>([["package.pmtiles", archives[0]![1]]]);
      for (const ref of [manifest.style, ...manifest.glyphs, ...manifest.sprites]) {
        const file = filesByPath.get(ref.path);
        if (!file) throw new Error(`O pacote não contém o arquivo ${ref.path}.`);
        assets.set(ref.path, file);
      }
      await offlineMapStore.install(manifest, assets);
      setSelectedOfflineMapId(manifest.id);
      setSelectedOfflineMapIdState(manifest.id);
      await refreshOfflinePackages();
      setSelectedOfflineMapId(manifest.id);
      setSelectedOfflineMapIdState(manifest.id);
      toast({
        title: "Mapa offline instalado",
        description: `${manifest.label} ficará disponível neste dispositivo sem conexão.`,
        variant: "success",
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível instalar o pacote offline.";
      setError(message);
      toast({ title: "Instalação não concluída", description: message, variant: "error" });
    } finally {
      setPackageBusy(false);
    }
  };
  const selectOfflinePackage = (manifest: OfflineMapPackageManifest) => {
    try {
      setSelectedOfflineMapId(manifest.id);
      setSelectedOfflineMapIdState(manifest.id);
      toast({ title: "Mapa selecionado", description: `${manifest.label} será usado na próxima abertura do mapa.` });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a seleção.");
    }
  };
  const removeOfflinePackage = async (manifest: OfflineMapPackageManifest) => {
    setPackageBusy(true);
    setError(null);
    try {
      await offlineMapStore.remove(manifest.id);
      if (selectedOfflineMapId === manifest.id) setSelectedOfflineMapId(null);
      await refreshOfflinePackages();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível remover o pacote.");
    } finally {
      setPackageBusy(false);
    }
  };
  const formatBytes = (bytes?: number) =>
    bytes === undefined
      ? "Não informado"
      : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
  return (
    <section className="min-w-0 space-y-6 bg-background p-4 text-on-surface md:p-6">
      <header>
        <h1 className="text-2xl font-bold">
          Configurações do Aplicativo & Dispositivo
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Aparência, instalação, localização e dados deste dispositivo.
        </p>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-400/40 p-3 text-sm"
        >
          {error}
        </p>
      )}
      <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
        <h2 className="text-lg font-semibold">Aplicativo no dispositivo</h2>
        <p className="my-3 text-sm text-on-surface-variant">
          {installed
            ? "Aberto como aplicativo instalado."
            : "Adicione à tela inicial para abrir em uma janela própria."}
        </p>
        <button
          disabled={installed}
          onClick={() => void install()}
          className="rounded-lg bg-gradient-to-r from-brand-blue to-brand-cyan px-4 py-2 font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {installed ? "Instalado" : "Instalar aplicativo"}
        </button>
      </div>
      <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
        <h2 className="text-lg font-semibold">Aparência</h2>
        <label className="mt-3 flex min-h-[44px] items-center gap-3">
          <input
            type="checkbox"
            checked={dark}
            onChange={(event) => changeTheme(event.target.checked)}
          />
          Tema escuro
        </label>
      </div>
      <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
        <h2 className="text-lg font-semibold">Localização</h2>
        <p className="my-3 text-sm text-on-surface-variant">
          {gps === "granted"
            ? "Permissão concedida"
            : gps === "denied"
              ? "Permissão negada"
              : "Permissão ainda não concedida"}
        </p>
        <button
          disabled={gpsBusy}
          onClick={locate}
          className="rounded-lg border border-outline-variant px-4 py-2"
        >
          {gpsBusy ? "Localizando…" : "Solicitar localização"}
        </button>
      </div>
      <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
        <h2 className="text-lg font-semibold">Armazenamento local</h2>
        <dl className="my-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt>Uso total estimado</dt>
            <dd className="font-semibold">{formatBytes(storage.usage)}</dd>
          </div>
          <div>
            <dt>Quota total</dt>
            <dd>{formatBytes(storage.quota)}</dd>
          </div>
          <div>
            <dt>Persistente</dt>
            <dd>{storage.persistent ? "Sim" : "Não"}</dd>
          </div>
        </dl>

        {storageBreakdown.length > 0 && (
          <div className="my-4 space-y-2 rounded-xl border border-outline-variant p-3 bg-surface">
            <p className="text-xs font-semibold uppercase text-on-surface-variant">Detalhamento</p>
            {storageBreakdown.map(item => (
              <div key={item.category} className="flex justify-between text-xs">
                <span>{item.label} ({item.itemCount})</span>
                <span className="font-mono">{formatBytes(item.estimatedBytes)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => void preserveStorage()}
            className="rounded-lg border border-outline-variant px-4 py-2 text-sm"
          >
            Proteger dados
          </button>
          <Dialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen}>
            <DialogTrigger asChild>
              <button
                className="rounded-lg border border-red-400/40 px-4 py-2 text-sm text-red-500 hover:bg-red-50"
              >
                Limpar dados...
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Limpar Armazenamento</DialogTitle>
                <DialogDescription>
                  Selecione as categorias para remoção permanente. Ação irreversível.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-4">
                {storageBreakdown.filter(i => i.itemCount > 0).map(item => (
                  <label key={item.category} className="flex items-center gap-3 p-2 rounded hover:bg-surface-container">
                    <Checkbox
                      checked={selectedCategories.has(item.category)}
                      onCheckedChange={() => toggleCategory(item.category as StorageCategory)}
                    />
                    <div className="text-sm">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-on-surface-variant">{formatBytes(item.estimatedBytes)} • {item.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCleanupDialogOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={() => void performCleanup()} disabled={cleanupBusy || selectedCategories.size === 0}>
                  {cleanupBusy ? "Limpando..." : "Confirmar Limpeza"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
        <h2 className="text-lg font-semibold">Mapa offline</h2>
        <p className="my-3 text-sm text-on-surface-variant">
          Instale um pacote licenciado com manifest.json, um arquivo PMTiles, estilo, fontes e sprites. O pacote fica neste dispositivo.
        </p>
        <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg bg-gradient-to-r from-brand-blue to-brand-cyan px-4 py-2 font-semibold text-white hover:brightness-110">
          {packageBusy ? "Processando pacote…" : "Selecionar pasta do pacote"}
          <input
            type="file"
            multiple
            {...directoryPickerAttributes}
            onChange={(event) => void installOfflinePackage(event)}
            disabled={packageBusy}
            className="sr-only"
            aria-label="Selecionar pasta do pacote de mapa offline"
          />
        </label>
        <ul className="mt-4 space-y-2">
          {offlinePackages.length === 0 ? (
            <li className="text-sm text-on-surface-variant">Nenhum pacote offline instalado.</li>
          ) : offlinePackages.map((manifest) => (
            <li key={manifest.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant p-3">
              <div>
                <p className="font-semibold">{manifest.label}</p>
                <p className="text-xs text-on-surface-variant">{manifest.attribution}</p>
                {selectedOfflineMapId === manifest.id && <p className="text-xs text-emerald-500">Selecionado para abrir no mapa</p>}
              </div>
              <div className="flex gap-2">
                {selectedOfflineMapId !== manifest.id && <button type="button" disabled={packageBusy} onClick={() => selectOfflinePackage(manifest)} className="min-h-[44px] rounded-lg border border-outline-variant px-3 text-sm">Usar no mapa</button>}
                <button type="button" disabled={packageBusy} onClick={() => void removeOfflinePackage(manifest)} className="min-h-[44px] rounded-lg border border-red-400/40 px-3 text-sm text-red-500">Remover</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
