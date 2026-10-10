import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { featureBounds, loadProjectFeatures, matchesFeature } from "./map-data";
import { useParams, useSearch } from "@tanstack/react-router";
import { useToast } from "@geonexo/ui";
import type { GeoReference, Route, TransitNetwork } from "@geonexo/contracts";
import {
  addDrawingVertex,
  createDrawingSession,
  createFallbackStyle,
  createMapLibreMap,
  finishDrawingSession,
  getDefaultBasemaps,
  shouldFallbackOnError,
  undoDrawingVertex,
} from "@geonexo/maps";
import type {
  DrawingSession,
  GeometryType as DrawingGeometryType,
} from "@geonexo/maps";
import { addProtocol, Popup, Marker, removeProtocol } from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { createPropertyPopupContent } from "./property-popup";
import {
  exportDatasetGeoJSON,
  listDatasets,
  type DatasetRecord,
} from "../../lib/datasets/dataset-store";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCreateLayer, useProjectLayers } from "../../lib/hooks/layers";
import { createLocalFeature } from "../../lib/hooks/features";
import { localRepository } from "../../lib/local-repositories";
import {
  renderGeoPdfOverlay,
  resolveEmbeddedGeoReference,
  type GeoPdfOverlay,
} from "../../lib/pdf/geopdf-overlay";
import { offlineMapStore } from "../../lib/storage/offline-map-store";
import { getSelectedOfflineMapId, setSelectedOfflineMapId, subscribeSelectedOfflineMapId } from "../../lib/storage/offline-map-selection";
import { subscribeRegionCatalogChanges } from "../../lib/storage/region-catalog-events.mjs";
import { createRegionRevisionReconciler, subscribeRegionForeground } from "../../lib/storage/region-foreground-reconcile.mjs";
import { createOfflineMapRecovery, resolveOfflineBasemap } from "../../lib/map/offline-map-recovery.mjs";
import { ensureLocationPermission } from "../../lib/device-location-permission";
import {
  createOfflineAssetProtocol,
  createOfflineProtocol,
} from "@geonexo/maps/offline/protocol";
import { adaptOfflineStyle } from "@geonexo/maps/offline/style";
import { AppIcon, type AppIconName } from "../../components/AppIcon";
import { OfflineSearch } from "../../components/map/OfflineSearch";
import { OfflineRouting, type RoutePointSelection } from "../../components/map/OfflineRouting";
import { OfflineKnowledge } from "../../components/map/OfflineKnowledge";
import { OfflineElevation } from "../../components/map/OfflineElevation";
import { MAX_CONTOUR_BYTES, validateRegionalContours, contoursToGeoJSON } from "@geonexo/maps/elevation/contour-package.mjs";
import { loadRegionalPackageSearch } from '../../lib/search/regional-package-search';
import type { LocalSearchRecord } from '../../lib/search/local-map-search';
import { buildLocalMapSearchRecords } from "../../lib/search/local-map-search";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface TelemetryData {
  lat: number;
  lng: number;
  zoom: number;
  pitch: number;
  bearing: number;
}
interface MeasurePoint {
  lng: number;
  lat: number;
}

function haversineMeters(a: MeasurePoint, b: MeasurePoint): number {
  const R = 6371000;
  const r = (v: number) => (v * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}
function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`;
}

type SidePanel = "none" | "ferramentas" | "filtros" | "camadas" | "telemetria";
type MapControls = Awaited<ReturnType<typeof createMapLibreMap>>;

function routeAsGeoJSON(route: Route | null): GeoJSON.FeatureCollection {
  if (!route || route.geometry.length < 2) return { type: 'FeatureCollection', features: [] };
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {},
    geometry: { type: 'LineString', coordinates: route.geometry },
  }] };
}

export default function CommandCenterPage() {
  const { toast } = useToast();
  const search = useSearch({ strict: false }) as {
    datasetId?: string;
    pdfId?: string;
  };
  const params = useParams({ strict: false }) as { projectId?: string };
  const selectedOfflineMapId = useSyncExternalStore(
    subscribeSelectedOfflineMapId, getSelectedOfflineMapId, () => null,
  );
  const [catalogRevision, setCatalogRevision] = useState(0);
  const regionReconcilerRef = useRef<ReturnType<typeof createRegionRevisionReconciler> | null>(null);
  useEffect(() => {
    const reconciler = createRegionRevisionReconciler({
      readSelection: getSelectedOfflineMapId,
      readGeneration: async (id) => (await offlineMapStore.getActiveRevision(id))?.generation ?? null,
      onChanged: () => setCatalogRevision((value) => value + 1),
    });
    regionReconcilerRef.current = reconciler;
    const stopForeground = subscribeRegionForeground(() => { void reconciler.check(); });
    const stopCatalog = subscribeRegionCatalogChanges((regionId) => {
      // No unnecessary rerenders for unrelated packages or suspended views.
      if (regionId === getSelectedOfflineMapId() && document.visibilityState !== 'hidden')
        void reconciler.check();
    });
    return () => {
      stopForeground();
      stopCatalog();
      reconciler.dispose();
      if (regionReconcilerRef.current === reconciler) regionReconcilerRef.current = null;
    };
  }, []);
  // GeoPDF has precedence and should not be replaced by region changes.
  const activeRegionPackageId = search.pdfId ? null : selectedOfflineMapId;
  const regionalRenderRevision = search.pdfId ? 0 : catalogRevision;
  // When a new region generation is committed during neutral mode, offer the
  // latest package again instead of indefinitely retaining an old fallback.
  const neutralRegionId = activeRegionPackageId;
  // The neutral basemap is a temporary view choice, never an installed-package mutation.
  const [neutralFor, setNeutralFor] = useState<string | null>(null);
  const mapSource = resolveOfflineBasemap({
    regionId: activeRegionPackageId, revision: regionalRenderRevision,
    neutralFor, geoPdfId: search.pdfId,
  });
  useEffect(() => {
    if (!mapSource.neutralActive || !neutralRegionId) return;
    return subscribeRegionCatalogChanges((regionId) => {
      if (regionId === neutralRegionId) setCatalogRevision((value) => value + 1);
    });
  }, [mapSource.neutralActive, neutralRegionId]);
  const createLayerMutation = useCreateLayer(params.projectId ?? "");
  const layersQuery = useProjectLayers(params.projectId ?? "", { limit: 100 });
  const projectLayers = useMemo(
    () => layersQuery.data?.items ?? [],
    [layersQuery.data],
  );
  const featuresQuery = useQuery({
    queryKey: [
      "features",
      "workspace",
      params.projectId,
      projectLayers.map((layer) => layer.id),
      10000,
    ],
    queryFn: ({ signal }) => loadProjectFeatures(projectLayers, signal),
    enabled: Boolean(params.projectId) && projectLayers.length > 0,
  });
  const projectFeatures = useMemo(
    () => featuresQuery.data?.features ?? [],
    [featuresQuery.data],
  );
  const projectFeatureError = layersQuery.error ?? featuresQuery.error;
  const projectFeatureTruncated = Boolean(
    layersQuery.data?.nextCursor || featuresQuery.data?.truncated,
  );
  const [localReadError, setLocalReadError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapErrorRef = useRef<string | null>(null);
  mapErrorRef.current = mapError;
  const [mapRetryRevision, setMapRetryRevision] = useState(0);
  const retryMap = useCallback(() => {
    mapErrorRef.current = null;
    setMapError(null);
    setMapReady(false);
    setMapRetryRevision((value) => value + 1);
  }, []);
  const mapRecoveryRef = useRef<ReturnType<typeof createOfflineMapRecovery> | null>(null);
  useEffect(() => {
    const policy = createOfflineMapRecovery(retryMap);
    mapRecoveryRef.current = policy;
    const stop = subscribeRegionForeground(() => {
      policy.onForeground({
        hasError: Boolean(mapErrorRef.current),
        hasLocalContext: Boolean((activeRegionPackageId && !mapSource.neutralActive) || search.pdfId),
      });
    });
    return () => {
      stop();
      policy.dispose();
      if (mapRecoveryRef.current === policy) mapRecoveryRef.current = null;
    };
  }, [retryMap, activeRegionPackageId, regionalRenderRevision, mapSource.neutralActive, search.pdfId]);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [routingPickMode, setRoutingPickMode] = useState<RoutePointSelection['kind'] | null>(null);
  const routingPickRef = useRef<RoutePointSelection['kind'] | null>(null);
  routingPickRef.current = routingPickMode;
  const [routingPoint, setRoutingPoint] = useState<RoutePointSelection | null>(null);
  const [transitNetwork, setTransitNetwork] = useState<TransitNetwork | null>(null);
  const transitGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => {
    const lines = new Map((transitNetwork?.lines ?? []).map(line => [line.id, line]));
    return { type: 'FeatureCollection', features: (transitNetwork?.stations ?? []).map(station => {
      const names = station.lines.map(id => lines.get(id)?.name).filter((value): value is string => Boolean(value));
      const color = station.lines.map(id => lines.get(id)?.color).find(Boolean) ?? '#2586a3';
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [station.lon, station.lat] },
        properties: { name: station.name, operator: station.operator ?? '',
          lines: names.join(', '), color,
          attribution: transitNetwork?.attribution ?? '', license: (transitNetwork as (TransitNetwork & { license?: string }) | null)?.license ?? '' } };
    }) };
  }, [transitNetwork]);
  const transitGeoJSONRef = useRef(transitGeoJSON);
  transitGeoJSONRef.current = transitGeoJSON;
  const [plannedRoute, setPlannedRoute] = useState<Route | null>(null);
  const plannedRouteRef = useRef<Route | null>(null);
  plannedRouteRef.current = plannedRoute;
  const [appliedCount, setAppliedCount] = useState(0);
  const [geoPdfMessage, setGeoPdfMessage] = useState<string | null>(null);
  const [geoPdfReady, setGeoPdfReady] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const locationControlRef = useRef<MapControls["geolocate"] | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const gpsMarkerRef = useRef<Marker | null>(null);
  const navigationActiveRef = useRef(false);
  const updateNavigationPosition = useCallback((position: { lon: number; lat: number; accuracyM: number } | null, follow: boolean) => {
    if (!position) {
      gpsMarkerRef.current?.remove();
      gpsMarkerRef.current = null;
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    if (!gpsMarkerRef.current) {
      gpsMarkerRef.current = new Marker({ color: '#0075D6', scale: 0.8 })
        .setLngLat([position.lon, position.lat]).addTo(map);
    } else {
      gpsMarkerRef.current.setLngLat([position.lon, position.lat]);
    }
    if (follow && navigationActiveRef.current) {
      map.easeTo({ center: [position.lon, position.lat], zoom: Math.max(15, map.getZoom()), duration: 350 });
    }
  }, []);

  const [sidePanel, setSidePanel] = useState<SidePanel>("none");
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    lat: -15.785,
    lng: -47.92,
    zoom: 14,
    pitch: 60,
    bearing: 45,
  });
  const [measuring, setMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<MeasurePoint[]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [drawingSession, setDrawingSession] = useState<DrawingSession | null>(null);
  const drawingSessionRef = useRef<DrawingSession | null>(null);
  const drawLayerIdRef = useRef<string | null>(null);
  const [layerVisibility, setLayerVisibility] = useState<
    Record<string, boolean>
  >({ dataset: true });
  const [filterText, setFilterText] = useState("");
  const [filterType, setFilterType] = useState("todos");
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [datasetSelection, setDatasetSelection] = useState(
    search.datasetId ?? "none",
  );
  useEffect(() => {
    setDatasetSelection(search.datasetId ?? "none");
  }, [search.datasetId, params.projectId]);
  const activeDataset =
    datasetSelection === "none"
      ? undefined
      : datasets.find((dataset) => dataset.id === datasetSelection);
  const fullFeatures = useMemo(
    () => [
      ...((activeDataset?.geojson.features as GeoJSON.Feature[]) ?? []),
      ...projectFeatures,
    ],
    [activeDataset, projectFeatures],
  );
  const localSearchRecords = useMemo(() => buildLocalMapSearchRecords(fullFeatures), [fullFeatures]);
  const [regionalSearchRecords, setRegionalSearchRecords] = useState<LocalSearchRecord[]>([]);
  const [regionalSearchError, setRegionalSearchError] = useState<string | null>(null);
  useEffect(() => {
    // Routes and transit data belong to the previous map generation.
    navigationActiveRef.current = false;
    setPlannedRoute(null);
    setRoutingPoint(null);
    setRoutingPickMode(null);
    setTransitNetwork(null);
  }, [activeRegionPackageId, regionalRenderRevision]);
  useEffect(() => {
    let cancelled = false;
    setRegionalSearchRecords([]);
    setRegionalSearchError(null);
    if (!activeRegionPackageId) return;
    void loadRegionalPackageSearch(offlineMapStore, activeRegionPackageId)
      .then((records) => { if (!cancelled) { setRegionalSearchRecords(records); setRegionalSearchError(null); } })
      .catch((cause) => { if (!cancelled) { setRegionalSearchRecords([]); setRegionalSearchError(cause instanceof Error ? cause.message : 'Índice offline indisponível'); } });
    return () => { cancelled = true; };
  }, [activeRegionPackageId, regionalRenderRevision]);
  const combinedSearchRecords = useMemo(
    () => [...regionalSearchRecords, ...localSearchRecords],
    [regionalSearchRecords, localSearchRecords],
  );
  const activeGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: [
        ...(layerVisibility.dataset
          ? (
              (activeDataset?.geojson.features as GeoJSON.Feature[]) ?? []
            ).filter((feature) =>
              matchesFeature(feature, filterText, filterType),
            )
          : []),
        ...projectFeatures.filter(
          (feature) =>
            (layerVisibility[feature.layerId] ??
              projectLayers.find((layer) => layer.id === feature.layerId)
                ?.visibleByDefault ??
              true) &&
            matchesFeature(feature, filterText, filterType),
        ),
      ],
    }),
    [
      activeDataset,
      projectFeatures,
      projectLayers,
      layerVisibility,
      filterText,
      filterType,
    ],
  );
  const activeGeoJsonRef = useRef(activeGeoJson);
  activeGeoJsonRef.current = activeGeoJson;
  const drawingPreview = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!drawingSession || drawingSession.vertices.length === 0)
      return { type: "FeatureCollection", features: [] };

    const vertices = drawingSession.vertices;
    const features: GeoJSON.Feature[] = [
      {
        type: "Feature",
        properties: { role: "vertices" },
        geometry: { type: "MultiPoint", coordinates: vertices },
      },
    ];
    if (drawingSession.type === "LineString" && vertices.length >= 2) {
      features.unshift({
        type: "Feature",
        properties: { role: "shape" },
        geometry: { type: "LineString", coordinates: vertices },
      });
    } else if (drawingSession.type === "Polygon" && vertices.length >= 2) {
      if (vertices.length >= 3) {
        const first = vertices[0]!;
        const ring = [...vertices, [first[0], first[1]] as [number, number]];
        features.unshift({
          type: "Feature",
          properties: { role: "shape" },
          geometry: { type: "Polygon", coordinates: [ring] },
        });
      } else {
        features.unshift({
          type: "Feature",
          properties: { role: "shape" },
          geometry: { type: "LineString", coordinates: vertices },
        });
      }
    }
    return { type: "FeatureCollection", features };
  }, [drawingSession]);
  const drawingPreviewRef = useRef(drawingPreview);
  drawingPreviewRef.current = drawingPreview;
  const bounds = useMemo(() => featureBounds(fullFeatures), [fullFeatures]);
  const selectionKey = `${params.projectId ?? "global"}:${datasetSelection}:${fullFeatures.length}:${JSON.stringify(bounds)}`;
  const fitRef = useRef({ bounds, key: selectionKey });
  fitRef.current = { bounds, key: selectionKey };
  const fittedKeyRef = useRef("");
  const fitSelection = useCallback((map: MapLibreMap) => {
    const next = fitRef.current;
    if (!next.bounds) {
      fittedKeyRef.current = "";
      return;
    }
    if (fittedKeyRef.current === next.key) return;
    map.fitBounds(next.bounds, { padding: 48, maxZoom: 16, duration: 0 });
    fittedKeyRef.current = next.key;
  }, []);
  useEffect(() => {
    let disposed = false;
    void listDatasets()
      .then((items) => {
        if (!disposed) setDatasets(items);
      })
      .catch((cause) => {
        if (!disposed)
          setLocalReadError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível ler os datasets locais.",
          );
      });
    return () => {
      disposed = true;
    };
  }, []);

  const measuringRef = useRef(false);
  const measurePointsRef = useRef<MeasurePoint[]>([]);
  useEffect(() => {
    measuringRef.current = measuring;
  }, [measuring]);
  useEffect(() => {
    measurePointsRef.current = measurePoints;
  }, [measurePoints]);

  const togglePanel = (panel: SidePanel) => {
    setSidePanel((prev) => (prev === panel ? "none" : panel));
  };

  const resetDrawing = useCallback(() => {
    drawingSessionRef.current = null;
    drawLayerIdRef.current = null;
    setDrawingSession(null);
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
  }, []);

  const persistDrawing = useCallback(
    async (session: DrawingSession) => {
      const layerId = drawLayerIdRef.current;
      if (!layerId) {
        resetDrawing();
        return;
      }
      try {
        const geometry = finishDrawingSession(session);
        await createLocalFeature(layerId, { geometry, properties: {} });
        resetDrawing();
        await featuresQuery.refetch();
        toast({
          title: "Feição salva",
          description:
            "A geometria foi salva neste dispositivo e será sincronizada quando houver conexão.",
          variant: "success",
        });
      } catch (cause) {
        toast({
          title: "Não foi possível salvar",
          description:
            cause instanceof Error ? cause.message : "Geometria inválida.",
          variant: "error",
        });
      }
    },
    [featuresQuery, resetDrawing, toast],
  );
  const persistDrawingRef = useRef(persistDrawing);
  persistDrawingRef.current = persistDrawing;

  const startDrawing = useCallback(
    async (type: DrawingGeometryType) => {
      const projectId = params.projectId;
      if (!projectId) {
        toast({
          title: "Abra um projeto",
          description:
            "Para salvar desenhos, abra o mapa a partir de um projeto.",
          variant: "error",
        });
        return;
      }
      const specs = {
        Point: { kind: "point" as const, name: "Pontos de campo" },
        LineString: { kind: "line" as const, name: "Linhas de campo" },
        Polygon: { kind: "polygon" as const, name: "Polígonos de campo" },
      };
      try {
        let layer = projectLayers.find(
          (candidate) => candidate.geometryType === type,
        );
        if (!layer) {
          const spec = specs[type];
          layer = await createLayerMutation.mutateAsync({
            name: spec.name,
            description: "Camada criada automaticamente para coleta em campo.",
            kind: spec.kind,
            geometryType: type,
            srid: 4674,
            style: {},
            metadata: { createdBy: "field-draw" },
            visibleByDefault: true,
            sortOrder: projectLayers.length,
          });
        }
        setMeasuring(false);
        measurePointsRef.current = [];
        setMeasurePoints([]);
        setTotalDistance(0);
        drawLayerIdRef.current = layer.id;
        const session = createDrawingSession(type);
        drawingSessionRef.current = session;
        setDrawingSession(session);
        if (mapRef.current)
          mapRef.current.getCanvas().style.cursor = "crosshair";
        toast({
          title:
            type === "Point"
              ? "Toque para adicionar um ponto"
              : type === "LineString"
                ? "Toque para desenhar uma linha"
                : "Toque para desenhar um polígono",
          description:
            type === "Point"
              ? "O ponto será salvo imediatamente."
              : "Adicione os vértices e toque em Concluir.",
        });
      } catch (cause) {
        toast({
          title: "Ferramenta indisponível",
          description:
            cause instanceof Error
              ? cause.message
              : "Não foi possível preparar a camada.",
          variant: "error",
        });
      }
    },
    [
      createLayerMutation,
      params.projectId,
      projectLayers,
      toast,
    ],
  );

  const undoDrawing = useCallback(() => {
    const current = drawingSessionRef.current;
    if (!current) return;
    const next = undoDrawingVertex(current);
    drawingSessionRef.current = next;
    setDrawingSession(next);
  }, []);

  const finishDrawing = useCallback(() => {
    const current = drawingSessionRef.current;
    if (current) void persistDrawingRef.current(current);
  }, []);

  const updateTelemetry = useCallback((map: MapLibreMap) => {
    const center = map.getCenter();
    setTelemetry({
      lat: center.lat,
      lng: center.lng,
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
    });
  }, []);

  // Inicializa o mapa
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    setMapReady(false);
    setGeoPdfReady(false);
    setGeoPdfMessage(null);
    fittedKeyRef.current = "";
    let cancelled = false;
    let fallbackActive = !navigator.onLine;
    let protocolsRegistered = false;
    let geoPdfOverlay: GeoPdfOverlay | null = null;
    let regionalContours: GeoJSON.FeatureCollection | null = null;
    const releaseProtocols = () => {
      if (!protocolsRegistered) return;
      removeProtocol("pmtiles");
      removeProtocol("geonexo-package");
      protocolsRegistered = false;
    };
    const initialize = async () => {
      setMapError(null);
      let center: [number, number] = [-47.92, -15.785];
      let zoom = 14;
      let offlinePackageSelected = false;
      let displayedGeneration: string | null = null;
      let basemap = getDefaultBasemaps()[0];
      const selectedPackageId = mapSource.regionId;
      if (mapSource.neutralActive) {
        // Keep project GeoJSON and drawings accessible without tiles or network.
        fallbackActive = true;
        basemap = {
          ...basemap,
          styleUrl: `data:application/json,${encodeURIComponent(JSON.stringify(createFallbackStyle()))}`,
        };
      }

      if (search.pdfId) {
        fallbackActive = true;
        basemap = {
          ...basemap,
          styleUrl: `data:application/json,${encodeURIComponent(JSON.stringify(createFallbackStyle()))}`,
        };
        const record = await localRepository.getOriginal(search.pdfId);
        if (!record)
          throw new Error("Este PDF não está mais salvo neste dispositivo.");
        const storedReference =
          await localRepository.getMeta<GeoReference>(
            `pdfGeoref:${search.pdfId}`,
          );
        const resolved = storedReference
          ? { reference: storedReference, pageCount: null, reason: null }
          : await resolveEmbeddedGeoReference(record.blob);
        if (resolved.reference) {
          setGeoPdfMessage("Preparando mapa PDF offline…");
          geoPdfOverlay = await renderGeoPdfOverlay(
            record.blob,
            resolved.reference,
          );
          const lngs = geoPdfOverlay.coordinates.map(([lng]) => lng);
          const lats = geoPdfOverlay.coordinates.map(([, lat]) => lat);
          center = [
            (Math.min(...lngs) + Math.max(...lngs)) / 2,
            (Math.min(...lats) + Math.max(...lats)) / 2,
          ];
          zoom = 13;
        } else {
          setGeoPdfMessage(
            resolved.reason ??
              "Este PDF precisa ser posicionado manualmente antes de aparecer no mapa.",
          );
        }
      }

      if (selectedPackageId && !search.pdfId) {
        offlinePackageSelected = true;
        fallbackActive = true;
        const installed = await offlineMapStore.getActiveRevision(selectedPackageId);
        if (cancelled) return;
        if (!installed) {
          // A package might have been installed during the first lookup.
          const latest = await offlineMapStore.getActiveRevision(selectedPackageId);
          if (cancelled) return;
          if (latest) { setCatalogRevision((value) => value + 1); return; }
          if (getSelectedOfflineMapId() === selectedPackageId) {
            try { setSelectedOfflineMapId(null); } catch { /* storage may be denied */ }
          }
          throw new Error("O mapa selecionado foi removido ou não está disponível. Selecione outro em Configurações.");
        }
        displayedGeneration = installed.generation;
        const [archive, styleBlob] = await Promise.all([
          offlineMapStore.assetAtRevision(selectedPackageId, "package.pmtiles", installed.generation),
          offlineMapStore.assetAtRevision(selectedPackageId, installed.manifest.style.path, installed.generation),
        ]);
        if (cancelled) return;
        if (!archive || !styleBlob) {
          // Do not mix archived tiles with the style from a newer activation.
          if ((await offlineMapStore.getActiveRevision(selectedPackageId))?.generation !== installed.generation) {
            if (!cancelled) setCatalogRevision((value) => value + 1);
            return;
          }
          throw new Error("O pacote offline está incompleto neste dispositivo.");
        }
        let sourceStyle: Record<string, unknown>;
        try {
          sourceStyle = JSON.parse(await styleBlob.text()) as Record<string, unknown>;
        } catch {
          throw new Error("O estilo do pacote offline não é um JSON válido.");
        }
        const adaptedStyle = adaptOfflineStyle(sourceStyle, installed.manifest);
        if (installed.manifest.contourLines) {
          const contourRef = installed.manifest.contourLines;
          const contourBlob = await offlineMapStore.assetAtRevision(selectedPackageId, contourRef.path, installed.generation);
          if (!contourBlob || contourBlob.size !== contourRef.blob.bytes || contourBlob.size > MAX_CONTOUR_BYTES)
            throw new Error('Curvas de nível incompletas; reinstale o pacote regional.');
          const digest = await crypto.subtle.digest('SHA-256', await contourBlob.arrayBuffer());
          const digestHex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
          if (digestHex !== contourRef.blob.sha256)
            throw new Error('Falha de integridade nas curvas de nível regionais.');
          const parsedContours = validateRegionalContours(JSON.parse(await contourBlob.text()), installed.manifest.bounds);
          regionalContours = contoursToGeoJSON(parsedContours);
        }
        // Changes in another tab may have canceled this initialization while
        // assets were being read. Never register protocols for a stale map.
        if (cancelled) return;
        const file = new File([archive], "package.pmtiles", { type: "application/vnd.pmtiles" });
        const tileProtocol = createOfflineProtocol(installed.manifest, file);
        addProtocol("pmtiles", (params, controller) => tileProtocol.tile(params, controller));
        addProtocol(
          "geonexo-package",
          createOfflineAssetProtocol((packageId, path) =>
            packageId === installed.manifest.id
              ? offlineMapStore.assetAtRevision(packageId, path, installed.generation)
              : Promise.resolve(null),
          ),
        );
        protocolsRegistered = true;
        basemap = {
          ...(basemap ?? { id: "offline", name: installed.manifest.label, attribution: installed.manifest.attribution }),
          styleUrl: `data:application/json,${encodeURIComponent(JSON.stringify(adaptedStyle))}`,
        };
        const [minLng, minLat, maxLng, maxLat] = installed.manifest.bounds;
        center = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
        zoom = Math.min(8, installed.manifest.maxZoom);
      } else {
        if (!navigator.onLine) {
          basemap = {
            ...basemap,
            styleUrl: `data:application/json,${encodeURIComponent(JSON.stringify(createFallbackStyle()))}`,
          };
        }
      }

      const resolvedBasemap = basemap;
      if (!resolvedBasemap) throw new Error("Nenhum mapa base está disponível.");
      if (cancelled) {
        releaseProtocols();
        return;
      }
      // No WebView Android o GeolocateControl do MapLibre depende da Web
      // Geolocation API, que só responde depois que a permissão do sistema foi
      // concedida. Na web este passo é um no-op e o mapa abre normalmente.
      const locationPermission = await ensureLocationPermission();
      if (locationPermission.state === "denied") {
        toast({
          title: "Permissão de localização indisponível",
          description:
            "O mapa continuará funcionando, mas o GPS ficará inativo até a permissão ser liberada.",
          variant: "error",
        });
      }
      if (cancelled) {
        releaseProtocols();
        return;
      }
      const { map, geolocate } = await createMapLibreMap({
        container: mapContainer.current!,
        basemap: resolvedBasemap,
        center,
        zoom,
        trackUserLocation: true,
      });
      if (cancelled) {
        map.remove();
        releaseProtocols();
        return;
      }
      locationControlRef.current = geolocate;
      mapRef.current = map;
      regionReconcilerRef.current?.noteRendered(selectedPackageId, displayedGeneration);
      map.on("error", (event) => {
        if (cancelled) return;
        if (offlinePackageSelected || mapSource.neutralActive || Boolean(search.pdfId)) {
          // Tile/glyph errors can arrive in bursts; show one actionable error.
          if (!mapErrorRef.current) {
            const message = event.error?.message ?? "Não foi possível carregar um recurso cartográfico local.";
            mapErrorRef.current = message;
            setMapError(message);
          }
          return;
        }
        if (!fallbackActive && shouldFallbackOnError(event)) {
          fallbackActive = true;
          setMapReady(false);
          map.setStyle(createFallbackStyle());
        }
      });

        const onMove = () => updateTelemetry(map);
        map.on("move", onMove);
        map.on("zoom", onMove);
        map.on("pitch", onMove);
        map.on("rotate", onMove);

        const ensureSource = () => {
          if (cancelled) return;
          if (!map.getSource("local-dataset")) {
            map.addSource("local-dataset", {
              type: "geojson",
              data: activeGeoJsonRef.current as unknown as GeoJSON.FeatureCollection,
            });
            map.addLayer({
              id: "local-dataset-fill",
              type: "fill",
              source: "local-dataset",
              paint: { "fill-color": "#0ea5e9", "fill-opacity": 0.4 },
            });
            map.addLayer({
              id: "local-dataset-outline",
              type: "line",
              source: "local-dataset",
              paint: { "line-color": "#0284c7", "line-width": 2 },
            });
            map.addLayer({
              id: "local-dataset-points",
              type: "circle",
              source: "local-dataset",
              paint: {
                "circle-color": "#0284c7",
                "circle-radius": 5,
                "circle-stroke-color": "#fff",
                "circle-stroke-width": 1,
              },
            });
          }
          if (geoPdfOverlay && !map.getSource("geopdf-overlay")) {
            map.addSource("geopdf-overlay", {
              type: "image",
              url: geoPdfOverlay.url,
              coordinates: geoPdfOverlay.coordinates,
            });
            map.addLayer({
              id: "geopdf-overlay",
              type: "raster",
              source: "geopdf-overlay",
              paint: { "raster-opacity": 1 },
            });
            if (map.getLayer("local-dataset-fill"))
              map.moveLayer("geopdf-overlay", "local-dataset-fill");
            const lngs = geoPdfOverlay.coordinates.map(([lng]) => lng);
            const lats = geoPdfOverlay.coordinates.map(([, lat]) => lat);
            map.fitBounds(
              [
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)],
              ],
              { padding: 32, duration: 0 },
            );
            setGeoPdfReady(true);
            setGeoPdfMessage("Mapa PDF disponível offline.");
          }
          if (!map.getSource("draw-preview")) {
            map.addSource("draw-preview", {
              type: "geojson",
              data: drawingPreviewRef.current,
            });
            map.addLayer({
              id: "draw-preview-fill",
              type: "fill",
              source: "draw-preview",
              paint: { "fill-color": "#f59e0b", "fill-opacity": 0.2 },
            });
            map.addLayer({
              id: "draw-preview-line",
              type: "line",
              source: "draw-preview",
              paint: { "line-color": "#f59e0b", "line-width": 3 },
            });
            map.addLayer({
              id: "draw-preview-points",
              type: "circle",
              source: "draw-preview",
              paint: {
                "circle-color": "#f59e0b",
                "circle-radius": 6,
                "circle-stroke-color": "#fff",
                "circle-stroke-width": 2,
              },
            });
          }
          if (regionalContours && !map.getSource('regional-contours')) {
            map.addSource('regional-contours', { type: 'geojson', data: regionalContours });
            map.addLayer({ id: 'regional-contours-line', type: 'line', source: 'regional-contours',
              paint: { 'line-color': '#9a754e', 'line-width': ['case', ['get', 'major'], 1.6, 0.8], 'line-opacity': 0.75 },
            });
          }
          if (!map.getSource('regional-transit')) {
            map.addSource('regional-transit', { type: 'geojson', data: transitGeoJSONRef.current });
            map.addLayer({ id: 'regional-transit-points', type: 'circle', source: 'regional-transit',
              paint: { 'circle-radius': 5, 'circle-color': ['coalesce', ['get', 'color'], '#2586a3'],
                'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.4, 'circle-opacity': 0.9 },
            });
          }
          if (!map.getSource('offline-route')) {
            map.addSource('offline-route', { type: 'geojson', data: routeAsGeoJSON(plannedRouteRef.current) });
            map.addLayer({ id: 'offline-route-line', type: 'line', source: 'offline-route',
              paint: { 'line-color': '#dc2626', 'line-width': 5, 'line-opacity': 0.9 },
              layout: { 'line-join': 'round', 'line-cap': 'round' },
            });
          }
          fitSelection(map);
          setMapEpoch((value) => value + 1);
        };
        map.on("style.load", ensureSource);
        if (map.isStyleLoaded()) ensureSource();
        const publishApplied = () => {
          if (cancelled) return;
          setMapReady(true);
          setAppliedCount(activeGeoJsonRef.current.features.length);
        };
        map.on("sourcedata", (event) => {
          if (
            event.sourceId !== "local-dataset" ||
            !event.isSourceLoaded ||
            cancelled
          )
            return;
          // `sourcedata` antecede o desenho: publicar no proximo quadro pintado
          // garante que queryRenderedFeatures e o clique ja encontrem a feicao
          // aplicada. `idle` nao serve porque sem rede os tiles nunca terminam.
          if (map.loaded()) publishApplied();
          else map.once("render", publishApplied);
        });

        map.on("click", "local-dataset-fill", (e) => {
          if (!e.features?.length || measuringRef.current || drawingSessionRef.current) return;
          const props = e.features[0]?.properties ?? {};
          new Popup()
            .setLngLat(e.lngLat)
            .setDOMContent(createPropertyPopupContent(props))
            .addTo(map);
        });

        map.on("mouseenter", "local-dataset-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "local-dataset-fill", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", "local-dataset-points", (e) => {
          if (!e.features?.length || measuringRef.current || drawingSessionRef.current) return;
          new Popup()
            .setLngLat(e.lngLat)
            .setDOMContent(
              createPropertyPopupContent(e.features[0]?.properties ?? {}),
            )
            .addTo(map);
        });
        map.on("mouseenter", "local-dataset-points", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "local-dataset-points", () => {
          map.getCanvas().style.cursor = "";
        });

        map.on('click', 'regional-transit-points', (event) => {
          if (measuringRef.current || drawingSessionRef.current || !event.features?.length) return;
          new Popup().setLngLat(event.lngLat)
            .setDOMContent(createPropertyPopupContent(event.features[0]?.properties ?? {})).addTo(map);
        });

        // Listener de clique para medição
        map.on("click", (e) => {
          const currentDrawing = drawingSessionRef.current;
          if (currentDrawing) {
            const next = addDrawingVertex(currentDrawing, [
              e.lngLat.lng,
              e.lngLat.lat,
            ]);
            drawingSessionRef.current = next;
            setDrawingSession(next);
            if (next.type === "Point")
              void persistDrawingRef.current(next);
            return;
          }
          const picking = routingPickRef.current;
          if (picking) {
            setRoutingPoint({ kind: picking, location: [e.lngLat.lng, e.lngLat.lat] });
            setRoutingPickMode(null);
            return;
          }
          if (!measuringRef.current) return;
          const newPoint: MeasurePoint = {
            lng: e.lngLat.lng,
            lat: e.lngLat.lat,
          };
          const prev = measurePointsRef.current;
          const newPoints = [...prev, newPoint];
          measurePointsRef.current = newPoints;
          setMeasurePoints(newPoints);

          let dist = 0;
          for (let i = 1; i < newPoints.length; i++) {
            dist += haversineMeters(newPoints[i - 1]!, newPoints[i]!);
          }
          setTotalDistance(dist);

          const marker = new Marker({ color: "#f59e0b", scale: 0.8 })
            .setLngLat([newPoint.lng, newPoint.lat])
            .addTo(map);
          markersRef.current.push(marker);
        });
    };
    void initialize().catch((cause) => {
      if (cancelled) return;
      regionReconcilerRef.current?.resetPending();
      releaseProtocols();
      const message = cause instanceof Error ? cause.message : "Não foi possível iniciar o mapa neste dispositivo.";
      mapErrorRef.current = message;
      setMapError(message);
        toast({
          title: "Mapa indisponível",
          description:
            "Confira o pacote offline em Configurações. Os arquivos locais continuam disponíveis na página de importações.",
          variant: "error",
        });
    });

    return () => {
      cancelled = true;
      gpsMarkerRef.current?.remove();
      gpsMarkerRef.current = null;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      locationControlRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      geoPdfOverlay?.release();
      releaseProtocols();
    };
  }, [toast, updateTelemetry, fitSelection, search.pdfId, activeRegionPackageId, regionalRenderRevision,
    mapSource.neutralActive, mapRetryRevision]);

  useEffect(() => {
    if (!mapContainer.current) return;
    const observer = new ResizeObserver(() => mapRef.current?.resize());
    observer.observe(mapContainer.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const source = mapRef.current?.getSource("local-dataset") as
      GeoJSONSource | undefined;
    if (source)
      source.setData(activeGeoJson as unknown as GeoJSON.FeatureCollection);
    if (mapRef.current && source) fitSelection(mapRef.current);
  }, [activeGeoJson, selectionKey, mapEpoch, fitSelection]);

  useEffect(() => {
    const source = mapRef.current?.getSource("draw-preview") as
      GeoJSONSource | undefined;
    source?.setData(drawingPreview);
  }, [drawingPreview, mapEpoch]);

  useEffect(() => {
    const source = mapRef.current?.getSource('offline-route') as GeoJSONSource | undefined;
    source?.setData(routeAsGeoJSON(plannedRoute));
    if (plannedRoute?.geometry.length && mapRef.current && !navigationActiveRef.current) {
      const bounds = featureBounds(routeAsGeoJSON(plannedRoute).features);
      if (bounds) mapRef.current.fitBounds(bounds, { padding: 72, duration: 0, maxZoom: 16 });
    }
  }, [plannedRoute, mapEpoch]);

  useEffect(() => {
    const source = mapRef.current?.getSource('regional-transit') as GeoJSONSource | undefined;
    source?.setData(transitGeoJSON);
  }, [transitGeoJSON, mapEpoch]);

  const handleMyLocation = () => {
    if (locationControlRef.current) {
      try {
        locationControlRef.current.trigger();
      } catch {
        toast({
          title: "Erro de localização",
          description:
            "Não foi possível acessar o GPS. Verifique as permissões.",
          variant: "error",
        });
      }
    } else {
      toast({
        title: "GPS indisponível",
        description: "Controle de localização não encontrado.",
        variant: "error",
      });
    }
  };

  const toggleMeasure = () => {
    const next = !measuring;
    if (next && drawingSessionRef.current) resetDrawing();
    setMeasuring(next);
    if (!next) {
      setMeasurePoints([]);
      setTotalDistance(0);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
      toast({ title: "Medição encerrada", variant: "default" });
    } else {
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = "crosshair";
      toast({
        title: "Modo de Medição ativo",
        description: "Clique no mapa para adicionar pontos.",
      });
      setSidePanel("telemetria");
    }
  };

  // Painel lateral
  const panelBg =
    "absolute z-20 bg-surface-container border border-outline-variant shadow-2xl";
  const panelPos =
    "bottom-0 left-0 right-0 md:bottom-auto md:top-0 md:left-auto md:right-0 md:h-full md:w-80";
  const panelRound = "rounded-t-2xl md:rounded-none md:rounded-l-2xl";
  const labelClass = "text-on-surface font-semibold text-sm";
  const subtitleClass = "text-on-surface-variant text-xs";
  const valueClass = "text-on-surface font-mono font-bold text-sm";

  return (
    <div
      className="markmap-workspace relative h-full w-full flex flex-col overflow-hidden"
      data-map-ready={mapReady ? "true" : "false"}
      data-feature-count={appliedCount}
      data-geopdf-ready={geoPdfReady ? "true" : "false"}
    >
      {geoPdfMessage && (
        <p
          role="status"
          className="absolute left-4 right-4 top-4 z-30 rounded-lg border border-cyan-500/30 bg-surface-container/95 p-3 text-sm text-on-surface shadow-lg backdrop-blur"
        >
          {geoPdfMessage}
        </p>
      )}
      {(localReadError || mapError || projectFeatureError) && (
        <div
          role="alert"
          className="absolute left-4 right-4 top-4 z-30 rounded-lg border border-red-400/40 bg-surface-container p-3 text-sm text-on-surface shadow-lg"
        >
          <p>
            {mapError ??
              localReadError ??
              (projectFeatureError instanceof Error
                ? projectFeatureError.message
                : "Não foi possível carregar as camadas/feições do projeto.")}
          </p>
          {mapError && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => {
                if (!mapRecoveryRef.current?.retryManually()) retryMap();
              }} className="min-h-[44px] rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold">
                Tentar novamente
              </button>
              {activeRegionPackageId && !mapSource.neutralActive && !search.pdfId && (
                <button type="button" onClick={() => {
                  setNeutralFor(`${activeRegionPackageId}:${regionalRenderRevision}`);
                  mapErrorRef.current = null;
                  setMapError(null);
                }} className="min-h-[44px] rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold">
                  Usar fundo simples offline
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {mapSource.neutralActive && !mapError && !localReadError && !projectFeatureError && !search.pdfId && (
        <div role="status"
          className="absolute left-4 right-4 top-4 z-30 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-variant bg-surface-container/95 p-3 text-sm text-on-surface shadow-lg">
          <p>Fundo simples offline em uso. O mapa regional e os dados de campo foram preservados.</p>
          <button type="button" onClick={() => {
            setNeutralFor(null);
            mapErrorRef.current = null;
            setMapError(null);
          }} className="min-h-[44px] rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold">
            Voltar ao mapa regional
          </button>
        </div>
      )}
      {projectFeatureTruncated && (
        <p
          role="status"
          className="absolute left-4 right-4 bottom-24 z-20 rounded-lg bg-surface-container p-2 text-xs"
        >
          Consulta parcial: até 100 camadas e 10.000 feições por projeto.
        </p>
      )}
      {/* Mapa */}
      <div
        ref={mapContainer}
        className="flex-1 w-full"
        aria-label="Mapa interativo"
        data-testid="map-canvas"
      />

      <OfflineSearch key={`${activeRegionPackageId ?? 'none'}:${regionalRenderRevision}`} records={combinedSearchRecords} regionalCount={regionalSearchRecords.length} warning={regionalSearchError} onChoose={(place) => {
        const map = mapRef.current;
        if (map) map.flyTo({ center: [place.lon, place.lat], zoom: Math.max(15, map.getZoom()) });
      }} />

      <OfflineKnowledge key={`${activeRegionPackageId ?? 'none'}:${regionalRenderRevision}`} packageId={activeRegionPackageId} onTransit={setTransitNetwork} onStation={(lon, lat) => {
        const map = mapRef.current;
        if (map) map.flyTo({ center: [lon, lat], zoom: Math.max(15, map.getZoom()) });
      }} />

      <OfflineElevation key={`${activeRegionPackageId ?? 'none'}:${regionalRenderRevision}`} packageId={activeRegionPackageId} route={plannedRoute} />

      <OfflineRouting key={`${activeRegionPackageId ?? 'none'}:${regionalRenderRevision}`} packageId={activeRegionPackageId}
        pickedPoint={routingPoint}
        onRequestPick={(kind) => {
          if (drawingSessionRef.current) {
            toast({ title: 'Conclua ou cancele o desenho antes de escolher a rota.', variant: 'error' });
            return;
          }
          if (measuringRef.current) toggleMeasure();
          setRoutingPickMode(kind);
        }}
        onRoute={setPlannedRoute}
        onPosition={updateNavigationPosition}
        onTrackingChange={(active) => { navigationActiveRef.current = active; }}
      />
      {routingPickMode && <div role="status" className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-lg bg-surface-container p-3 text-sm shadow-lg">
        Toque no mapa para escolher {routingPickMode === 'origin' ? 'a origem' : 'o destino'} da rota.
        <button type="button" className="ml-2 underline" onClick={() => setRoutingPickMode(null)}>Cancelar</button>
      </div>}

      {/* ── Barra de ferramentas flutuante ── */}
      <div className="absolute bottom-[calc(4rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 lg:bottom-auto lg:top-6 lg:left-4 lg:translate-x-0 markmap-map-tools bg-surface-container/90 backdrop-blur-xl border border-outline-variant rounded-2xl p-2 flex lg:flex-col gap-1.5 shadow-2xl z-10 w-max max-w-[92vw] overflow-x-auto">
        {/* Telemetria */}
        <ToolBtn
          active={sidePanel === "telemetria"}
          onClick={() => togglePanel("telemetria")}
          icon="telemetry"
          label="Telemetria"
          color="cyan"
        />
        {/* Camadas */}
        <ToolBtn
          active={sidePanel === "camadas"}
          onClick={() => togglePanel("camadas")}
          icon="layers"
          label="Camadas"
          color="blue"
        />
        {/* Filtros */}
        <ToolBtn
          active={sidePanel === "filtros"}
          onClick={() => togglePanel("filtros")}
          icon="filters"
          label="Filtros"
          color="violet"
        />
        {/* Ferramentas */}
        <ToolBtn
          active={sidePanel === "ferramentas"}
          onClick={() => togglePanel("ferramentas")}
          icon="tools"
          label="Ferramentas"
          color="slate"
        />
        {/* Separador */}
        <div className="w-full h-px md:block hidden bg-outline-variant my-0.5" />
        <div className="w-px h-8 md:hidden block bg-outline-variant mx-0.5" />
        {/* Minha localização */}
        <ToolBtn
          active={false}
          onClick={handleMyLocation}
          icon="location"
          label="Minha localização"
          color="emerald"
        />
        {/* Medir */}
        <ToolBtn
          active={measuring}
          onClick={toggleMeasure}
          icon="measure"
          label={measuring ? "Encerrar medição" : "Medir distância"}
          color="amber"
        />
        <ToolBtn
          active={drawingSession?.type === "Point"}
          onClick={() => void startDrawing("Point")}
          icon="point"
          label="Adicionar ponto"
          color="cyan"
        />
        <ToolBtn
          active={drawingSession?.type === "LineString"}
          onClick={() => void startDrawing("LineString")}
          icon="line"
          label="Desenhar linha"
          color="blue"
        />
        <ToolBtn
          active={drawingSession?.type === "Polygon"}
          onClick={() => void startDrawing("Polygon")}
          icon="polygon"
          label="Desenhar polígono"
          color="violet"
        />
      </div>

      {drawingSession && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex max-w-[calc(100%-2rem)] flex-wrap items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-surface-container/95 px-3 py-2 text-xs font-semibold text-on-surface shadow-lg backdrop-blur">
          <span>
            {drawingSession.type === "Point"
              ? "Toque no mapa para salvar o ponto"
              : `${drawingSession.vertices.length} vértice${drawingSession.vertices.length === 1 ? "" : "s"}`}
          </span>
          {drawingSession.type !== "Point" && (
            <>
              <button
                type="button"
                onClick={undoDrawing}
                disabled={drawingSession.undoStack.length === 0}
                className="min-h-[44px] rounded-lg px-3 text-cyan-500 disabled:opacity-40"
              >
                Desfazer
              </button>
              <button
                type="button"
                onClick={finishDrawing}
                className="min-h-[44px] rounded-lg bg-secondary px-3 font-bold text-[#07131f] hover:brightness-110"
              >
                Concluir
              </button>
            </>
          )}
          <button
            type="button"
            onClick={resetDrawing}
            className="min-h-[44px] rounded-lg px-3 text-red-400"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ── Indicador de medição ativo ── */}
      {measuring && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
          <AppIcon name="measure" size="sm" />
          {measurePoints.length === 0
            ? "Clique no mapa para iniciar a medição"
            : `${measurePoints.length} ponto${measurePoints.length > 1 ? "s" : ""} · ${formatDistance(totalDistance)}`}
          <button
            onClick={toggleMeasure}
            className="ml-1 text-amber-600 hover:text-amber-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Painel lateral (branco, texto escuro) ── */}
      {sidePanel !== "none" && (
        <div
          className={`${panelBg} ${panelPos} ${panelRound} flex flex-col max-h-[70vh] md:max-h-full overflow-y-auto`}
        >
          {/* Header do painel */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant flex-shrink-0">
            <span className="text-on-surface font-bold text-base flex items-center gap-2">
              <AppIcon
                name={
                  sidePanel === "telemetria"
                    ? "telemetry"
                    : sidePanel === "camadas"
                      ? "layers"
                      : sidePanel === "filtros"
                        ? "filters"
                        : "tools"
                }
                size="md"
              />
              {sidePanel === "telemetria"
                ? "Telemetria"
                : sidePanel === "camadas"
                  ? "Camadas"
                  : sidePanel === "filtros"
                    ? "Filtros"
                    : "Ferramentas"}
            </span>
            <button
              aria-label="Fechar painel do mapa"
              onClick={() => setSidePanel("none")}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
            >
              <AppIcon name="close" size="sm" />
            </button>
          </div>

          {/* Conteúdo: TELEMETRIA */}
          {sidePanel === "telemetria" && (
            <div className="p-5 space-y-4">
              <div>
                <p className={subtitleClass + " mb-2 uppercase tracking-wider"}>
                  Posição do mapa
                </p>
                <div className="space-y-2">
                  <Row
                    label="Latitude"
                    value={`${telemetry.lat.toFixed(6)}°`}
                    labelCls={labelClass}
                    valueCls={valueClass}
                  />
                  <Row
                    label="Longitude"
                    value={`${telemetry.lng.toFixed(6)}°`}
                    labelCls={labelClass}
                    valueCls={valueClass}
                  />
                </div>
              </div>
              <div className="h-px bg-surface-variant" />
              <div>
                <p className={subtitleClass + " mb-2 uppercase tracking-wider"}>
                  Câmera
                </p>
                <div className="space-y-2">
                  <Row
                    label="Zoom"
                    value={telemetry.zoom.toFixed(2)}
                    labelCls={labelClass}
                    valueCls="text-cyan-700 font-mono font-bold text-sm"
                  />
                  <Row
                    label="Inclinação (Pitch)"
                    value={`${telemetry.pitch.toFixed(1)}°`}
                    labelCls={labelClass}
                    valueCls="text-cyan-700 font-mono font-bold text-sm"
                  />
                  <Row
                    label="Rotação (Bearing)"
                    value={`${telemetry.bearing.toFixed(1)}°`}
                    labelCls={labelClass}
                    valueCls="text-cyan-700 font-mono font-bold text-sm"
                  />
                </div>
              </div>
              {measuring && (
                <>
                  <div className="h-px bg-surface-variant" />
                  <div>
                    <p
                      className={
                        subtitleClass + " mb-2 uppercase tracking-wider"
                      }
                    >
                      Medição ativa
                    </p>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                      <Row
                        label="Pontos"
                        value={String(measurePoints.length)}
                        labelCls="text-amber-800 font-semibold text-sm"
                        valueCls="text-amber-900 font-mono font-bold text-sm"
                      />
                      <Row
                        label="Distância total"
                        value={formatDistance(totalDistance)}
                        labelCls="text-amber-800 font-semibold text-sm"
                        valueCls="text-amber-900 font-mono font-bold text-base"
                      />
                    </div>
                    <button
                      onClick={toggleMeasure}
                      className="mt-3 w-full py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100 transition-colors"
                    >
                      Encerrar medição
                    </button>
                  </div>
                </>
              )}
              {!measuring && (
                <button
                  onClick={toggleMeasure}
                  className="w-full py-2.5 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface-variant text-sm font-semibold hover:bg-surface-variant transition-colors flex items-center justify-center gap-2"
                >
                  <AppIcon name="measure" size="sm" />
                  Iniciar medição de distância
                </button>
              )}
            </div>
          )}

          {/* Conteúdo: CAMADAS */}
          {sidePanel === "camadas" && (
            <div className="p-5 space-y-3">
              <p className={subtitleClass + " uppercase tracking-wider"}>
                Gerenciar camadas visíveis
              </p>
              <div className="flex items-center justify-between py-2.5 px-3 rounded-xl border border-outline-variant bg-surface-container-high hover:bg-surface-variant transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full flex-shrink-0 bg-cyan-500" />
                  <span className="text-on-surface text-sm font-medium">
                    {activeDataset?.name ?? "Dataset selecionado"}
                  </span>
                </div>
                <button
                  aria-label="Alternar dataset local"
                  aria-pressed={layerVisibility.dataset}
                  disabled={!activeDataset}
                  onClick={() =>
                    setLayerVisibility((prev) => ({
                      ...prev,
                      dataset: !prev.dataset,
                    }))
                  }
                  className={`w-11 h-6 rounded-full relative transition-colors duration-200 flex-shrink-0 ${layerVisibility.dataset ? "bg-secondary" : "bg-on-surface/15"}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-surface-container shadow transition-all duration-200 ${layerVisibility.dataset ? "left-[calc(100%-22px)]" : "left-0.5"}`}
                  />
                </button>
              </div>
              {!activeDataset && (
                <p className="text-on-surface-variant text-sm">
                  Selecione um dataset local abaixo ou importe um arquivo.
                </p>
              )}
              <label className="block text-xs font-semibold text-on-surface-variant">
                Dataset local (opcional)
                <select
                  aria-label="Selecionar dataset local"
                  value={datasetSelection}
                  onChange={(event) => setDatasetSelection(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container px-2 py-2 text-sm text-on-surface"
                >
                  <option value="none">Nenhum dataset</option>
                  {datasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.name}
                    </option>
                  ))}
                </select>
              </label>
              {projectLayers.map((layer) => (
                <div
                  key={layer.id}
                  className="flex items-center justify-between rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface"
                >
                  <span>{layer.name}</span>
                  <button
                    aria-label={`Alternar camada ${layer.name}`}
                    aria-pressed={
                      layerVisibility[layer.id] ?? layer.visibleByDefault
                    }
                    onClick={() =>
                      setLayerVisibility((prev) => ({
                        ...prev,
                        [layer.id]: !(prev[layer.id] ?? layer.visibleByDefault),
                      }))
                    }
                    className={`h-5 w-9 rounded-full ${(layerVisibility[layer.id] ?? layer.visibleByDefault) ? "bg-secondary" : "bg-on-surface/15"}`}
                  >
                    <span
                      className={`block h-4 w-4 rounded-full bg-white transition-transform ${(layerVisibility[layer.id] ?? layer.visibleByDefault) ? "translate-x-4" : "translate-x-0.5"}`}
                    />
                  </button>
                </div>
              ))}
              {projectFeatureError && (
                <p role="alert" className="text-sm text-red-400">
                  Não foi possível carregar as feições do projeto:{" "}
                  {projectFeatureError instanceof Error
                    ? projectFeatureError.message
                    : "erro desconhecido"}
                </p>
              )}
              {projectFeatureTruncated && (
                <p className="text-xs text-on-surface-variant">
                  Consulta parcial: até 100 camadas e 10.000 feições por
                  projeto.
                </p>
              )}
            </div>
          )}

          {/* Conteúdo: FILTROS */}
          {sidePanel === "filtros" && (
            <div className="p-5 space-y-4">
              <p className={subtitleClass + " uppercase tracking-wider"}>
                Filtrar feições no mapa
              </p>
              <div>
                <label className={labelClass + " block mb-1.5"}>
                  Busca por nome
                </label>
                <input
                  aria-label="Buscar nas propriedades das feições"
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Ex: Fazenda, Sítio..."
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container text-on-surface text-sm placeholder:text-on-surface-variant focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all"
                />
              </div>
              <div>
                <label className={labelClass + " block mb-1.5"}>
                  Tipo de feição
                </label>
                <select
                  aria-label="Tipo de feição"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container text-on-surface text-sm focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all"
                >
                  <option value="todos">Todos os tipos</option>
                  <option value="Point">Pontos</option>
                  <option value="LineString">Linhas</option>
                  <option value="Polygon">Polígonos</option>
                  <option value="Multi">Multi-geometrias</option>
                </select>
              </div>
              <div className="h-px bg-surface-variant" />
              {filterText && (
                <div className="space-y-2">
                  <p className={subtitleClass}>
                    Resultados para "{filterText}":
                  </p>
                  {activeGeoJson.features
                    .slice(0, 100)
                    .map((feature, index) => (
                      <div
                        key={String(feature.id ?? index)}
                        className="px-3 py-2.5 rounded-xl bg-surface-container-high border border-outline-variant"
                      >
                        <p className="text-on-surface font-semibold text-sm">
                          {String(
                            feature.properties?.name ??
                              feature.id ??
                              `Feição ${index + 1}`,
                          )}
                        </p>
                        <p className="text-on-surface-variant text-xs">
                          {JSON.stringify(feature.properties)}
                        </p>
                      </div>
                    ))}
                  {activeGeoJson.features.length === 0 && (
                    <p className="text-on-surface-variant text-sm text-center py-4">
                      Nenhuma feição encontrada.
                    </p>
                  )}
                </div>
              )}
              <button
                onClick={() => {
                  setFilterText("");
                  setFilterType("todos");
                  toast({ title: "Filtros limpos", variant: "default" });
                }}
                className="w-full py-2.5 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface-variant text-sm font-medium hover:bg-surface-variant transition-colors"
              >
                Limpar filtros
              </button>
            </div>
          )}

          {/* Conteúdo: FERRAMENTAS */}
          {sidePanel === "ferramentas" && (
            <div className="p-5 space-y-3">
              <p className={subtitleClass + " uppercase tracking-wider"}>
                Ferramentas disponíveis
              </p>
              {[
                {
                  icon: "measure" as AppIconName,
                  label: "Medir Distância",
                  desc: "Clique em pontos no mapa para medir.",
                  action: () => {
                    toggleMeasure();
                    setSidePanel("telemetria");
                  },
                },
                {
                  icon: "location" as AppIconName,
                  label: "Minha Localização",
                  desc: "Centralizar o mapa na sua posição atual.",
                  action: handleMyLocation,
                },
                {
                  icon: "download" as AppIconName,
                  label: "Exportar Dados",
                  desc: "Exportar o dataset selecionado em GeoJSON.",
                  action: () => {
                    if (activeDataset)
                      void exportDatasetGeoJSON(activeDataset.id).catch((cause) =>
                        toast({
                          title: "Exportação não concluída",
                          description:
                            cause instanceof Error
                              ? cause.message
                              : "Falha ao exportar.",
                          variant: "error",
                        }),
                      );
                    else
                      toast({
                        title: "Nenhum dataset selecionado",
                        variant: "error",
                      });
                  },
                },
                {
                  icon: "copy" as AppIconName,
                  label: "Copiar coordenadas",
                  desc: "Copiar o centro atual do mapa.",
                  action: async () => {
                    const value = `${telemetry.lat.toFixed(6)}, ${telemetry.lng.toFixed(6)}`;
                    try {
                      if (!navigator.clipboard?.writeText)
                        throw new Error(
                          "Cópia indisponível neste dispositivo.",
                        );
                      await navigator.clipboard.writeText(value);
                      toast({
                        title: "Coordenadas copiadas",
                        description: value,
                        variant: "success",
                      });
                    } catch (cause) {
                      toast({
                        title: "Não foi possível copiar",
                        description:
                          cause instanceof Error
                            ? cause.message
                            : "Verifique a permissão de cópia.",
                        variant: "error",
                      });
                    }
                  },
                },
                {
                  icon: "upload" as AppIconName,
                  label: "Importar dataset",
                  desc: "Abrir a página de importação local.",
                  action: () => {
                    window.location.href = "/imports";
                  },
                },
              ].map((tool) => (
                <button
                  key={tool.icon}
                  onClick={tool.action}
                  className="w-full flex items-start gap-3 px-3 py-3 rounded-xl border border-outline-variant bg-surface-container-high hover:bg-primary/10 hover:border-primary/30 transition-colors text-left"
                >
                  <AppIcon name={tool.icon} size="md" className="mt-0.5" />
                  <div>
                    <p className="text-on-surface font-semibold text-sm">
                      {tool.label}
                    </p>
                    <p className="text-on-surface-variant text-xs mt-0.5">
                      {tool.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Sub-componentes auxiliares
function ToolBtn({
  active,
  onClick,
  icon,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  icon: AppIconName;
  label: string;
  color: string;
}) {
  const activeColors: Record<string, string> = {
    cyan: "bg-cyan-500/15 border-cyan-400/40 text-cyan-400",
    blue: "bg-blue-500/15 border-blue-400/40 text-blue-400",
    violet: "bg-violet-500/15 border-violet-400/40 text-violet-400",
    slate: "bg-white/10 border-white/15 text-on-surface",
    emerald: "bg-emerald-500/15 border-emerald-400/40 text-emerald-400",
    amber: "bg-amber-500/15 border-amber-400/40 text-amber-400",
  };
  const idleClass =
    "bg-surface-container border-outline-variant text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface";
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border flex items-center justify-center transition-all shadow-sm ${active ? (activeColors[color] ?? activeColors["slate"]) : idleClass}`}
    >
      <AppIcon name={icon} size="lg" />
    </button>
  );
}

function Row({
  label,
  value,
  labelCls,
  valueCls,
}: {
  label: string;
  value: string;
  labelCls: string;
  valueCls: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={labelCls}>{label}</span>
      <span className={valueCls}>{value}</span>
    </div>
  );
}
