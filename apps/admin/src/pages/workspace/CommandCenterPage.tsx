import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { featureBounds, loadProjectFeatures, matchesFeature, hasPolygonGeometry, hasPointGeometry, shouldDisplayDatasetPoints, filterDatasetFeatures } from "./map-data";
import { useParams, useSearch } from "@tanstack/react-router";
import { useToast } from "@markmap/ui";
import type { GeoReference, Route, TransitNetwork } from "@markmap/contracts";
import {
  addDrawingVertex,
  createDrawingSession,
  createFallbackStyle,
  createMapLibreMap,
  finishDrawingSession,
  getDefaultBasemaps,
  shouldFallbackOnError,
  undoDrawingVertex,
} from "@markmap/maps";
import type {
  DrawingSession,
  GeometryType as DrawingGeometryType,
} from "@markmap/maps";
import { addProtocol, Popup, Marker, removeProtocol } from "maplibre-gl";
import { acquireOfflineProtocolLease } from "../../lib/map/offline-protocol-leases.mjs";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { createPropertyPopupContent } from "./property-popup";
import {
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
import {
  createWebglContextRecovery,
  WEBGL_CONTEXT_LOST_MESSAGE,
  clearRecoveredWebglError,
  canReportMapError,
} from "../../lib/map/webgl-context-recovery.mjs";
import { createOfflineStyleLifecycle } from "../../lib/map/offline-style-lifecycle.mjs";
import { ensureOfflineSourceLayers } from "../../lib/map/offline-style-layers.mjs";
import { describeOfflineMapFailure } from "../../lib/map/offline-map-diagnostics.mjs";
import { ensureLocationPermission } from "../../lib/device-location-permission";
import {
  getFreshDevicePosition, isInsideOfflineRegion, rememberLocationApproval,
  shouldAutoLocateOnOpen,
} from "../../lib/location-consent";
import {
  createOfflineAssetProtocol,
  createOfflineProtocol,
} from "@markmap/maps/offline/protocol";
import { adaptOfflineStyle } from "@markmap/maps/offline/style";
import { OfflineSearch } from "../../components/map/OfflineSearch";
import { OfflineRouting, type RoutePointSelection } from "../../components/map/OfflineRouting";
import { OfflineKnowledge } from "../../components/map/OfflineKnowledge";
import { OfflineElevation } from "../../components/map/OfflineElevation";
import { MapOfflinePanel } from "../../components/map/MapOfflinePanel";
import { RegionDownloadCatalog } from "../../components/map/RegionDownloadCatalog";
import { evaluateGeoPdfGps, describeGeoPdfGps } from "../../lib/pdf/geopdf-focus.mjs";
import { MAX_CONTOUR_BYTES, validateRegionalContours, contoursToGeoJSON } from "@markmap/maps/elevation/contour-package.mjs";
import { loadRegionalPackageSearch, describeRegionalSearchLoadError } from '../../lib/search/regional-package-search';
import type { LocalSearchRecord } from '../../lib/search/local-map-search';
import { buildLocalMapSearchRecords } from "../../lib/search/local-map-search";
import { useVisibleMapSearch } from "../../lib/search/use-visible-map-search";

import type { MeasurePoint, SidePanel, TelemetryData } from "./command-center/types.js";
import { haversineMeters, routeAsGeoJSON } from "./command-center/utils.js";
import { CommandCenterToolbar } from "./command-center/CommandCenterToolbar.js";
import { DrawingOverlayBar } from "./command-center/DrawingOverlayBar.js";
import { MeasuringOverlayBar } from "./command-center/MeasuringOverlayBar.js";
import { CommandCenterSidePanel } from "./command-center/CommandCenterSidePanel.js";

type MapControls = Awaited<ReturnType<typeof createMapLibreMap>>;

export default function CommandCenterPage() {
  const { toast } = useToast();
  const search = useSearch({ strict: false }) as {
    datasetId?: string;
    pdfId?: string;
  };
  const params = useParams({ strict: false }) as { projectId?: string };
  // Check explicit deep links at GPS callback time without remounting MapLibre.
  const requestedDatasetRef = useRef(search.datasetId);
  requestedDatasetRef.current = search.datasetId;
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
  const webglLostRef = useRef(false);
  const webglRetryBudgetRef = useRef<{ sceneKey: string; autoRecoveryUsed: boolean }>({
    sceneKey: "", autoRecoveryUsed: false,
  });
  const [mapRetryRevision, setMapRetryRevision] = useState(0);
  const retryMap = useCallback(() => {
    webglLostRef.current = false;
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
        hasError: Boolean(mapErrorRef.current) && !webglLostRef.current,
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
  const geoPdfManualFocusRef = useRef(false);
  const locationControlRef = useRef<MapControls["geolocate"] | null>(null);
  const cancelAutoCenterRef = useRef<(() => void) | null>(null);
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
  const sidePanelRef = useRef(sidePanel);
  sidePanelRef.current = sidePanel;
  const [elevationBounds, setElevationBounds] = useState<[number, number, number, number] | undefined>();
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
  const elevationCenter = useMemo<[number, number]>(() => [telemetry.lng, telemetry.lat], [telemetry.lng, telemetry.lat]);
  const elevationGeometry = useMemo(() => measurePoints.length >= 2
    ? measurePoints.map(point => [point.lng, point.lat] as [number, number]) : undefined, [measurePoints]);
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
    setLayerVisibility((prev) => {
      const { datasetPoints: _, ...rest } = prev;
      return rest;
    });
  }, [search.datasetId, params.projectId]);
  const activeDataset =
    datasetSelection === "none"
      ? undefined
      : datasets.find((dataset) => dataset.id === datasetSelection);
  const datasetFeatures = useMemo(
    () => (activeDataset?.geojson.features as GeoJSON.Feature[]) ?? [],
    [activeDataset],
  );
  const datasetHasPolygons = useMemo(
    () => hasPolygonGeometry(datasetFeatures),
    [datasetFeatures],
  );
  const datasetHasPoints = useMemo(
    () => hasPointGeometry(datasetFeatures),
    [datasetFeatures],
  );
  const showDatasetPoints = useMemo(
    () =>
      shouldDisplayDatasetPoints(
        datasetFeatures,
        layerVisibility.datasetPoints,
      ),
    [datasetFeatures, layerVisibility.datasetPoints],
  );
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
      .catch((cause) => { if (!cancelled) { setRegionalSearchRecords([]); setRegionalSearchError(describeRegionalSearchLoadError(cause)); } });
    return () => { cancelled = true; };
  }, [activeRegionPackageId, regionalRenderRevision]);
  const [searchRegionLabel, setSearchRegionLabel] = useState('');
  const visibleMapSearchRecords = useVisibleMapSearch(
    mapRef, mapSource.regionId, regionalRenderRevision, mapEpoch, mapReady,
    sidePanel === 'busca-offline' && regionalSearchRecords.length === 0, searchRegionLabel,
  );
  const combinedSearchRecords = useMemo(
    () => [...regionalSearchRecords, ...localSearchRecords, ...visibleMapSearchRecords],
    [regionalSearchRecords, localSearchRecords, visibleMapSearchRecords],
  );
  const activeGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: [
        ...(layerVisibility.dataset
          ? filterDatasetFeatures(datasetFeatures, {
              showPoints: showDatasetPoints,
              filterText,
              filterType,
            })
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
      datasetFeatures,
      showDatasetPoints,
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
    const bounds = map.getBounds();
    const area: [number, number, number, number] = [
      Math.max(-180, bounds.getWest()), Math.max(-85.051128, bounds.getSouth()),
      Math.min(180, bounds.getEast()), Math.min(85.051128, bounds.getNorth()),
    ];
    setElevationBounds(area[0] < area[2] && area[1] < area[3] ? area : undefined);
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
    setSearchRegionLabel('');
    setGeoPdfReady(false);
    setGeoPdfMessage(null);
    geoPdfManualFocusRef.current = false;
    fittedKeyRef.current = "";
    let cancelled = false;
    const sceneKey = JSON.stringify([
      search.pdfId ?? null, activeRegionPackageId, regionalRenderRevision, mapSource.neutralActive,
    ]);
    if (webglRetryBudgetRef.current.sceneKey !== sceneKey) {
      webglRetryBudgetRef.current = { sceneKey, autoRecoveryUsed: false };
    }
    const glRecovery = createWebglContextRecovery({
      budget: webglRetryBudgetRef.current,
      onLost: () => {
        if (cancelled) return;
        webglLostRef.current = true;
        mapErrorRef.current = WEBGL_CONTEXT_LOST_MESSAGE;
        setMapError(WEBGL_CONTEXT_LOST_MESSAGE);
        setMapReady(false);
      },
      onRestore: () => {
        if (cancelled) return;
        // One automatic remount per region/revision. Further retries are manual.
        webglLostRef.current = false;
        retryMap();
      },
    });
    let fallbackActive = !navigator.onLine;
    let releaseProtocolLease: (() => void) | null = null;
    let styleLifecycle: ReturnType<typeof createOfflineStyleLifecycle> | null = null;
    let geoPdfOverlay: GeoPdfOverlay | null = null;
    let regionalContours: GeoJSON.FeatureCollection | null = null;
    // Fitting the image and moving to a reliable GPS point are independent.
    // Never refit after the user has panned or the style merely recovered.
    let geoPdfHasFitted = false;
    let geoPdfUserMoved = false;
    let pendingGeoPdfGpsCenter: [number, number] | null = null;
    let geoPdfGpsNotice: string | null = null;
    const releaseProtocols = () => {
      const release = releaseProtocolLease;
      releaseProtocolLease = null;
      release?.();
    };
    const initialize = async () => {
      setMapError(null);
      let center: [number, number] = [-47.92, -15.785];
      let zoom = 14;
      let offlinePackageSelected = false;
      let displayedGeneration: string | null = null;
      let offlineBounds: readonly [number, number, number, number] | null = null;
      let offlineMaxZoom = 16;
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
        // GeoPDF is a positioned raster overlay, never a replacement basemap.
        // Keep online vector streets around the image; offline still uses the
        // existing fallback when tiles are unavailable.
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
        setSearchRegionLabel(installed.manifest.label.replace(/\s*—\s*mapa offline\s*$/i, ""));
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
        const lease = acquireOfflineProtocolLease({
          addProtocol: (scheme, handler) =>
            addProtocol(scheme, handler as Parameters<typeof addProtocol>[1]),
          removeProtocol,
          createHandlers: (leaseId) => {
            const tileProtocol = createOfflineProtocol(installed.manifest, file, leaseId);
            return {
              tile: (params, controller) =>
                tileProtocol.tile(params, controller) as Promise<{ data: unknown }>,
              asset: createOfflineAssetProtocol((requestedId, path) =>
                requestedId === leaseId
                  ? offlineMapStore.assetAtRevision(selectedPackageId, path, installed.generation)
                  : Promise.resolve(null),
              ),
            };
          },
        });
        releaseProtocolLease = lease.release;
        // Unique source URLs bind tile, style and glyph loads to the same map
        // instance, even while the previous MapLibre worker is stopping.
        const adaptedStyle = adaptOfflineStyle(sourceStyle, installed.manifest, lease.id);
        basemap = {
          ...(basemap ?? { id: "offline", name: installed.manifest.label, attribution: installed.manifest.attribution }),
          styleUrl: `data:application/json,${encodeURIComponent(JSON.stringify(adaptedStyle))}`,
        };
        offlineBounds = installed.manifest.bounds;
        offlineMaxZoom = installed.manifest.maxZoom;
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
      // Keep the native GPS button visible for PDF and regular maps.
      // MapLibre shows the browser-reported accuracy circle; we do not
      // reinterpret approximate desktop geolocation as an exact position.
      locationControlRef.current = geolocate;
      mapRef.current = map;
      // Show the downloaded region at a useful scale; explicit project/data bounds still take precedence.
      if (offlineBounds && !fitRef.current.bounds && !search.pdfId) {
        map.fitBounds([[offlineBounds[0], offlineBounds[1]], [offlineBounds[2], offlineBounds[3]]],
          { padding: 48, maxZoom: offlineMaxZoom, duration: 0 });
      }
      geolocate.on("geolocate", (position) => {
        void rememberLocationApproval().catch(() => undefined);
        if (!geoPdfOverlay || cancelled) return;
        geoPdfManualFocusRef.current = true;
        updateNavigationPosition(null, false); // Avoid a duplicate marker from initial auto-center.
        const { latitude: lat, longitude: lon, accuracy: accuracyM } = position.coords;
        geoPdfGpsNotice = describeGeoPdfGps(
          evaluateGeoPdfGps({ lat, lon, accuracyM }, geoPdfOverlay.coordinates),
        );
        setGeoPdfMessage(geoPdfGpsNotice);
      });
      if (geoPdfOverlay || (!search.pdfId && !requestedDatasetRef.current && !fitRef.current.bounds)) {
        let userMoved = false;
        const canvas = map.getCanvas();
        const events = ["pointerdown", "wheel", "keydown"];
        const markUserMove = () => {
          userMoved = true;
          geoPdfUserMoved = true;
          pendingGeoPdfGpsCenter = null;
        };
        for (const event of events) canvas.addEventListener(event, markUserMove);
        const cancel = () => {
          // Finishing a GPS request is not a gesture on the map. Do not
          // disable the initial PDF fit when GPS is absent or imprecise.
          userMoved = true;
          for (const event of events) canvas.removeEventListener(event, markUserMove);
          if (cancelAutoCenterRef.current === cancel) cancelAutoCenterRef.current = null;
        };
        cancelAutoCenterRef.current = cancel;
        void (async () => {
          try {
            if (!(await shouldAutoLocateOnOpen())) return;
            const fix = await getFreshDevicePosition();
            if (!fix || cancelled || userMoved || mapRef.current !== map ||
                navigationActiveRef.current) return;
            if (geoPdfOverlay) {
              const result = evaluateGeoPdfGps(fix, geoPdfOverlay.coordinates);
              geoPdfGpsNotice = describeGeoPdfGps(result);
              setGeoPdfMessage(geoPdfGpsNotice);
              if (result.status !== "inside") return;
              // GeoPDF source hydration fits the carta first. If GPS wins the
              // race, keep the requested center until its image is installed.
              pendingGeoPdfGpsCenter = result.center;
              updateNavigationPosition(fix, false);
              if (geoPdfHasFitted && !userMoved) {
                map.jumpTo({ center: result.center, zoom: Math.max(15, map.getZoom()) });
                pendingGeoPdfGpsCenter = null;
              }
              void rememberLocationApproval().catch(() => undefined);
              return;
            }
            if (fitRef.current.bounds || !isInsideOfflineRegion(fix, offlineBounds)) return;
            map.jumpTo({
              center: [fix.lon, fix.lat],
              zoom: Math.min(Math.max(14, map.getZoom()), offlineMaxZoom),
            });
            updateNavigationPosition(fix, false);
            void rememberLocationApproval().catch(() => undefined);
          } finally {
            // Keep gesture cancellation alive only if the PDF still waits for
            // its first raster source. A manual pan always takes precedence.
            if (!pendingGeoPdfGpsCenter) cancel();
          }
        })().catch(() => undefined); // Revoked sensor permission must not break the map.
      }
      regionReconcilerRef.current?.noteRendered(selectedPackageId, displayedGeneration);
      // MapLibre emits these typed events from the underlying WebGL canvas.
      map.on("webglcontextlost", (event) => {
        if (cancelled) return;
        styleLifecycle?.contextLost();
        glRecovery.lost(event);
      });
      map.on("webglcontextrestored", () => {
        if (cancelled) return;
        webglLostRef.current = false;
        styleLifecycle?.contextRestored();
        // After the one automatic remount budget is spent, repair the current
        // style in place. Never keep a lost-context view marked ready.
        const remounting = glRecovery.restored();
        if (!remounting && map.isStyleLoaded()) styleLifecycle?.styleLoad();
      });
      map.on("error", (event) => {
        if (cancelled || webglLostRef.current) return;
        if (offlinePackageSelected || mapSource.neutralActive || (Boolean(search.pdfId) && fallbackActive)) {
          // Selection changes abort outstanding tiles: cancellation is not corruption.
          const issue = describeOfflineMapFailure(event);
          if (!issue) return;
          if (canReportMapError(mapErrorRef.current)) {
            mapErrorRef.current = issue.message;
            setMapError(issue.message);
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
          if (cancelled || webglLostRef.current || mapRef.current !== map) return;
          // Recover individual missing layers even when a previous partial
          // style.load already created their shared source.
          ensureOfflineSourceLayers(map, "local-dataset", {
            type: "geojson",
            data: activeGeoJsonRef.current as unknown as GeoJSON.FeatureCollection,
          }, [
            { id: "local-dataset-fill", type: "fill", source: "local-dataset",
              paint: { "fill-color": "#0ea5e9", "fill-opacity": 0.4 } },
            { id: "local-dataset-outline", type: "line", source: "local-dataset",
              paint: { "line-color": "#0284c7", "line-width": 2 } },
            { id: "local-dataset-points", type: "circle", source: "local-dataset",
              filter: ["==", "$type", "Point"],
              layout: { visibility: showDatasetPoints ? "visible" : "none" },
              paint: { "circle-color": "#0284c7", "circle-radius": 5,
                "circle-stroke-color": "#fff", "circle-stroke-width": 1 } },
          ]);
          if (geoPdfOverlay) {
            const overlay = ensureOfflineSourceLayers(map, "geopdf-overlay", {
              type: "image", url: geoPdfOverlay.url,
              coordinates: geoPdfOverlay.coordinates,
            }, [
              { id: "geopdf-overlay", type: "raster", source: "geopdf-overlay",
                paint: { "raster-opacity": 1 } },
            ]);
            if (overlay.sourceAdded || overlay.layersAdded) {
              if (map.getLayer("local-dataset-fill"))
                map.moveLayer("geopdf-overlay", "local-dataset-fill");
              if (!geoPdfHasFitted) {
                geoPdfHasFitted = true;
                // A person may pan while PDF.js finishes rasterization.
                // Never snap their camera back just because the image loaded.
                if (!geoPdfUserMoved && !geoPdfManualFocusRef.current) {
                  const lngs = geoPdfOverlay.coordinates.map(([lng]) => lng);
                  const lats = geoPdfOverlay.coordinates.map(([, lat]) => lat);
                  map.fitBounds([
                    [Math.min(...lngs), Math.min(...lats)],
                    [Math.max(...lngs), Math.max(...lats)],
                  ], { padding: 32, duration: 0 });
                  if (pendingGeoPdfGpsCenter) {
                    map.jumpTo({
                      center: pendingGeoPdfGpsCenter,
                      zoom: Math.max(15, map.getZoom()),
                    });
                    pendingGeoPdfGpsCenter = null;
                    cancelAutoCenterRef.current?.();
                  }
                }
              }
            }
            setGeoPdfReady(true);
            setGeoPdfMessage(geoPdfGpsNotice ?? (fallbackActive
              ? "GeoPDF disponível offline. Para ver ruas ao redor, conecte-se à internet."
              : "GeoPDF sobre o mapa-base. Use Minha localização para centralizar."));
          }
          ensureOfflineSourceLayers(map, "draw-preview", {
            type: "geojson", data: drawingPreviewRef.current,
          }, [
            { id: "draw-preview-fill", type: "fill", source: "draw-preview",
              paint: { "fill-color": "#f59e0b", "fill-opacity": 0.2 } },
            { id: "draw-preview-line", type: "line", source: "draw-preview",
              paint: { "line-color": "#f59e0b", "line-width": 3 } },
            { id: "draw-preview-points", type: "circle", source: "draw-preview",
              paint: { "circle-color": "#f59e0b", "circle-radius": 6,
                "circle-stroke-color": "#fff", "circle-stroke-width": 2 } },
          ]);
          if (regionalContours) {
            ensureOfflineSourceLayers(map, "regional-contours", {
              type: "geojson", data: regionalContours,
            }, [
              { id: "regional-contours-line", type: "line", source: "regional-contours",
                paint: { "line-color": "#9a754e", "line-width": ['case', ['get', 'major'], 1.6, 0.8],
                  "line-opacity": 0.75 } },
            ]);
          }
          ensureOfflineSourceLayers(map, "regional-transit", {
            type: "geojson", data: transitGeoJSONRef.current,
          }, [
            { id: "regional-transit-points", type: "circle", source: "regional-transit",
              paint: { "circle-radius": 5, "circle-color": ['coalesce', ['get', 'color'], '#2586a3'],
                "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.4,
                "circle-opacity": 0.9 } },
          ]);
          ensureOfflineSourceLayers(map, "offline-route", {
            type: "geojson", data: routeAsGeoJSON(plannedRouteRef.current),
          }, [
            { id: "offline-route-line", type: "line", source: "offline-route",
              paint: { "line-color": "#dc2626", "line-width": 5, "line-opacity": 0.9 },
              layout: { "line-join": "round", "line-cap": "round" } },
          ]);
          if (!search.pdfId) fitSelection(map);
          setMapEpoch((value) => value + 1);
        };
        styleLifecycle = createOfflineStyleLifecycle({
          map,
          isActive: () => !cancelled && !webglLostRef.current && mapRef.current === map,
          onHydrate: ensureSource,
          onStyleReset: () => { setMapReady(false); setGeoPdfReady(false); },
          onReady: () => {
            // Dismiss only a recovered WebGL warning, not a genuine asset or
            // style failure. Restoration alone is insufficient until painted.
            const remainingError = clearRecoveredWebglError(mapErrorRef.current);
            if (!webglLostRef.current && remainingError !== mapErrorRef.current) {
              mapErrorRef.current = remainingError;
              setMapError(remainingError);
            }
            updateTelemetry(map);
            setMapReady(true);
            setAppliedCount(activeGeoJsonRef.current.features.length);
          },
          onError: (cause) => {
            const issue = describeOfflineMapFailure(cause);
            if (!issue || !canReportMapError(mapErrorRef.current)) return;
            mapErrorRef.current = issue.message;
            setMapError(issue.message);
          },
        });
        // Listen to source changes BEFORE hydrating; tiny local GeoJSON
        // sources may finish loading immediately in offline WebViews.
        map.on("style.load", styleLifecycle.styleLoad);
        map.on("sourcedata", styleLifecycle.sourceData);
        if (map.isStyleLoaded()) styleLifecycle.styleLoad();

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
          if (!measuringRef.current) {
            // Altitude uses the visible center; a tap selects that point without recording a GPS trail.
            if (sidePanelRef.current === 'altitude-offline') map.panTo(e.lngLat, { duration: 0 });
            return;
          }
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
      glRecovery.dispose();
      styleLifecycle?.dispose();
      styleLifecycle = null;
      webglLostRef.current = false;
      regionReconcilerRef.current?.resetPending();
      if (mapRef.current) {
        // A partially configured map must not block a later retry/remount.
        try { mapRef.current.remove(); } catch { /* keep original failure */ }
        mapRef.current = null;
        locationControlRef.current = null;
      }
      releaseProtocols();
      geoPdfManualFocusRef.current = false;
      const issue = describeOfflineMapFailure(cause);
      if (!issue) return; // Normal cancellation on remount.
      // Do not expose raw file paths or remote URLs in UI/toasts.
      mapErrorRef.current = issue.message;
      setMapError(issue.message);
        toast({
          title: "Mapa indisponível",
          description:
            "Confira o pacote offline em Configurações. Os arquivos locais continuam disponíveis na página de importações.",
          variant: "error",
        });
    });

    return () => {
      cancelled = true;
      cancelAutoCenterRef.current?.();
      glRecovery.dispose();
      styleLifecycle?.dispose();
      styleLifecycle = null;
      webglLostRef.current = false;
      // Teardown is best-effort per resource; failed MapLibre/WebGL cleanup
      // cannot strand the protocol lease or poison the next React mount.
      try { gpsMarkerRef.current?.remove(); } catch { /* detached by WebGL */ }
      gpsMarkerRef.current = null;
      for (const marker of markersRef.current) {
        try { marker.remove(); } catch { /* detached map */ }
      }
      markersRef.current = [];
      locationControlRef.current = null;
      const oldMap = mapRef.current;
      mapRef.current = null;
      try { oldMap?.remove(); } catch { /* context may already be lost */ }
      try { geoPdfOverlay?.release(); } catch { /* release continues */ }
      geoPdfManualFocusRef.current = false;
      releaseProtocols();
    };
  }, [toast, updateTelemetry, fitSelection, search.pdfId, activeRegionPackageId, regionalRenderRevision,
    mapSource.neutralActive, mapRetryRevision, updateNavigationPosition]);

  useEffect(() => {
    if (!mapContainer.current) return;
    const observer = new ResizeObserver(() => mapRef.current?.resize());
    observer.observe(mapContainer.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (mapRef.current?.getLayer("local-dataset-points")) {
      mapRef.current.setLayoutProperty(
        "local-dataset-points",
        "visibility",
        showDatasetPoints ? "visible" : "none",
      );
    }
  }, [showDatasetPoints]);

  useEffect(() => {
    const source = mapRef.current?.getSource("local-dataset") as
      GeoJSONSource | undefined;
    if (source) {
      source.setData(activeGeoJson as unknown as GeoJSON.FeatureCollection);
      setAppliedCount(activeGeoJson.features.length);
    }
    if (!search.pdfId && mapRef.current && source) fitSelection(mapRef.current);
  }, [activeGeoJson, selectionKey, mapEpoch, fitSelection, search.pdfId]);

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

  const handleMyLocation = async () => {
    cancelAutoCenterRef.current?.();
    const permission = await ensureLocationPermission();
    if (permission.state !== "granted") {
      toast({
        title: "GPS sem autorização",
        description: "Autorize a localização nas configurações do dispositivo.",
        variant: "error",
      });
      return;
    }
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
          className="absolute left-4 right-16 top-4 z-20 rounded-lg border border-cyan-500/30 bg-surface-container/95 p-3 text-sm text-on-surface shadow-lg backdrop-blur"
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

      <OfflineSearch key={`search:${activeRegionPackageId ?? 'none'}:${regionalRenderRevision}`} open={sidePanel === "busca-offline"} onClose={() => setSidePanel("none")} records={combinedSearchRecords} regionalCount={regionalSearchRecords.length} mapRecordCount={visibleMapSearchRecords.length} warning={regionalSearchError} onChoose={(place) => {
        const map = mapRef.current;
        if (map) map.flyTo({ center: [place.lon, place.lat], zoom: Math.max(15, map.getZoom()) });
      }} />

      <OfflineKnowledge key={`knowledge:${activeRegionPackageId ?? 'none'}:${regionalRenderRevision}`} open={sidePanel === "lugares-offline"} onClose={() => setSidePanel("none")} packageId={activeRegionPackageId} onTransit={setTransitNetwork} onStation={(lon, lat) => {
        const map = mapRef.current;
        if (map) map.flyTo({ center: [lon, lat], zoom: Math.max(15, map.getZoom()) });
      }} />

      <OfflineElevation key={`elevation:${activeRegionPackageId ?? 'none'}:${regionalRenderRevision}`} open={sidePanel === "altitude-offline"} onClose={() => setSidePanel("none")} packageId={activeRegionPackageId} route={plannedRoute} center={elevationCenter} viewportBounds={elevationBounds} profileGeometry={elevationGeometry} />

      <OfflineRouting key={`routing:${activeRegionPackageId ?? 'none'}:${regionalRenderRevision}`} packageId={activeRegionPackageId}
        open={sidePanel === "navegacao-offline"} onClose={() => setSidePanel("none")}
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
      <MapOfflinePanel open={sidePanel === "baixar-mapas"}
        onClose={() => setSidePanel("none")} title="Baixar mapas" icon="download">
        <RegionDownloadCatalog mapCenter={[telemetry.lng, telemetry.lat]} />
      </MapOfflinePanel>
      {routingPickMode && <div role="status" className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-lg bg-surface-container p-3 text-sm shadow-lg">
        Toque no mapa para escolher {routingPickMode === 'origin' ? 'a origem' : 'o destino'} da rota.
        <button type="button" className="ml-2 underline" onClick={() => setRoutingPickMode(null)}>Cancelar</button>
      </div>}

      {/* Barra de ferramentas flutuante */}
      <CommandCenterToolbar
        sidePanel={sidePanel}
        measuring={measuring}
        drawingSession={drawingSession}
        onTogglePanel={togglePanel}
        onHandleMyLocation={() => void handleMyLocation()}
        onToggleMeasure={toggleMeasure}
        onStartDrawing={(type) => void startDrawing(type)}
      />

      {/* Barra de overlay de desenho */}
      <DrawingOverlayBar
        drawingSession={drawingSession}
        onUndo={undoDrawing}
        onFinish={finishDrawing}
        onReset={resetDrawing}
      />

      {/* Indicador de medição ativo */}
      <MeasuringOverlayBar
        measuring={measuring}
        measurePoints={measurePoints}
        totalDistance={totalDistance}
        onToggleMeasure={toggleMeasure}
      />

      {/* Painel lateral */}
      <CommandCenterSidePanel
        sidePanel={sidePanel}
        telemetry={telemetry}
        measuring={measuring}
        measurePoints={measurePoints}
        totalDistance={totalDistance}
        activeDataset={activeDataset}
        datasetHasPoints={datasetHasPoints}
        datasetHasPolygons={datasetHasPolygons}
        showDatasetPoints={showDatasetPoints}
        layerVisibility={layerVisibility}
        datasetSelection={datasetSelection}
        datasets={datasets}
        projectLayers={projectLayers}
        projectFeatureError={projectFeatureError}
        projectFeatureTruncated={projectFeatureTruncated}
        filterText={filterText}
        filterType={filterType}
        activeGeoJson={activeGeoJson}
        onClose={() => setSidePanel("none")}
        onToggleMeasure={toggleMeasure}
        onSetLayerVisibility={setLayerVisibility}
        onSetDatasetSelection={setDatasetSelection}
        onSetFilterText={setFilterText}
        onSetFilterType={setFilterType}
        onClearFilters={() => {
          setFilterText("");
          setFilterType("todos");
          toast({ title: "Filtros limpos", variant: "default" });
        }}
        onHandleMyLocation={() => void handleMyLocation()}
        onSetSidePanel={setSidePanel}
        toast={toast}
      />
    </div>
  );
}
