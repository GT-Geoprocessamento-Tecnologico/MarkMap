// Desenvolvido por MtsFerreira. Hook de monitoramento reativo de limites e divisas (M5).
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  calculateMinDistanceToPolygonMeters,
  isPointInPolygonInternal,
} from "@markmap/maps";
import {
  isBoundaryAudioMuted,
  playBoundaryWarningSound,
  setBoundaryAudioMuted,
  subscribeBoundaryAudioMute,
  toggleBoundaryAudioMute,
  type BoundaryAudioWarningType,
} from "../lib/sound/boundary-audio";

export type BoundaryGuardStatus = "inactive" | "safe" | "approaching" | "breach";

export interface BoundaryZonePolygon {
  id: string;
  name: string;
  rings: Array<Array<[number, number]>>; // [lon, lat][]
  isCarImovelPerimeter?: boolean;
}

export interface BoundaryGuardAlert {
  polygonId: string;
  polygonName: string;
  status: BoundaryGuardStatus;
  distanceToBoundaryMeters: number;
  timestamp: number;
}

export interface UseBoundaryGuardOptions {
  /** Posição GNSS atual do dispositivo ([lon, lat] ou { lat, lng }) */
  currentPosition?: { lat: number; lng: number } | [number, number] | null;
  /** Feições ativas a monitorar (GeoJSON Features do projeto ou CAR) */
  features?: Array<
    | GeoJSON.Feature
    | { id?: string | number; geometry: unknown; properties?: unknown }
  > | null;
  /** Raio de proximidade em metros para alerta de aproximação (padrão: 50m) */
  warningThresholdMeters?: number;
  /** Habilita ou desabilita o monitoramento ativo (padrão: true) */
  enabled?: boolean;
  /** Intervalo de throttle sonoro em ms (padrão: 15_000ms) */
  soundThrottleMs?: number;
  /** Callback disparado em mudanças de estado */
  onStatusChange?: (status: BoundaryGuardStatus, alert: BoundaryGuardAlert | null) => void;
}

export interface UseBoundaryGuardReturn {
  status: BoundaryGuardStatus;
  distanceToBoundaryMeters: number | null;
  nearestPolygonName: string | null;
  nearestPolygonId: string | null;
  activeAlert: BoundaryGuardAlert | null;
  isMuted: boolean;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  testWarningSound: (type: BoundaryAudioWarningType) => void;
}

export function useBoundaryGuard(options: UseBoundaryGuardOptions = {}): UseBoundaryGuardReturn {
  const {
    currentPosition,
    features,
    warningThresholdMeters = 50,
    enabled = true,
    soundThrottleMs = 15_000,
    onStatusChange,
  } = options;

  // Sincronização reativa de mudo com storage
  const isMuted = useSyncExternalStore(
    subscribeBoundaryAudioMute,
    isBoundaryAudioMuted,
    () => false
  );

  const [status, setStatus] = useState<BoundaryGuardStatus>("inactive");
  const [distanceToBoundaryMeters, setDistanceToBoundaryMeters] = useState<number | null>(null);
  const [nearestPolygonName, setNearestPolygonName] = useState<string | null>(null);
  const [nearestPolygonId, setNearestPolygonId] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<BoundaryGuardAlert | null>(null);

  const lastSoundTimeRef = useRef<number>(0);
  const lastStateRef = useRef<BoundaryGuardStatus>("inactive");

  // Decomposição de coordenadas primitivas para estabilidade referencial
  const currentPosLat = currentPosition
    ? Array.isArray(currentPosition)
      ? currentPosition[1]
      : currentPosition.lat
    : null;
  const currentPosLng = currentPosition
    ? Array.isArray(currentPosition)
      ? currentPosition[0]
      : currentPosition.lng
    : null;

  // Extrai e normaliza feições poligonais (priorizando AREA_IMOVEL do CAR se presente)
  const boundaryZones = useMemo<BoundaryZonePolygon[]>(() => {
    if (!features || !features.length) return [];

    const zones: BoundaryZonePolygon[] = [];

    for (const feat of features) {
      if (!feat || !feat.geometry) continue;
      const geom = feat.geometry as GeoJSON.Geometry;
      const props = (feat.properties as Record<string, unknown>) || {};
      const id = String(feat.id || props.id || `zone-${zones.length}`);
      const name = String(
        props.nome ||
          props.nom_tema ||
          props.title ||
          props.name ||
          props.layerName ||
          (props.tipo ? `Tema CAR: ${props.tipo}` : "Limite da Propriedade")
      );

      const isAreaImovel =
        props.nom_tema === "AREA_IMOVEL" ||
        props.tipo === "AREA_IMOVEL" ||
        props.layerName === "AREA_IMOVEL";

      if (geom.type === "Polygon" && Array.isArray(geom.coordinates)) {
        const rings = geom.coordinates as Array<Array<[number, number]>>;
        if (rings.length > 0 && rings[0] && rings[0].length >= 3) {
          zones.push({ id, name, rings, isCarImovelPerimeter: isAreaImovel });
        }
      } else if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates)) {
        const multiRings = geom.coordinates as Array<Array<Array<[number, number]>>>;
        for (let pIdx = 0; pIdx < multiRings.length; pIdx++) {
          const rings = multiRings[pIdx];
          if (rings && rings.length > 0 && rings[0] && rings[0].length >= 3) {
            zones.push({
              id: `${id}-part-${pIdx}`,
              name,
              rings,
              isCarImovelPerimeter: isAreaImovel,
            });
          }
        }
      }
    }

    // Se houver AREA_IMOVEL do CAR, ordena para que seja o alvo prioritário
    zones.sort((a, b) => (b.isCarImovelPerimeter ? 1 : 0) - (a.isCarImovelPerimeter ? 1 : 0));
    return zones;
  }, [features]);

  // Avaliação reativa da posição GNSS em relação às divisas
  useEffect(() => {
    if (
      !enabled ||
      currentPosLat === null ||
      currentPosLng === null ||
      boundaryZones.length === 0
    ) {
      setStatus("inactive");
      setDistanceToBoundaryMeters(null);
      setNearestPolygonName(null);
      setNearestPolygonId(null);
      setActiveAlert(null);
      lastStateRef.current = "inactive";
      return;
    }

    const coord: [number, number] = [currentPosLng, currentPosLat];

    let minGlobalDistance = Number.POSITIVE_INFINITY;
    let closestZone: BoundaryZonePolygon | null = null;
    let isInsideAnyZone = false;

    // Se houver polígonos com AREA_IMOVEL do CAR, eles definem o perímetro prioritário da propriedade
    const targetZones = boundaryZones.some((z) => z.isCarImovelPerimeter)
      ? boundaryZones.filter((z) => z.isCarImovelPerimeter)
      : boundaryZones;

    // Avalia contenção e distância para as zonas alvo
    for (const zone of targetZones) {
      const insideZone = isPointInPolygonInternal(coord, zone.rings);
      if (insideZone) {
        isInsideAnyZone = true;
      }

      const zoneMinDistance = calculateMinDistanceToPolygonMeters(coord, zone.rings);
      if (zoneMinDistance < minGlobalDistance) {
        minGlobalDistance = zoneMinDistance;
        closestZone = zone;
      }
    }

    const roundedDistance = Number.isFinite(minGlobalDistance)
      ? Math.round(minGlobalDistance)
      : null;

    let computedStatus: BoundaryGuardStatus = "safe";

    if (!isInsideAnyZone) {
      // Fora dos limites da propriedade ativa -> violação/cruzamento
      computedStatus = "breach";
    } else if (roundedDistance !== null && roundedDistance <= warningThresholdMeters) {
      // Dentro da propriedade, mas a menos de 50m da cerca -> aproximação preventiva
      computedStatus = "approaching";
    } else {
      // Bem no interior da propriedade (> 50m) -> seguro
      computedStatus = "safe";
    }

    const nextPolygonName = closestZone?.name ?? null;
    const nextPolygonId = closestZone?.id ?? null;

    setStatus((prev) => (prev !== computedStatus ? computedStatus : prev));
    setDistanceToBoundaryMeters((prev) => (prev !== roundedDistance ? roundedDistance : prev));
    setNearestPolygonName((prev) => (prev !== nextPolygonName ? nextPolygonName : prev));
    setNearestPolygonId((prev) => (prev !== nextPolygonId ? nextPolygonId : prev));

    const alert: BoundaryGuardAlert | null =
      closestZone && roundedDistance !== null
        ? {
            polygonId: closestZone.id,
            polygonName: closestZone.name,
            status: computedStatus,
            distanceToBoundaryMeters: roundedDistance,
            timestamp: Date.now(),
          }
        : null;

    setActiveAlert((prev) => {
      if (!alert && !prev) return null;
      if (
        prev &&
        alert &&
        prev.polygonId === alert.polygonId &&
        prev.status === alert.status &&
        prev.distanceToBoundaryMeters === alert.distanceToBoundaryMeters
      ) {
        return prev;
      }
      return alert;
    });

    // Dispara callback se fornecido
    if (onStatusChange && computedStatus !== lastStateRef.current) {
      onStatusChange(computedStatus, alert);
    }

    // Orquestração sonora com antibounce / throttle estrito de 15 segundos
    const now = Date.now();
    const timeSinceLastSound = now - lastSoundTimeRef.current;
    const isStateTransition = computedStatus !== lastStateRef.current;
    const isThrottled = timeSinceLastSound < soundThrottleMs;

    if (computedStatus === "approaching" || computedStatus === "breach") {
      // Se houve transição de estado OU se expirou o throttle de 15 segundos no mesmo alerta
      if (isStateTransition || !isThrottled) {
        void playBoundaryWarningSound(computedStatus);
        lastSoundTimeRef.current = now;
      }
    }

    lastStateRef.current = computedStatus;
  }, [
    currentPosLat,
    currentPosLng,
    boundaryZones,
    enabled,
    warningThresholdMeters,
    soundThrottleMs,
    onStatusChange,
  ]);

  const testWarningSound = useCallback((type: BoundaryAudioWarningType) => {
    void playBoundaryWarningSound(type, { force: true });
  }, []);

  return {
    status,
    distanceToBoundaryMeters,
    nearestPolygonName,
    nearestPolygonId,
    activeAlert,
    isMuted,
    toggleMute: toggleBoundaryAudioMute,
    setMuted: setBoundaryAudioMuted,
    testWarningSound,
  };
}
