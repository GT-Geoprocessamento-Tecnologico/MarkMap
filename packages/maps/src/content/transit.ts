import type { TransitNetwork, TransitStation, TransitLine } from "@markmap/contracts";

export class TransitStore {
  private stations = new Map<string, TransitStation>();
  private lines = new Map<string, TransitLine>();
  private stationsByName = new Map<string, string[]>();

  load(network: TransitNetwork): void {
    this.stations.clear();
    this.lines.clear();
    this.stationsByName.clear();
    for (const station of network.stations) {
      this.stations.set(station.id, station);
      const key = station.name.toLowerCase();
      const list = this.stationsByName.get(key) ?? [];
      list.push(station.id);
      this.stationsByName.set(key, list);
    }
    for (const line of network.lines) {
      this.lines.set(line.id, line);
    }
  }

  getStation(id: string): TransitStation | undefined {
    return this.stations.get(id);
  }

  getLine(id: string): TransitLine | undefined {
    return this.lines.get(id);
  }

  searchStations(query: string, limit = 10): TransitStation[] {
    const q = query.trim().toLocaleLowerCase('pt-BR');
    if (q.length < 2 || !Number.isSafeInteger(limit) || limit < 1) return [];
    limit = Math.min(50, limit);
    const results: TransitStation[] = [];
    for (const station of this.stations.values()) {
      if (station.name.toLowerCase().includes(q)) {
        results.push(station);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  getLinesForStation(stationId: string): TransitLine[] {
    const station = this.stations.get(stationId);
    if (!station) return [];
    return station.lines
      .map((lineId) => this.lines.get(lineId))
      .filter((l): l is TransitLine => l !== undefined);
  }

  getStationsNearby(lon: number, lat: number, radiusKm: number): TransitStation[] {
    const results: TransitStation[] = [];
    if (![lon, lat, radiusKm].every(Number.isFinite) || lon < -180 || lon > 180 || lat < -90 || lat > 90 || radiusKm <= 0) return [];
    for (const station of this.stations.values()) {
      const dist = haversineKm(lat, lon, station.lat, station.lon);
      if (dist <= radiusKm) results.push(station);
    }
    return results.sort((a, b) => {
      const da = haversineKm(lat, lon, a.lat, a.lon);
      const db = haversineKm(lat, lon, b.lat, b.lon);
      return da - db;
    });
  }

  get stationCount(): number {
    return this.stations.size;
  }

  get lineCount(): number {
    return this.lines.size;
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
