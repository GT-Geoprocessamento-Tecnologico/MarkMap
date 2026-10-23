// Desenvolvido por MtsFerreira. Escolher e baixar mapas sem editar arquivos ou URLs.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { OfflineMapPackageManifest } from "@markmap/contracts";
import { offlineMapStore } from "../../lib/storage/offline-map-store";
import {
  getSelectedOfflineMapId,
  setSelectedOfflineMapId,
  subscribeSelectedOfflineMapId,
} from "../../lib/storage/offline-map-selection";
import { subscribeRegionCatalogChanges } from "../../lib/storage/region-catalog-events.mjs";
import {
  ResumableInstaller,
  type InstallerStatus,
} from "../../lib/storage/resumable-installer";
import { rememberRegionSource } from "../../lib/storage/region-source-registry";
import { describeRegionInstallError } from "../../lib/storage/region-install-feedback.mjs";
import {
  fetchPublicRegionCatalog,
  regionCoversPoint,
  recommendLocalRegion,
  normalizeRegionSearch,
  type PublicRegion,
} from "../../lib/storage/public-region-catalog";
import { installCatalogRegion } from "../../lib/storage/catalog-region-install";
import {
  shouldAutoLocateOnOpen,
  getFreshDevicePosition,
  rememberLocationApproval,
} from "../../lib/location-consent";
import { ensureLocationPermission } from "../../lib/device-location-permission";
import {
  getAutomaticRegionDownload,
  setAutomaticRegionDownload,
} from "../../lib/storage/auto-region-download";
import {
  fetchRegionLocationIndex,
  filterRegionsByLocation,
  type RegionLocation,
} from "../../lib/storage/region-location-index";
import { runCatalogDownloadQueue } from "../../lib/storage/catalog-download-queue";

type Props = {
  mapCenter?: readonly [number, number];
  showInstalled?: boolean;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onInstalled?: () => void;
  onSelected?: () => void;
};
const sizeLabel = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function RegionDownloadCatalog({
  mapCenter,
  showInstalled = true,
  disabled = false,
  onBusyChange,
  onInstalled,
  onSelected,
}: Props) {
  const [regions, setRegions] = useState<PublicRegion[]>([]);
  const [locations, setLocations] = useState<RegionLocation[]>([]);
  const [stateCode, setStateCode] = useState("");
  const [locationKind, setLocationKind] = useState<"all" | "state" | "city">(
    "all",
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [installed, setInstalled] = useState<OfflineMapPackageManifest[]>([]);
  const [search, setSearch] = useState("");
  const [devicePoint, setDevicePoint] = useState<
    readonly [number, number] | null
  >(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [autoDownload, setAutoDownload] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [installedReady, setInstalledReady] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" && navigator.onLine,
  );
  const autoAttempted = useRef(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [locationIndexError, setLocationIndexError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [stage, setStage] = useState<InstallerStatus | "checking">("checking");
  const [percent, setPercent] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [queueProgress, setQueueProgress] = useState<{
    total: number;
    completed: number;
    index: number;
    currentId: string;
  } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const current = useRef<{
    controller: AbortController;
    installer: ResumableInstaller;
  } | null>(null);
  const selectedId = useSyncExternalStore(
    subscribeSelectedOfflineMapId,
    getSelectedOfflineMapId,
    () => null,
  );

  const refreshInstalled = useCallback(async () => {
    const packages = await offlineMapStore.list();
    setInstalled(packages.map(({ manifest }) => manifest));
    setInstalledReady(true);
  }, []);
  useEffect(() => {
    void refreshInstalled().catch(() =>
      setNotice("Não foi possível consultar os mapas salvos."),
    );
    return subscribeRegionCatalogChanges(() => {
      void refreshInstalled().catch(() => undefined);
    });
  }, [refreshInstalled]);
  useEffect(() => {
    const controller = new AbortController();
    let catalogTimer: number | undefined;
    let catalogTimedOut = false;
    let locationController: AbortController | null = null;
    let locationTimer: number | undefined;
    setLoading(true);
    setCatalogError("");
    setLocationIndexError(false);
    catalogTimer = window.setTimeout(() => {
      catalogTimedOut = true;
      controller.abort();
    }, 15000);
    void fetchPublicRegionCatalog(controller.signal)
      .then(async (nextRegions) => {
        if (controller.signal.aborted) return;
        setRegions(nextRegions);
        setLoading(false);
        if (catalogTimer !== undefined) {
          window.clearTimeout(catalogTimer);
          catalogTimer = undefined;
        }
        const locationRequestController = new AbortController();
        locationController = locationRequestController;
        const abortLocation = () => locationRequestController.abort();
        controller.signal.addEventListener("abort", abortLocation, {
          once: true,
        });
        locationTimer = window.setTimeout(
          () => locationRequestController.abort(),
          5000,
        );
        try {
          setLocations(
            await fetchRegionLocationIndex(
              nextRegions,
              locationRequestController.signal,
            ),
          );
        } catch {
          if (!controller.signal.aborted) {
            setLocations([]);
            setLocationIndexError(true);
          }
        } finally {
          if (locationTimer !== undefined) window.clearTimeout(locationTimer);
          controller.signal.removeEventListener("abort", abortLocation);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted || catalogTimedOut)
          setCatalogError(
            catalogTimedOut
              ? "A consulta de novos mapas demorou mais que o esperado. Tente novamente; seus mapas baixados continuam disponíveis."
              : "Não foi possível consultar novos mapas. Seus mapas baixados continuam disponíveis.",
          );
      })
      .finally(() => {
        if (catalogTimer !== undefined) window.clearTimeout(catalogTimer);
        if (!controller.signal.aborted || catalogTimedOut) setLoading(false);
      });
    return () => {
      controller.abort();
      locationController?.abort();
      if (catalogTimer !== undefined) window.clearTimeout(catalogTimer);
      if (locationTimer !== undefined) window.clearTimeout(locationTimer);
    };
  }, [revision]);
  useEffect(() => {
    onBusyChange?.(busyId !== null);
  }, [busyId, onBusyChange]);
  useEffect(() => {
    let active = true;
    void getAutomaticRegionDownload()
      .then((enabled) => {
        if (active) setAutoDownload(enabled);
      })
      .catch(() => undefined);
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      active = false;
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  useEffect(() => {
    let active = true;
    // Existing OS grant only: startup must never reopen the permission popup.
    void (async () => {
      if (!(await shouldAutoLocateOnOpen())) return;
      const fix = await getFreshDevicePosition();
      if (active && fix) setDevicePoint([fix.lon, fix.lat]);
    })().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const findMyRegion = async () => {
    if (locating) return;
    setLocating(true);
    setLocationMessage("");
    try {
      const permission = await ensureLocationPermission();
      if (permission.state !== "granted") {
        setLocationMessage(
          "Autorize a localização nas configurações do aparelho.",
        );
        return;
      }
      const fix = await getFreshDevicePosition();
      if (!fix) {
        setLocationMessage(
          "Não foi possível obter a posição atual. Escolha a região pelo nome.",
        );
        return;
      }
      setDevicePoint([fix.lon, fix.lat]);
      void rememberLocationApproval().catch(() => undefined);
    } catch {
      setLocationMessage(
        "GPS indisponível. Você ainda pode escolher uma região.",
      );
    } finally {
      setLocating(false);
    }
  };
  useEffect(
    () => () => {
      // Leaving the screen stops network activity but preserves verified checkpoints.
      current.current?.controller.abort();
      current.current?.installer.abortInstall();
    },
    [],
  );

  const chooseInstalled = (id: string) => {
    setSelectedOfflineMapId(id);
    setNotice("Mapa selecionado. Disponível sem internet.");
    onSelected?.();
  };
  const cancel = () => {
    if (stage === "activating") return;
    current.current?.controller.abort();
    current.current?.installer.abortInstall();
  };
  const download = useCallback(
    async (region: PublicRegion, replaceCheckpoint = false) => {
      if (current.current || disabled) return;
      const controller = new AbortController();
      const installer = new ResumableInstaller();
      current.current = { controller, installer };
      setBusyId(region.id);
      setStage("checking");
      setPercent(null);
      setNotice("");
      setConfirmId(null);
      try {
        const result = await installCatalogRegion(region, installer, {
          signal: controller.signal,
          replaceCheckpoint,
          onProgress: (progress) => {
            if (controller.signal.aborted) return;
            setStage(progress.status);
            setPercent(progress.percent);
          },
        });
        if (controller.signal.aborted) return;
        if (result.kind === "confirm") {
          setConfirmId(region.id);
          setNotice(
            "Um download antigo pertence a outra versão. Confirme para baixar a nova versão.",
          );
        } else if (result.kind === "error") {
          const guidance = describeRegionInstallError(result.code);
          setNotice(guidance.message);
          if (result.code === "outdated-checkpoint") setConfirmId(region.id);
        } else {
          rememberRegionSource(result.manifest.id, region.manifestUrl);
          setSelectedOfflineMapId(result.manifest.id);
          await refreshInstalled();
          setNotice(
            `${result.manifest.label} baixado e pronto para usar sem internet.`,
          );
          onInstalled?.();
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setNotice(
            cause instanceof Error && cause.name !== "ZodError"
              ? cause.message
              : "Este mapa ainda não pôde ser validado. Nenhum mapa instalado foi alterado.",
          );
        }
      } finally {
        if (controller.signal.aborted)
          setNotice("Download interrompido. Você poderá retomar depois.");
        if (current.current?.controller === controller) current.current = null;
        setBusyId(null);
        setPercent(null);
      }
    },
    [disabled, onInstalled, refreshInstalled],
  );

  const downloadSelected = useCallback(async () => {
    if (current.current || disabled || selectedIds.size === 0) return;
    const controller = new AbortController();
    const queueRegions = regions.filter((region) => selectedIds.has(region.id));
    current.current = { controller, installer: new ResumableInstaller() };
    setBusyId("queue");
    setStage("checking");
    setPercent(null);
    setQueueProgress(null);
    setNotice("");
    let stopMessage = "";
    try {
      const result = await runCatalogDownloadQueue(queueRegions, {
        signal: controller.signal,
        installedIds: new Set(installed.map((item) => item.id)),
        install: async (region) => {
          const installer = new ResumableInstaller();
          current.current = { controller, installer };
          try {
            const outcome = await installCatalogRegion(region, installer, {
              signal: controller.signal,
              onProgress: (progress) => {
                if (!controller.signal.aborted) {
                  setStage(progress.status);
                  setPercent(progress.percent);
                }
              },
            });
            if (outcome.kind === "installed") {
              rememberRegionSource(outcome.manifest.id, region.manifestUrl);
              return "installed";
            }
            if (outcome.kind === "confirm") {
              setConfirmId(region.id);
              stopMessage =
                "Este mapa tem uma nova versão. Confirme a nova versão no cartão para continuar.";
              setNotice(stopMessage);
              return "confirm";
            }
            if (outcome.code === "outdated-checkpoint") setConfirmId(region.id);
            stopMessage = describeRegionInstallError(outcome.code).message;
          } catch (cause) {
            if (!controller.signal.aborted) {
              stopMessage =
                cause instanceof Error &&
                cause.name !== "TypeError" &&
                cause.name !== "ZodError"
                  ? cause.message
                  : "Não foi possível baixar este mapa. Verifique a conexão e tente novamente.";
            }
          }
          if (stopMessage) setNotice(stopMessage);
          return "error";
        },
        onProgress: (progress) => {
          setBusyId("queue");
          setQueueProgress(progress);
          setStage("checking");
          setPercent(Math.round((progress.completed / progress.total) * 100));
        },
      });
      if (result.status === "completed" && result.installedIds[0]) {
        setSelectedOfflineMapId(result.installedIds[0]);
        await refreshInstalled();
        onInstalled?.();
        setNotice(
          "Mapas selecionados baixados e prontos para uso sem internet.",
        );
        setSelectedIds(
          (previous) =>
            new Set(
              [...previous].filter((id) => !result.installedIds.includes(id)),
            ),
        );
      } else {
        if (result.installedIds.length) {
          await refreshInstalled();
          onInstalled?.();
          setSelectedIds(
            (previous) =>
              new Set(
                [...previous].filter((id) => !result.installedIds.includes(id)),
              ),
          );
        }
        if (result.status === "cancelled")
          setNotice(
            "Fila interrompida. Os mapas concluídos foram preservados; você poderá retomar os demais depois.",
          );
        else if (result.status === "stopped")
          setNotice(
            stopMessage ||
              "A fila foi interrompida; mapas já baixados foram preservados.",
          );
      }
    } catch (cause) {
      if (!controller.signal.aborted)
        setNotice(
          cause instanceof Error
            ? cause.message
            : "Não foi possível concluir a fila.",
        );
    } finally {
      if (current.current?.controller === controller) current.current = null;
      setBusyId(null);
      setPercent(null);
      setQueueProgress(null);
    }
  }, [
    disabled,
    installed,
    onInstalled,
    refreshInstalled,
    regions,
    selectedIds,
  ]);

  const suggested = devicePoint
    ? recommendLocalRegion(regions, devicePoint)
    : null;
  useEffect(() => {
    if (
      !autoDownload ||
      autoSaving ||
      !installedReady ||
      !online ||
      !suggested ||
      disabled ||
      busyId !== null ||
      current.current ||
      installed.some((item) => item.id === suggested.id)
    )
      return;
    // Data-saver protects limited connections. Permission is local and explicit.
    if (
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData
    )
      return;
    if (autoAttempted.current.has(suggested.id)) return;
    autoAttempted.current.add(suggested.id);
    void download(suggested);
  }, [
    autoDownload,
    autoSaving,
    installedReady,
    online,
    suggested,
    disabled,
    installed,
    download,
    busyId,
  ]);
  const matches = useMemo(() => {
    const term = normalizeRegionSearch(search.trim());
    const located = locations.length
      ? filterRegionsByLocation(regions, locations, stateCode, locationKind)
      : regions;
    return located
      .filter((region) =>
        normalizeRegionSearch(`${region.label} ${region.area}`).includes(term),
      )
      .sort(
        (a, b) =>
          Number(installed.some((item) => item.id === a.id)) -
            Number(installed.some((item) => item.id === b.id)) ||
          Number(regionCoversPoint(b, devicePoint ?? mapCenter)) -
            Number(regionCoversPoint(a, devicePoint ?? mapCenter)) ||
          a.label.localeCompare(b.label, "pt-BR"),
      );
  }, [
    devicePoint,
    installed,
    locationKind,
    locations,
    mapCenter,
    regions,
    search,
    stateCode,
  ]);
  const locationStates = useMemo(
    () =>
      [
        ...new Map(locations.map((item) => [item.stateCode, item.stateName])),
      ].sort(([, first], [, second]) => first.localeCompare(second, "pt-BR")),
    [locations],
  );
  const selectedRegions = regions.filter(
    (region) =>
      selectedIds.has(region.id) &&
      !installed.some((item) => item.id === region.id),
  );
  const availableCount = regions.filter(
    (region) => !installed.some((item) => item.id === region.id),
  ).length;
  const hasFilters =
    search.trim() !== "" || stateCode !== "" || locationKind !== "all";

  return (
    <div className="min-w-0 space-y-4 text-on-surface">
      <div>
        <h3 className="text-base font-semibold">Escolha um mapa para baixar</h3>
        <p className="mt-1 text-xs text-on-surface-variant">
          Encontre a região desejada e toque em Baixar. Depois, o mapa funciona
          sem internet.
        </p>
      </div>
      <details className="space-y-2 rounded-xl border border-outline-variant p-3 text-sm">
        <summary className="min-h-[44px] cursor-pointer py-2 font-semibold">
          Opções de localização
        </summary>
        <button
          type="button"
          onClick={() => void findMyRegion()}
          disabled={locating || disabled}
          className="min-h-[44px] w-full rounded-lg border border-primary/50 px-3 font-semibold text-on-surface disabled:opacity-50"
        >
          {locating
            ? "Localizando região…"
            : "Encontrar mapa da minha localização"}
        </button>
        {devicePoint && (
          <p role="status" className="text-xs text-on-surface-variant">
            {suggested
              ? `Mapa sugerido pelo GPS: ${suggested.label}. ${autoDownload ? "Download automático autorizado." : "Confira o tamanho e toque em Baixar."}`
              : "Localização encontrada. Ainda não há mapa publicado para esta área."}
          </p>
        )}
        {locationMessage && (
          <p role="status" className="text-xs text-on-surface-variant">
            {locationMessage}
          </p>
        )}
        <label className="flex min-h-[44px] items-center gap-3 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={autoDownload}
            disabled={autoSaving || disabled}
            aria-label="Baixar automaticamente o mapa da minha região"
            onChange={(event) => {
              const enabled = event.target.checked;
              setAutoDownload(enabled);
              setAutoSaving(true);
              void setAutomaticRegionDownload(enabled)
                .catch(() => {
                  setAutoDownload(!enabled);
                  setLocationMessage(
                    "Não foi possível salvar a preferência no aparelho.",
                  );
                })
                .finally(() => setAutoSaving(false));
            }}
            className="h-5 w-5 shrink-0 accent-primary disabled:opacity-60"
          />
          <span>
            Baixar automaticamente o mapa da minha região quando disponível
            <small className="block text-xs text-on-surface-variant">
              Ativação opcional. Pode consumir dados móveis e espaço no
              aparelho.
            </small>
          </span>
        </label>
        <p className="text-xs text-on-surface-variant">
          O GPS fica somente neste aparelho. Sem a opção ativada, o download
          exige o botão Baixar.
        </p>
      </details>
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar cidade, estado ou região"
        aria-label="Buscar mapas disponíveis"
        className="min-h-[44px] w-full rounded-xl border border-outline-variant bg-background px-3 text-sm text-on-surface placeholder:text-on-surface-variant"
      />
      {!loading && !catalogError && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant"
        >
          <span>
            {availableCount} mapa(s) disponível(is) para baixar ·{" "}
            {installed.length} no aparelho
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStateCode("");
                setLocationKind("all");
              }}
              className="min-h-[36px] rounded-lg border border-outline-variant px-2 font-semibold text-on-surface"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}
      {locations.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-on-surface-variant">
            Estado
            <select
              value={stateCode}
              onChange={(event) => setStateCode(event.target.value)}
              disabled={busyId !== null || disabled}
              aria-label="Filtrar por estado"
              className="mt-1 min-h-[44px] w-full rounded-lg border border-outline-variant bg-background px-2 text-sm text-on-surface"
            >
              <option value="">Todos os estados</option>
              {locationStates.map(([code, name]) => (
                <option key={code} value={code}>
                  {name} ({code})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-on-surface-variant">
            Tipo de região
            <select
              value={locationKind}
              onChange={(event) =>
                setLocationKind(event.target.value as typeof locationKind)
              }
              disabled={busyId !== null || disabled}
              aria-label="Filtrar por tipo de região"
              className="mt-1 min-h-[44px] w-full rounded-lg border border-outline-variant bg-background px-2 text-sm text-on-surface"
            >
              <option value="all">Todos</option>
              <option value="city">Cidades</option>
              <option value="state">Estados</option>
            </select>
          </label>
        </div>
      )}
      {(selectedRegions.length > 0 || busyId === "queue") && (
        <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {selectedRegions.length} mapa(s) selecionado(s) ·{" "}
              {sizeLabel(
                selectedRegions.reduce(
                  (total, region) => total + region.sizeBytes,
                  0,
                ),
              )}
            </span>
            <button
              type="button"
              onClick={() => void downloadSelected()}
              disabled={disabled || busyId !== null}
              className="min-h-[44px] rounded-lg bg-primary px-3 font-semibold text-on-primary disabled:opacity-50"
            >
              Baixar selecionados
            </button>
          </div>
          {queueProgress && (
            <div
              role="status"
              aria-live="polite"
              className="space-y-2 text-xs text-on-surface-variant"
            >
              <p>
                Baixando {queueProgress.index} de {queueProgress.total}:{" "}
                {regions.find((item) => item.id === queueProgress.currentId)
                  ?.label ?? queueProgress.currentId}
              </p>
              <progress
                aria-label="Progresso da fila de mapas"
                value={percent ?? 0}
                max={100}
                className="w-full"
              />
              <button
                type="button"
                onClick={cancel}
                disabled={stage === "activating"}
                className="min-h-[44px] rounded-lg border border-outline-variant px-3 text-on-surface disabled:opacity-50"
              >
                Cancelar fila
              </button>
            </div>
          )}
        </div>
      )}
      {loading && (
        <p role="status" className="text-sm text-on-surface-variant">
          Procurando mapas disponíveis…
        </p>
      )}
      {catalogError && (
        <div
          role="status"
          className="space-y-2 text-sm text-on-surface-variant"
        >
          <p>{catalogError}</p>
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
            className="min-h-[44px] rounded-lg border border-outline-variant px-3 text-on-surface"
          >
            Tentar novamente
          </button>
        </div>
      )}
      {locationIndexError && !catalogError && (
        <p role="status" className="text-xs text-on-surface-variant">
          Os filtros de estado e cidade estão temporariamente indisponíveis. A
          lista geral de mapas continua disponível.
        </p>
      )}
      {!loading && !catalogError && matches.length === 0 && (
        <p
          role="status"
          className="rounded-xl border border-dashed border-outline-variant bg-surface-container-high p-4 text-sm text-on-surface-variant"
        >
          {regions.length === 0
            ? "Ainda não há mapas regionais publicados para download. Os mapas aparecerão aqui quando estiverem disponíveis."
            : "Não encontramos uma região com esse nome."}
        </p>
      )}
      {!loading && !catalogError && matches.length > 6 && (
        <p className="text-xs text-on-surface-variant">
          Role dentro da lista para ver todos os {matches.length} mapas.
        </p>
      )}
      <ul className="max-h-[min(60vh,42rem)] space-y-2 overflow-y-auto pr-1">
        {matches.map((region) => {
          const saved = installed.some((item) => item.id === region.id);
          const active = selectedId === region.id;
          const downloading = busyId === region.id;
          const selected = selectedIds.has(region.id);
          const location = locations.find(
            (item) => item.regionId === region.id,
          );
          return (
            <li
              key={region.id}
              className="space-y-2 rounded-xl border border-outline-variant bg-surface-container-high p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{region.label}</p>
                  <p className="text-xs text-on-surface-variant">
                    {location &&
                      `${location.cityName ?? location.stateName} · `}
                    {region.area} · {sizeLabel(region.sizeBytes)}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {region.attribution}
                  </p>
                </div>
                {suggested?.id === region.id ? (
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                    Perto de você
                  </span>
                ) : regionCoversPoint(region, mapCenter) ? (
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                    Área exibida
                  </span>
                ) : null}
              </div>
              {!saved && (
                <label className="flex min-h-[44px] items-center gap-3 text-sm text-on-surface">
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={disabled || busyId !== null}
                    aria-label={`Selecionar ${region.label}`}
                    onChange={(event) =>
                      setSelectedIds((previous) => {
                        const next = new Set(previous);
                        if (event.target.checked) next.add(region.id);
                        else next.delete(region.id);
                        return next;
                      })
                    }
                    className="h-5 w-5 shrink-0 accent-primary disabled:opacity-60"
                  />
                  <span>Selecionar para baixar em fila</span>
                </label>
              )}
              {saved ? (
                <button
                  type="button"
                  disabled={disabled || busyId !== null}
                  onClick={() => chooseInstalled(region.id)}
                  className="min-h-[44px] w-full rounded-lg border border-outline-variant px-3 text-sm font-semibold disabled:opacity-50"
                >
                  {active ? "Mapa em uso" : "Usar no mapa"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={disabled || busyId !== null}
                  onClick={() => void download(region, confirmId === region.id)}
                  className="min-h-[44px] w-full rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary disabled:opacity-50"
                >
                  {downloading
                    ? "Preparando mapa…"
                    : confirmId === region.id
                      ? "Confirmar nova versão e baixar"
                      : "Baixar mapa"}
                </button>
              )}
              {downloading && (
                <div
                  role="status"
                  aria-live="polite"
                  className="space-y-2 text-xs text-on-surface-variant"
                >
                  <p>
                    {stage === "activating"
                      ? "Salvando mapa no aparelho…"
                      : stage === "validating"
                        ? "Verificando arquivos…"
                        : stage === "checking"
                          ? "Verificando disponibilidade…"
                          : `Baixando mapa${percent !== null ? ` · ${percent}%` : ""}`}
                  </p>
                  {percent !== null && (
                    <progress
                      aria-label={`Download de ${region.label}`}
                      value={percent}
                      max={100}
                      className="w-full"
                    />
                  )}
                  {stage !== "activating" && (
                    <button
                      type="button"
                      onClick={cancel}
                      className="min-h-[44px] rounded-lg border border-outline-variant px-3 text-on-surface"
                    >
                      Cancelar download
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {notice && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg bg-primary/10 p-3 text-sm"
        >
          {notice}
        </p>
      )}
      {showInstalled && (
        <div className="space-y-2 border-t border-outline-variant pt-3">
          <h4 className="text-sm font-semibold">Mapas no aparelho</h4>
          {installed.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              Nenhum mapa baixado neste dispositivo.
            </p>
          ) : (
            <ul className="space-y-2">
              {installed.map((manifest) => (
                <li
                  key={manifest.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-container-high px-3 py-2 text-sm"
                >
                  <span className="min-w-0 font-medium">{manifest.label}</span>
                  <button
                    type="button"
                    disabled={disabled || busyId !== null}
                    className="min-h-[44px] rounded-lg border border-outline-variant px-3 text-xs font-semibold disabled:opacity-50"
                    onClick={() => chooseInstalled(manifest.id)}
                  >
                    {selectedId === manifest.id ? "Em uso" : "Usar"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="text-xs text-on-surface-variant">
        Use Wi-Fi para baixar regiões grandes. Os arquivos ficam neste
        dispositivo; não apague os dados do aplicativo.
      </p>
    </div>
  );
}
