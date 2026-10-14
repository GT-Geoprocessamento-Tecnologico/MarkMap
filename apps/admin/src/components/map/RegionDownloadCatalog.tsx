// Desenvolvido por MtsFerreira. Escolher e baixar mapas sem editar arquivos ou URLs.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { OfflineMapPackageManifest } from "@geonexo/contracts";
import { offlineMapStore } from "../../lib/storage/offline-map-store";
import {
  getSelectedOfflineMapId, setSelectedOfflineMapId, subscribeSelectedOfflineMapId,
} from "../../lib/storage/offline-map-selection";
import { subscribeRegionCatalogChanges } from "../../lib/storage/region-catalog-events.mjs";
import { ResumableInstaller, type InstallerStatus } from "../../lib/storage/resumable-installer";
import { rememberRegionSource } from "../../lib/storage/region-source-registry";
import { describeRegionInstallError } from "../../lib/storage/region-install-feedback.mjs";
import {
  fetchPublicRegionCatalog, regionCoversPoint, recommendLocalRegion, normalizeRegionSearch, type PublicRegion,
} from "../../lib/storage/public-region-catalog";
import { installCatalogRegion } from "../../lib/storage/catalog-region-install";
import { shouldAutoLocateOnOpen, getFreshDevicePosition, rememberLocationApproval } from "../../lib/location-consent";
import { ensureLocationPermission } from "../../lib/device-location-permission";
import { getAutomaticRegionDownload, setAutomaticRegionDownload } from "../../lib/storage/auto-region-download";

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
  mapCenter, showInstalled = true, disabled = false, onBusyChange, onInstalled, onSelected,
}: Props) {
  const [regions, setRegions] = useState<PublicRegion[]>([]);
  const [installed, setInstalled] = useState<OfflineMapPackageManifest[]>([]);
  const [search, setSearch] = useState("");
  const [devicePoint, setDevicePoint] = useState<readonly [number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [autoDownload, setAutoDownload] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [installedReady, setInstalledReady] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" && navigator.onLine);
  const autoAttempted = useRef(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [stage, setStage] = useState<InstallerStatus | "checking">("checking");
  const [percent, setPercent] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const current = useRef<{ controller: AbortController; installer: ResumableInstaller } | null>(null);
  const selectedId = useSyncExternalStore(
    subscribeSelectedOfflineMapId, getSelectedOfflineMapId, () => null,
  );

  const refreshInstalled = useCallback(async () => {
    const packages = await offlineMapStore.list();
    setInstalled(packages.map(({ manifest }) => manifest));
    setInstalledReady(true);
  }, []);
  useEffect(() => {
    void refreshInstalled().catch(() => setNotice("Não foi possível consultar os mapas salvos."));
    return subscribeRegionCatalogChanges(() => {
      void refreshInstalled().catch(() => undefined);
    });
  }, [refreshInstalled]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setCatalogError("");
    void fetchPublicRegionCatalog(controller.signal).then(setRegions).catch(() => {
      if (!controller.signal.aborted) setCatalogError(
        "Não foi possível consultar novos mapas. Seus mapas baixados continuam disponíveis.",
      );
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => { onBusyChange?.(busyId !== null); }, [busyId, onBusyChange]);
  useEffect(() => {
    let active = true;
    void getAutomaticRegionDownload().then(enabled => {
      if (active) setAutoDownload(enabled);
    }).catch(() => undefined);
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
    return () => { active = false; };
  }, []);
  const findMyRegion = async () => {
    if (locating) return;
    setLocating(true);
    setLocationMessage("");
    try {
      const permission = await ensureLocationPermission();
      if (permission.state !== "granted") {
        setLocationMessage("Autorize a localização nas configurações do aparelho.");
        return;
      }
      const fix = await getFreshDevicePosition();
      if (!fix) {
        setLocationMessage("Não foi possível obter a posição atual. Escolha a região pelo nome.");
        return;
      }
      setDevicePoint([fix.lon, fix.lat]);
      void rememberLocationApproval().catch(() => undefined);
    } catch {
      setLocationMessage("GPS indisponível. Você ainda pode escolher uma região.");
    } finally { setLocating(false); }
  };
  useEffect(() => () => {
    // Leaving the screen stops network activity but preserves verified checkpoints.
    current.current?.controller.abort();
    current.current?.installer.abortInstall();
  }, []);

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
  const download = useCallback(async (region: PublicRegion, replaceCheckpoint = false) => {
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
        signal: controller.signal, replaceCheckpoint,
        onProgress: (progress) => {
          if (controller.signal.aborted) return;
          setStage(progress.status);
          setPercent(progress.percent);
        },
      });
      if (controller.signal.aborted) return;
      if (result.kind === "confirm") {
        setConfirmId(region.id);
        setNotice("Um download antigo pertence a outra versão. Confirme para baixar a nova versão.");
      } else if (result.kind === "error") {
        const guidance = describeRegionInstallError(result.code);
        setNotice(guidance.message);
        if (result.code === "outdated-checkpoint") setConfirmId(region.id);
      } else {
        rememberRegionSource(result.manifest.id, region.manifestUrl);
        setSelectedOfflineMapId(result.manifest.id);
        await refreshInstalled();
        setNotice(`${result.manifest.label} baixado e pronto para usar sem internet.`);
        onInstalled?.();
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setNotice(cause instanceof Error && cause.name !== "ZodError"
          ? cause.message
          : "Este mapa ainda não pôde ser validado. Nenhum mapa instalado foi alterado.");
      }
    } finally {
      if (controller.signal.aborted) setNotice("Download interrompido. Você poderá retomar depois.");
      if (current.current?.controller === controller) current.current = null;
      setBusyId(null);
      setPercent(null);
    }
  }, [disabled, onInstalled, refreshInstalled]);

  const suggested = devicePoint ? recommendLocalRegion(regions, devicePoint) : null;
  useEffect(() => {
    if (!autoDownload || autoSaving || !installedReady || !online || !suggested || disabled ||
        installed.some(item => item.id === suggested.id)) return;
    // Data-saver protects limited connections. Permission is local and explicit.
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    if (autoAttempted.current.has(suggested.id)) return;
    autoAttempted.current.add(suggested.id);
    void download(suggested);
  }, [autoDownload, autoSaving, installedReady, online, suggested, disabled, installed, download]);
  const matches = useMemo(() => {
    const term = normalizeRegionSearch(search.trim());
    return regions.filter((region) =>
      normalizeRegionSearch(`${region.label} ${region.area}`).includes(term),
    ).sort((a, b) =>
      Number(regionCoversPoint(b, devicePoint ?? mapCenter)) -
        Number(regionCoversPoint(a, devicePoint ?? mapCenter)) ||
      a.label.localeCompare(b.label, "pt-BR"),
    );
  }, [devicePoint, mapCenter, regions, search]);

  return <div className="min-w-0 space-y-4 text-on-surface">
    <div>
      <h3 className="text-base font-semibold">Escolha um mapa para baixar</h3>
      <p className="mt-1 text-xs text-on-surface-variant">
        Encontre a região desejada e toque em Baixar. Depois, o mapa funciona sem internet.
      </p>
    </div>
    <div className="space-y-2 rounded-xl border border-outline-variant p-3 text-sm">
      <button type="button" onClick={() => void findMyRegion()} disabled={locating || disabled}
        className="min-h-[44px] w-full rounded-lg border border-primary/50 px-3 font-semibold text-on-surface disabled:opacity-50">
        {locating ? "Localizando região…" : "Encontrar mapa da minha localização"}
      </button>
      {devicePoint && <p role="status" className="text-xs text-on-surface-variant">
        {suggested
          ? `Mapa sugerido pelo GPS: ${suggested.label}. ${autoDownload ? "Download automático autorizado." : "Confira o tamanho e toque em Baixar."}`
          : "Localização encontrada. Ainda não há mapa publicado para esta área."}
      </p>}
      {locationMessage && <p role="status" className="text-xs text-on-surface-variant">{locationMessage}</p>}
      <label className="flex min-h-[44px] items-center gap-3 text-sm text-on-surface">
        <input type="checkbox" checked={autoDownload} disabled={autoSaving || disabled}
          aria-label="Baixar automaticamente o mapa da minha região"
          onChange={event => {
            const enabled = event.target.checked;
            setAutoDownload(enabled);
            setAutoSaving(true);
            void setAutomaticRegionDownload(enabled)
              .catch(() => {
                setAutoDownload(!enabled);
                setLocationMessage("Não foi possível salvar a preferência no aparelho.");
              })
              .finally(() => setAutoSaving(false));
          }}
          className="h-5 w-5 shrink-0 accent-primary disabled:opacity-60" />
        <span>Baixar automaticamente o mapa da minha região quando disponível
          <small className="block text-xs text-on-surface-variant">
            Ativação opcional. Pode consumir dados móveis e espaço no aparelho.
          </small>
        </span>
      </label>
      <p className="text-xs text-on-surface-variant">
        O GPS fica somente neste aparelho. Sem a opção ativada, o download exige o botão Baixar.
      </p>
    </div>
    <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
      placeholder="Buscar cidade, estado ou região" aria-label="Buscar mapas disponíveis"
      className="min-h-[44px] w-full rounded-xl border border-outline-variant bg-background px-3 text-sm text-on-surface placeholder:text-on-surface-variant" />
    {loading && <p role="status" className="text-sm text-on-surface-variant">Procurando mapas disponíveis…</p>}
    {catalogError && <div role="status" className="space-y-2 text-sm text-on-surface-variant">
      <p>{catalogError}</p>
      <button type="button" onClick={() => setRevision(value => value + 1)}
        className="min-h-[44px] rounded-lg border border-outline-variant px-3 text-on-surface">Tentar novamente</button>
    </div>}
    {!loading && !catalogError && matches.length === 0 &&
      <p role="status" className="rounded-xl border border-dashed border-outline-variant bg-surface-container-high p-4 text-sm text-on-surface-variant">
        {regions.length === 0
          ? "Ainda não há mapas regionais publicados para download. Os mapas aparecerão aqui quando estiverem disponíveis."
          : "Não encontramos uma região com esse nome."}
      </p>}
    <ul className="space-y-2">
      {matches.map((region) => {
        const saved = installed.some(item => item.id === region.id);
        const active = selectedId === region.id;
        const downloading = busyId === region.id;
        return <li key={region.id} className="space-y-2 rounded-xl border border-outline-variant bg-surface-container-high p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{region.label}</p>
              <p className="text-xs text-on-surface-variant">{region.area} · {sizeLabel(region.sizeBytes)}</p>
              <p className="mt-1 text-xs text-on-surface-variant">{region.attribution}</p>
            </div>
            {suggested?.id === region.id
              ? <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">Perto de você</span>
              : regionCoversPoint(region, mapCenter)
                ? <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">Área exibida</span>
                : null}
          </div>
          {saved
            ? <button type="button" disabled={disabled || busyId !== null}
                onClick={() => chooseInstalled(region.id)}
                className="min-h-[44px] w-full rounded-lg border border-outline-variant px-3 text-sm font-semibold disabled:opacity-50">
                {active ? "Mapa em uso" : "Usar no mapa"}
              </button>
            : <button type="button" disabled={disabled || busyId !== null}
                onClick={() => void download(region, confirmId === region.id)}
                className="min-h-[44px] w-full rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary disabled:opacity-50">
                {downloading ? "Preparando mapa…" : confirmId === region.id ? "Confirmar nova versão e baixar" : "Baixar mapa"}
              </button>}
          {downloading && <div role="status" aria-live="polite" className="space-y-2 text-xs text-on-surface-variant">
            <p>{stage === "activating" ? "Salvando mapa no aparelho…" :
              stage === "validating" ? "Verificando arquivos…" :
              stage === "checking" ? "Verificando disponibilidade…" :
              `Baixando mapa${percent !== null ? ` · ${percent}%` : ""}`}</p>
            {percent !== null && <progress aria-label={`Download de ${region.label}`} value={percent} max={100} className="w-full" />}
            {stage !== "activating" && <button type="button" onClick={cancel}
              className="min-h-[44px] rounded-lg border border-outline-variant px-3 text-on-surface">Cancelar download</button>}
          </div>}
        </li>;
      })}
    </ul>
    {notice && <p role="status" aria-live="polite" className="rounded-lg bg-primary/10 p-3 text-sm">{notice}</p>}
    {showInstalled && <div className="space-y-2 border-t border-outline-variant pt-3">
      <h4 className="text-sm font-semibold">Mapas no aparelho</h4>
      {installed.length === 0
        ? <p className="text-sm text-on-surface-variant">Nenhum mapa baixado neste dispositivo.</p>
        : <ul className="space-y-2">{installed.map(manifest => <li key={manifest.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-container-high px-3 py-2 text-sm">
            <span className="min-w-0 font-medium">{manifest.label}</span>
            <button type="button" disabled={disabled || busyId !== null}
              className="min-h-[44px] rounded-lg border border-outline-variant px-3 text-xs font-semibold disabled:opacity-50"
              onClick={() => chooseInstalled(manifest.id)}>
              {selectedId === manifest.id ? "Em uso" : "Usar"}
            </button>
          </li>)}</ul>}
    </div>}
    <p className="text-xs text-on-surface-variant">
      Use Wi-Fi para baixar regiões grandes. Os arquivos ficam neste dispositivo; não apague os dados do aplicativo.
    </p>
  </div>;
}
