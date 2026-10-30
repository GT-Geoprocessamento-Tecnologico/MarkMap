import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { featureBounds, loadProjectFeatures, matchesFeature, hasPolygonGeometry, hasPointGeometry, shouldDisplayDatasetPoints, filterDatasetFeatures } from "./map-data";
import { useParams, useSearch } from "@tanstack/react-router";
import { useToast } from "@markmap/ui";
import type { GeoReference, Route, TransitNetwork } from "@markmap/contracts";
import {
  addDrawingVertex,
  computeCarSummary,
  createDrawingSession,
  createFallbackStyle,
  createMapLibreMap,
  enrichFeatureWithCarStyle,
  finishDrawingSession,
  getDefaultBasemaps,
  shouldFallbackOnError,
  undoDrawingVertex,
} from "@markmap/maps";
import type {
  DrawingSession,
  GeometryType as DrawingGeometryType,
} from "@markmap/maps";
import {
  measurePointsAreaSquareMeters,
  formatArea,
  AREA_UNITS,
  type AreaUnit,
} from "@markmap/geo";
import { addProtocol, Popup, Marker, removeProtocol } from "maplibre-gl";
import { acquireOfflineProtocolLease } from "../../lib/map/offline-protocol-leases.mjs";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { createPropertyPopupContent } from "./property-popup";
import {
  exportDatasetGeoJSON,
  listDatasets,
  type DatasetRecord,
} from "../../lib/datasets/dataset-store";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCreateLayer, useProjectLayers } from "../../lib/hooks/layers";
import { useProject } from "../../lib/hooks/projects";
import { createLocalFeature } from "../../lib/hooks/features";
import { localRepository } from "../../lib/local-repositories";
import {
  renderGeoPdfOverlay,
  resolveEmbeddedGeoReference,
  type GeoPdfOverlay,
} from "../../lib/pdf/geopdf-overlay";
import { renderGeoTiffOverlay, type GeoTiffOverlay } from "../../lib/geotiff/geotiff-overlay";
import { offlineMapStore } from "../../lib/storage/offline-map-store";
import { getSelectedOfflineMapId, setSelectedOfflineMapId, subscribeSelectedOfflineMapId } from "../../lib/storage/offline-map-selection";
import { subscribeRegionCatalogChanges } from "../../lib/storage/region-catalog-events.mjs";
import { createRegionRevisionReconciler, subscribeRegionForeground } from "../../lib/storage/region-foreground-reconcile.mjs";
import { createOfflineMapRecovery, resolveOfflineBasemap } from "../../lib/map/offline-map-recovery.mjs";
import { resolveProjectMapRegion } from "../../lib/map/project-basemap-policy.mjs";
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
import { AppIcon, type AppIconName } from "../../components/AppIcon";
import { OfflineSearch } from "../../components/map/OfflineSearch";
import { OfflineRouting, type RoutePointSelection } from "../../components/map/OfflineRouting";
import { OfflineKnowledge } from "../../components/map/OfflineKnowledge";
import { OfflineElevation } from "../../components/map/OfflineElevation";
import { MapOfflinePanel } from "../../components/map/MapOfflinePanel";
import { ProjectPointsPanel } from "../../components/map/ProjectPointsPanel";
import { PROJECT_POINT_RENDER_ID, resolveClickedProjectPointId, tagProjectPointForRender } from "../../components/map/project-point-selection.mjs";
import { RegionDownloadCatalog } from "../../components/map/RegionDownloadCatalog";
import { CarSummaryCard } from "../../components/map/CarSummaryCard";
import { TrackRecordingOverlay } from "../../components/map/TrackRecordingOverlay";
import { FieldExportModal } from "../../components/map/FieldExportModal";
import { useTrackRecorder } from "../../hooks/useTrackRecorder";
import { BoundaryAlertBanner } from "../../components/map/BoundaryAlertBanner";
import { useBoundaryGuard } from "../../hooks/useBoundaryGuard";
import { evaluateGeoPdfGps, describeGeoPdfGps } from "../../lib/pdf/geopdf-focus.mjs";
import { MAX_CONTOUR_BYTES, validateRegionalContours, contoursToGeoJSON } from "@markmap/maps/elevation/contour-package.mjs";
import { loadRegionalPackageSearch, describeRegionalSearchLoadError } from '../../lib/search/regional-package-search';
import type { LocalSearchRecord } from '../../lib/search/local-map-search';
import { buildLocalMapSearchRecords } from "../../lib/search/local-map-search";
import { useVisibleMapSearch } from "../../lib/search/use-visible-map-search";

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

type SidePanel = "none" | "pontos" | "ferramentas" | "filtros" | "camadas" | "telemetria"
  | "busca-offline" | "lugares-offline" | "altitude-offline" | "navegacao-offline" | "baixar-mapas";
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
    geotiffId?: string;
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
  // A local georeferenced raster has precedence over region changes.
  const localRasterId = search.pdfId ?? search.geotiffId;
  // Regional downloads supply searchable addresses and field data, not MapLibre tiles.
  const mapRegionPolicy = resolveProjectMapRegion({ selectedOfflineMapId, localRasterId });
  const activeRegionPackageId = mapRegionPolicy.searchRegionId;
  const regionalRenderRevision = localRasterId ? 0 : catalogRevision;
  // When a new region generation is committed during neutral mode, offer the
  // latest package again instead of indefinitely retaining an old fallback.
  const neutralRegionId = activeRegionPackageId;
  // The neutral basemap is a temporary view choice, never an installed-package mutation.
  const [neutralFor, setNeutralFor] = useState<string | null>(null);
  const mapSource = resolveOfflineBasemap({
    regionId: mapRegionPolicy.basemapRegionId, revision: regionalRenderRevision,
    neutralFor, geoPdfId: search.pdfId,
  });
  useEffect(() => {
    if (!mapSource.neutralActive || !neutralRegionId) return;
    return subscribeRegionCatalogChanges((regionId) => {
      if (regionId === neutralRegionId) setCatalogRevision((value) => value + 1);
    });
  }, [mapSource.neutralActive, neutralRegionId]);
  const activeProjectQuery = useProject(params.projectId ?? "");
  const activeProjectName = activeProjectQuery.data?.name?.trim() || null;
  const createLayerMutation = useCreateLayer(params.projectId ?? "");
  const layersQuery = useProjectLayers(params.projectId ?? "", { limit: 100 });
  const projectLayers = useMemo(
    () => layersQuery.data?.items ?? [],
    [layersQuery.data],
  );
  const [showTrackOverlay, setShowTrackOverlay] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const trackLineLayerId = useMemo(
    () => projectLayers.find((l) => l.geometryType === "LineString")?.id,
    [projectLayers],
  );
  const trackRecorder = useTrackRecorder({
    projectId: params.projectId,
    defaultLayerId: trackLineLayerId,
    onError: (msg) => {
      toast({
        title: "Gravador de Trilha",
        description: msg,
        variant: "error",
      });
    },
  });
  const liveGeoJsonRef = useRef(trackRecorder.liveGeoJson);
  liveGeoJsonRef.current = trackRecorder.liveGeoJson;

  const handleSaveTrack = async (name: string) => {
    let layerId = trackLineLayerId;
    if (!layerId && params.projectId) {
      try {
        const newLayer = await createLayerMutation.mutateAsync({
          name: "Trilhas de campo",
          description: "Camada criada automaticamente para gravação de trilhas GNSS.",
          kind: "line",
          geometryType: "LineString",
          srid: 4674,
          style: {},
          metadata: { createdBy: "track-recorder" },
          visibleByDefault: true,
          sortOrder: projectLayers.length,
        });
        layerId = newLayer.id;
      } catch (err) {
        toast({
          title: "Erro ao criar camada para a trilha",
          description: err instanceof Error ? err.message : "Falha na criação da camada.",
          variant: "error",
        });
        return;
      }
    }
    const saved = await trackRecorder.saveTrack(name, layerId);
    if (saved) {
      setShowTrackOverlay(false);
      toast({
        title: "Trilha salva com sucesso",
        description: `A trilha "${name}" foi registrada na camada de linhas.`,
        variant: "success",
      });
    }
  };
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
  const projectFeaturesRef = useRef(projectFeatures);
  projectFeaturesRef.current = projectFeatures;
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
  const [geoTiffReady, setGeoTiffReady] = useState(false);
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
  const [pointSelectionRequest, setPointSelectionRequest] = useState<{ id: string } | null>(null);
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
  const [selectedAreaUnit, setSelectedAreaUnit] = useState<AreaUnit>(() => {
    try {
      const saved = localStorage.getItem("markmap:area_unit");
      if (saved && Object.hasOwn(AREA_UNITS, saved)) return saved as AreaUnit;
    } catch {
      /* ignore storage error */
    }
    return "hectares";
  });

  const handleAreaUnitChange = useCallback((unit: AreaUnit) => {
    setSelectedAreaUnit(unit);
    try {
      localStorage.setItem("markmap:area_unit", unit);
    } catch {
      /* ignore storage error */
    }
  }, []);

  const cycleAreaUnit = useCallback(() => {
    const units: AreaUnit[] = [
      "hectares",
      "alqueire_paulista",
      "alqueire_mineiro",
      "alqueire_baiano",
      "alqueire_norte",
      "square_meters",
      "square_kilometers",
    ];
    setSelectedAreaUnit((prev) => {
      const currentIndex = units.indexOf(prev);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % units.length : 0;
      const nextUnit = units[nextIndex] ?? "hectares";
      try {
        localStorage.setItem("markmap:area_unit", nextUnit);
      } catch {
        /* ignore storage error */
      }
      return nextUnit;
    });
  }, []);

  const totalAreaSquareMeters = useMemo(() => {
    if (measurePoints.length < 3) return 0;
    return measurePointsAreaSquareMeters(measurePoints);
  }, [measurePoints]);
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
  const carSummary = useMemo(
    () => computeCarSummary(datasetFeatures),
    [datasetFeatures],
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

  // ── Coleta Reativa de Posição GNSS e Feições para Boundary Guard (M5) ──
  // Respeita o contrato de AGENTS.md: sem rastreador em idle, sem gravação de posições em storage.
  const [deviceGpsFix, setDeviceGpsFix] = useState<{ lat: number; lng: number } | null>(null);

  const activeGpsForBoundary = useMemo(() => {
    if (trackRecorder.currentFix) {
      return {
        lat: trackRecorder.currentFix.lat,
        lng: trackRecorder.currentFix.lon,
      };
    }
    return deviceGpsFix;
  }, [trackRecorder.currentFix, deviceGpsFix]);

  const boundaryGuard = useBoundaryGuard({
    currentPosition: activeGpsForBoundary,
    features: fullFeatures,
    warningThresholdMeters: 50,
    enabled: true,
  });
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
            }).map((feat) => enrichFeatureWithCarStyle(feat) as unknown as GeoJSON.Feature)
          : []),
        ...projectFeatures.filter(
          (feature) =>
            (layerVisibility[feature.layerId] ??
              projectLayers.find((layer) => layer.id === feature.layerId)
                ?.visibleByDefault ??
              true) &&
            matchesFeature(feature, filterText, filterType),
        ).map(tagProjectPointForRender),
      ],
    }),
    [
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
    let geoTiffOverlay: GeoTiffOverlay | null = null;
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

      if (search.geotiffId) {
        const record = await localRepository.getOriginal(search.geotiffId);
        if (!record || record.mediaType !== "image/tiff") throw new Error("Este GeoTIFF não está mais salvo neste dispositivo.");
        setGeoPdfMessage("Preparando GeoTIFF offline…");
        geoTiffOverlay = await renderGeoTiffOverlay(record.blob);
        const lngs = geoTiffOverlay.coordinates.map(([lng]) => lng);
        const lats = geoTiffOverlay.coordinates.map(([, lat]) => lat);
        center = [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
        zoom = 13;
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
        const { latitude: lat, longitude: lon, accuracy: accuracyM } = position.coords;
        setDeviceGpsFix({ lat, lng: lon });
        if (!geoPdfOverlay || cancelled) return;
        geoPdfManualFocusRef.current = true;
        updateNavigationPosition(null, false); // Avoid a duplicate marker from initial auto-center.
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
      // An unavailable regional search index must not block the OpenFreeMap
      // canvas or any offline project feature. Reconcile it asynchronously.
      void (async () => {
        let generation: string | null = null;
        try {
          if (activeRegionPackageId) {
            generation = (await offlineMapStore.getActiveRevision(activeRegionPackageId))?.generation ?? null;
          }
        } catch { /* Region data are optional, never a map startup prerequisite. */ }
        if (!cancelled) regionReconcilerRef.current?.noteRendered(activeRegionPackageId, generation);
      })();
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

        const ensureLocalDataset = (map: MapLibreMap) => {
          ensureOfflineSourceLayers(map, "local-dataset", {
            type: "geojson",
            data: activeGeoJsonRef.current as unknown as GeoJSON.FeatureCollection,
          }, [
            {
              id: "local-dataset-fill",
              type: "fill",
              source: "local-dataset",
              paint: {
                "fill-color": [
                  "coalesce",
                  ["get", "_carFillColor"],
                  ["get", "fillColor"],
                  "#0ea5e9",
                ],
                "fill-opacity": [
                  "coalesce",
                  ["get", "_carFillOpacity"],
                  ["get", "fillOpacity"],
                  0.4,
                ],
              },
            },
            {
              id: "local-dataset-outline",
              type: "line",
              source: "local-dataset",
              paint: {
                "line-color": [
                  "coalesce",
                  ["get", "_carStrokeColor"],
                  ["get", "strokeColor"],
                  "#0284c7",
                ],
                "line-width": [
                  "coalesce",
                  ["get", "_carStrokeWidth"],
                  ["get", "strokeWidth"],
                  2,
                ],
              },
            },
            { id: "local-dataset-points", type: "circle", source: "local-dataset",
              filter: ["all", ["==", "$type", "Point"], ["!has", PROJECT_POINT_RENDER_ID]],
              layout: { visibility: showDatasetPoints ? "visible" : "none" },
              paint: { "circle-color": "#0284c7", "circle-radius": 5,
                "circle-stroke-color": "#fff", "circle-stroke-width": 1 } },
            // Project-owned points remain visible when imported dataset points
            // are hidden; the user must still be able to edit them by touch.
            { id: "local-project-points", type: "circle", source: "local-dataset",
              filter: ["all", ["==", "$type", "Point"], ["has", PROJECT_POINT_RENDER_ID]],
              paint: { "circle-color": "#0d9488", "circle-radius": 7,
                "circle-stroke-color": "#fff", "circle-stroke-width": 2 } },
          ]);
        };

        const ensureGeoTiffOverlay = (map: MapLibreMap) => {
          if (!geoTiffOverlay) return;
          const overlay = ensureOfflineSourceLayers(
            map,
            "geotiff-overlay",
            {
              type: "image",
              url: geoTiffOverlay.url,
              coordinates: geoTiffOverlay.coordinates,
            },
            [
              {
                id: "geotiff-overlay",
                type: "raster",
                source: "geotiff-overlay",
                paint: { "raster-opacity": 1 },
              },
            ],
          );
          if ((overlay.sourceAdded || overlay.layersAdded) && map.getLayer("local-dataset-fill"))
            map.moveLayer("geotiff-overlay", "local-dataset-fill");
          setGeoTiffReady(true);
        };

        const ensureGeoPdfOverlay = (map: MapLibreMap) => {
          if (!geoPdfOverlay) return;
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
        };

        const ensureDrawPreview = (map: MapLibreMap) => {
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
        };

        const ensureRegionalContours = (map: MapLibreMap) => {
          if (!regionalContours) return;
          ensureOfflineSourceLayers(map, "regional-contours", {
            type: "geojson", data: regionalContours,
          }, [
            { id: "regional-contours-line", type: "line", source: "regional-contours",
              paint: { "line-color": "#9a754e", "line-width": ['case', ['get', 'major'], 1.6, 0.8],
                "line-opacity": 0.75 } },
          ]);
        };

        const ensureRegionalTransit = (map: MapLibreMap) => {
          ensureOfflineSourceLayers(map, "regional-transit", {
            type: "geojson", data: transitGeoJSONRef.current,
          }, [
            { id: "regional-transit-points", type: "circle", source: "regional-transit",
              paint: { "circle-radius": 5, "circle-color": ['coalesce', ['get', 'color'], '#2586a3'],
                "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.4,
                "circle-opacity": 0.9 } },
          ]);
        };

        const ensureOfflineRoute = (map: MapLibreMap) => {
          ensureOfflineSourceLayers(map, "offline-route", {
            type: "geojson", data: routeAsGeoJSON(plannedRouteRef.current),
          }, [
            { id: "offline-route-line", type: "line", source: "offline-route",
              paint: { "line-color": "#dc2626", "line-width": 5, "line-opacity": 0.9 },
              layout: { "line-join": "round", "line-cap": "round" } },
          ]);
        };

        const ensureLiveTrack = (map: MapLibreMap) => {
          ensureOfflineSourceLayers(
            map,
            "live-track",
            {
              type: "geojson",
              data: (liveGeoJsonRef.current as unknown as GeoJSON.FeatureCollection) ?? {
                type: "FeatureCollection",
                features: [],
              },
            },
            [
              {
                id: "live-track-casing",
                type: "line",
                source: "live-track",
                paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.9 },
                layout: { "line-join": "round", "line-cap": "round" },
              },
              {
                id: "live-track-line",
                type: "line",
                source: "live-track",
                paint: { "line-color": "#2563eb", "line-width": 4, "line-opacity": 0.95 },
                layout: { "line-join": "round", "line-cap": "round" },
              },
            ],
          );
        };

        const ensureSource = () => {
          if (cancelled || webglLostRef.current || mapRef.current !== map) return;

          // Recover individual missing layers even when a previous partial
          // style.load already created their shared source.
          ensureLocalDataset(map);
          ensureGeoTiffOverlay(map);
          ensureGeoPdfOverlay(map);
          ensureDrawPreview(map);
          ensureRegionalContours(map);
          ensureRegionalTransit(map);
          ensureOfflineRoute(map);
          ensureLiveTrack(map);

          if (!search.pdfId) fitSelection(map);
          setMapEpoch((value) => value + 1);
        };
        styleLifecycle = createOfflineStyleLifecycle({
          map,
          isActive: () => !cancelled && !webglLostRef.current && mapRef.current === map,
          onHydrate: ensureSource,
          onStyleReset: () => { setMapReady(false); setGeoPdfReady(false); setGeoTiffReady(false); },
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
            .setDOMContent(createPropertyPopupContent(e.features[0]?.properties ?? {}))
            .addTo(map);
        });
        map.on("click", "local-project-points", (e) => {
          if (!e.features?.length || measuringRef.current || drawingSessionRef.current) return;
          const ownedPointId = resolveClickedProjectPointId(
            projectFeaturesRef.current, e.features[0]?.properties,
          );
          if (!ownedPointId) return;
          setPointSelectionRequest({ id: ownedPointId });
          setSidePanel("pontos");
        });
        map.on("mouseenter", "local-project-points", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "local-project-points", () => {
          map.getCanvas().style.cursor = "";
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
      try { geoTiffOverlay?.release(); } catch { /* release continues */ }
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

  useEffect(() => {
    const source = mapRef.current?.getSource("live-track") as GeoJSONSource | undefined;
    source?.setData(
      (trackRecorder.liveGeoJson as unknown as GeoJSON.FeatureCollection) ?? {
        type: "FeatureCollection",
        features: [],
      },
    );
  }, [trackRecorder.liveGeoJson, mapEpoch]);

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

  // Painel lateral
  const panelBg =
    "absolute z-20 bg-surface-container border border-outline-variant shadow-2xl";
  const panelPos =
    "bottom-[calc(8rem+env(safe-area-inset-bottom))] left-3 right-3 lg:bottom-auto lg:top-0 lg:left-auto lg:right-0 lg:h-full lg:w-80";
  const panelRound = "rounded-2xl lg:rounded-none lg:rounded-l-2xl";
  const labelClass = "text-on-surface font-semibold text-sm";
  const subtitleClass = "text-on-surface-variant text-xs";
  const valueClass = "text-on-surface font-mono font-bold text-sm";

  return (
    <div
      className="markmap-workspace relative h-full w-full flex flex-col overflow-hidden"
      data-map-ready={mapReady ? "true" : "false"}
      data-feature-count={appliedCount}
      data-geopdf-ready={geoPdfReady ? "true" : "false"}
      data-geotiff-ready={geoTiffReady ? "true" : "false"}
    >
      {/* ── Banner de Alerta de Proximidade e Limites de Propriedade (Boundary Guard - M5) ── */}
      <BoundaryAlertBanner
        status={boundaryGuard.status}
        distanceMeters={boundaryGuard.distanceToBoundaryMeters}
        polygonName={boundaryGuard.nearestPolygonName}
        isMuted={boundaryGuard.isMuted}
        onToggleMute={boundaryGuard.toggleMute}
      />

      {params.projectId && (
        <div role="status" data-testid="active-project-indicator"
          className="pointer-events-none absolute left-16 right-16 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 mx-auto max-w-md min-w-0 rounded-lg border border-outline-variant bg-surface-container/95 px-3 py-2 text-center text-xs font-semibold text-on-surface shadow-md">
          <span className="block break-words [overflow-wrap:anywhere]">
            {activeProjectQuery.isError ? "Projeto indisponível" :
              activeProjectName ? `Projeto: ${activeProjectName}` : "Carregando projeto…"}
          </span>
        </div>
      )}

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

      {/* ── Overlay Flutuante do Gravador de Trilha GNSS (MM-AVZ-05) ── */}
      <TrackRecordingOverlay
        open={showTrackOverlay || trackRecorder.status !== "idle"}
        status={trackRecorder.status}
        stats={trackRecorder.stats}
        currentAccuracyMeters={trackRecorder.gpsAccuracy}
        currentSpeedKmh={trackRecorder.currentSpeedKmh}
        currentElevationMeters={trackRecorder.currentElevationMeters}
        hasDraft={trackRecorder.hasRecoveredDraft}
        onStart={() => {
          void trackRecorder.startRecording();
        }}
        onPause={trackRecorder.pauseRecording}
        onResume={trackRecorder.resumeRecording}
        onSave={handleSaveTrack}
        onDiscard={async () => {
          await trackRecorder.discardTrack();
          setShowTrackOverlay(false);
        }}
        onRestoreDraft={trackRecorder.restoreDraft}
        onClose={() => setShowTrackOverlay(false)}
      />

      {/* ── Modal de Exportação de Desenhos e Trilhas (KML & GPX) ── */}
      <FieldExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        projectName={activeProjectName ?? params.projectId}
        projectFeatures={projectFeatures}
        activeDrawingSession={drawingSession}
        activeTrackGeoJson={trackRecorder.liveGeoJson}
      />

      {/* ── Barra de ferramentas flutuante ── */}
      <div role="toolbar" aria-label="Atalhos do mapa" className="absolute bottom-[calc(4rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 lg:bottom-auto lg:top-6 lg:left-4 lg:translate-x-0 markmap-map-tools bg-surface-container/90 backdrop-blur-xl border border-outline-variant rounded-2xl p-2 flex lg:flex-col gap-1.5 shadow-2xl z-10 w-max max-w-[92vw] overflow-x-auto lg:max-h-[calc(100%-3rem)] lg:overflow-x-hidden lg:overflow-y-auto">
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
        {/* Escolha uma região e baixe diretamente do mapa. */}
        <ToolBtn active={sidePanel === "baixar-mapas"}
          onClick={() => togglePanel("baixar-mapas")} icon="download" label="Baixar mapas" color="emerald" />
        {/* Atalhos offline no mesmo menu; os serviços seguem montados ao fechar. */}
        <ToolBtn active={sidePanel === "busca-offline"}
          onClick={() => togglePanel("busca-offline")} icon="search" label="Buscar locais neste mapa" color="cyan" />
        <ToolBtn active={sidePanel === "lugares-offline"}
          onClick={() => togglePanel("lugares-offline")} icon="map" label="Lugares e transporte offline" color="blue" />
        <ToolBtn active={sidePanel === "altitude-offline"}
          onClick={() => togglePanel("altitude-offline")} icon="analytics" label="Altitude" color="emerald" />
        <ToolBtn active={sidePanel === "navegacao-offline"}
          onClick={() => togglePanel("navegacao-offline")} icon="coordinates" label="Navegação GPS offline" color="amber" />
        {/* Gravador contínuo de trilha GNSS (MM-AVZ-05) */}
        <ToolBtn
          active={showTrackOverlay || trackRecorder.status !== "idle"}
          onClick={() => setShowTrackOverlay((prev) => !prev)}
          icon="line"
          label={trackRecorder.status === "recording" ? "Trilha em gravação (REC)" : "Gravar trilha GNSS"}
          color={trackRecorder.status === "recording" ? "rose" : "cyan"}
        />
        {/* Separador */}
        <div className="w-full h-px md:block hidden bg-outline-variant my-0.5" />
        <div className="w-px h-8 md:hidden block bg-outline-variant mx-0.5" />
        {/* Minha localização */}
        <ToolBtn
          active={false}
          onClick={() => void handleMyLocation()}
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
          active={sidePanel === "pontos"}
          onClick={() => togglePanel("pontos")}
          icon="point"
          label="Gerenciar pontos"
          color="blue"
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
        <ToolBtn
          active={showExportModal}
          onClick={() => setShowExportModal(true)}
          icon="upload"
          label="Exportar KML e GPX"
          color="emerald"
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
          {measurePoints.length === 0 ? (
            <span>Clique no mapa para iniciar a medição</span>
          ) : (
            <span>
              {measurePoints.length} ponto{measurePoints.length > 1 ? "s" : ""} · {formatDistance(totalDistance)}
            </span>
          )}
          {measurePoints.length >= 3 && (
            <button
              type="button"
              onClick={cycleAreaUnit}
              title="Clique para alternar unidade de área"
              aria-label="Alternar unidade agrária de área"
              className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full transition-colors font-mono cursor-pointer"
            >
              📐 {formatArea(totalAreaSquareMeters, selectedAreaUnit)}
            </button>
          )}
          <button
            onClick={toggleMeasure}
            aria-label="Encerrar medição"
            className="ml-1 text-amber-600 hover:text-amber-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Painel lateral (branco, texto escuro) ── */}
      {sidePanel !== "none" && sidePanel !== "baixar-mapas" && !sidePanel.endsWith("-offline") && (
        <div
          className={`${panelBg} ${panelPos} ${panelRound} flex flex-col max-h-[55vh] lg:max-h-full overflow-y-auto`}
        >
          {/* Header do painel */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant flex-shrink-0">
            <span className="text-on-surface font-bold text-base flex items-center gap-2">
              <AppIcon
                name={
                  sidePanel === "pontos" ? "point" : sidePanel === "telemetria"
                    ? "telemetry"
                    : sidePanel === "camadas"
                      ? "layers"
                      : sidePanel === "filtros"
                        ? "filters"
                        : "tools"
                }
                size="md"
              />
              {sidePanel === "pontos" ? "Pontos do projeto" : sidePanel === "telemetria"
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

          {sidePanel === "pontos" && (
            <ProjectPointsPanel
              key={params.projectId ?? "sem-projeto"}
              projectId={params.projectId ?? ""}
              features={projectFeatures}
              selectionRequest={pointSelectionRequest}
              onLocate={(coordinates) => {
                const map = mapRef.current;
                if (map) map.flyTo({ center: coordinates, zoom: Math.max(15, map.getZoom()) });
              }}
              onChanged={async () => { await featuresQuery.refetch(); }}
            />
          )}

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
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2.5">
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
                      {measurePoints.length >= 3 && (
                        <Row
                          label="Área geodésica"
                          value={formatArea(totalAreaSquareMeters, selectedAreaUnit)}
                          labelCls="text-amber-800 font-semibold text-sm"
                          valueCls="text-amber-900 font-mono font-bold text-base"
                        />
                      )}
                      <div className="pt-2 border-t border-amber-200">
                        <label
                          htmlFor="measure-area-unit-select"
                          className="block text-amber-800 font-semibold text-xs mb-1"
                        >
                          Unidade agrária de área:
                        </label>
                        <select
                          id="measure-area-unit-select"
                          aria-label="Unidade agrária de área"
                          value={selectedAreaUnit}
                          onChange={(e) => handleAreaUnitChange(e.target.value as AreaUnit)}
                          className="w-full text-xs font-medium rounded-lg border border-amber-300 bg-white text-amber-900 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
                        >
                          <option value="hectares">Hectares (ha · 10.000 m²)</option>
                          <option value="alqueire_paulista">Alqueire Paulista (2,42 ha · 24.200 m²)</option>
                          <option value="alqueire_mineiro">Alqueire Mineiro / Goiano (4,84 ha · 48.400 m²)</option>
                          <option value="alqueire_baiano">Alqueire Baiano (9,68 ha · 96.800 m²)</option>
                          <option value="alqueire_norte">Alqueirão do Norte (2,72 ha · 27.200 m²)</option>
                          <option value="square_meters">Metros Quadrados (m² · 1 m²)</option>
                          <option value="square_kilometers">Quilômetros Quadrados (km² · 1.000.000 m²)</option>
                        </select>
                      </div>
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
              {activeDataset && datasetHasPoints && (
                <div className="flex items-center justify-between py-2 px-3 pl-6 rounded-lg border border-outline-variant/60 bg-surface-container text-xs text-on-surface">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0 bg-cyan-400" />
                    <span>{datasetHasPolygons ? "Pontos e marcos dos vértices" : "Pontos do dataset"}</span>
                  </div>
                  <button
                    aria-label="Alternar pontos do dataset"
                    aria-pressed={showDatasetPoints}
                    disabled={!layerVisibility.dataset}
                    onClick={() =>
                      setLayerVisibility((prev) => ({
                        ...prev,
                        datasetPoints: !showDatasetPoints,
                      }))
                    }
                    className={`h-5 w-9 rounded-full relative transition-colors duration-200 flex-shrink-0 ${showDatasetPoints && layerVisibility.dataset ? "bg-secondary" : "bg-on-surface/15"}`}
                  >
                    <span
                      className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${showDatasetPoints && layerVisibility.dataset ? "translate-x-4" : "translate-x-0.5"}`}
                    />
                  </button>
                </div>
              )}
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
              {carSummary.isCarDataset && (
                <CarSummaryCard summary={carSummary} />
              )}
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
                  icon: "line" as AppIconName,
                  label: "Gravar Trilha GNSS",
                  desc: "Registro contínuo de trajeto de campo com telemetria.",
                  action: () => {
                    setShowTrackOverlay(true);
                    setSidePanel("none");
                  },
                },
                {
                  icon: "upload" as AppIconName,
                  label: "Exportar KML & GPX",
                  desc: "Exportar desenhos e trilhas de campo para Google Earth e Garmin.",
                  action: () => {
                    setShowExportModal(true);
                    setSidePanel("none");
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
      className={`min-h-[44px] min-w-[44px] shrink-0 p-2.5 rounded-xl border flex items-center justify-center transition-all shadow-sm ${active ? (activeColors[color] ?? activeColors["slate"]) : idleClass}`}
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
