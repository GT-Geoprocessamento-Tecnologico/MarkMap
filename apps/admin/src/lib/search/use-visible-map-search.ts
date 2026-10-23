// Desenvolvido por MtsFerreira. A view change replaces the in-memory index, never persisted GPS/history.
import { useEffect, useState, type RefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { LocalSearchRecord } from "./local-map-search";
import { collectVisibleMapSearch } from "./visible-map-search";

type Snapshot = { key: string; records: LocalSearchRecord[] };
const EMPTY: LocalSearchRecord[] = [];

export function useVisibleMapSearch(
  mapRef: RefObject<MapLibreMap | null>,
  regionId: string | null,
  revision: number,
  mapEpoch: number,
  ready: boolean,
  open: boolean,
  regionLabel: string,
): LocalSearchRecord[] {
  const key = `${regionId ?? ""}:${revision}:${mapEpoch}`;
  const enabled = Boolean(regionId && ready && open);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    key: "",
    records: EMPTY,
  });
  useEffect(() => {
    const map = mapRef.current;
    if (!enabled || !map || !regionId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let signature = "";
    setSnapshot({ key, records: EMPTY });
    const refresh = () => {
      timer = undefined;
      if (!active || mapRef.current !== map) return;
      let records: LocalSearchRecord[];
      try {
        records = collectVisibleMapSearch(map, regionId, regionLabel);
      } catch {
        records = EMPTY;
      } // Styles can be replaced while tiles are decoding.
      const next = JSON.stringify(records);
      if (next === signature) return;
      signature = next;
      setSnapshot({ key, records });
    };
    const schedule = () => {
      if (!active) return;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(refresh, 180);
    };
    map.on("sourcedata", schedule);
    map.on("moveend", schedule);
    map.on("styledata", schedule);
    schedule();
    return () => {
      active = false;
      if (timer !== undefined) clearTimeout(timer);
      map.off("sourcedata", schedule);
      map.off("moveend", schedule);
      map.off("styledata", schedule);
    };
  }, [mapRef, enabled, key, regionId, regionLabel]);
  return enabled && snapshot.key === key ? snapshot.records : EMPTY;
}
