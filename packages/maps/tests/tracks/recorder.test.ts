import { describe, expect, it } from "vitest";
import { TrackRecorder } from "../../src/tracks/recorder.js";

describe("TrackRecorder - Real-time Track Recording (MM-AVZ-05)", () => {
  it("gerencia o ciclo de vida e transições de estado com idempotência", () => {
    const recorder = new TrackRecorder({
      id: "trk-01",
      name: "Trilha da Serra",
      startTime: 1000,
    });

    expect(recorder.getStatus()).toBe("idle");

    // Start
    recorder.start(1000);
    expect(recorder.getStatus()).toBe("recording");
    // Idempotente se chamar start de novo
    recorder.start(1100);
    expect(recorder.getStatus()).toBe("recording");

    // Pause
    recorder.pause(2000);
    expect(recorder.getStatus()).toBe("paused");
    // Idempotente se chamar pause de novo
    recorder.pause(2100);
    expect(recorder.getStatus()).toBe("paused");

    // Resume
    recorder.resume(3000);
    expect(recorder.getStatus()).toBe("recording");
    // Idempotente se chamar resume enquanto já está gravando
    recorder.resume(3100);
    expect(recorder.getStatus()).toBe("recording");

    // Stop
    const track = recorder.stop(4000);
    expect(recorder.getStatus()).toBe("stopped");
    expect(track).toBeDefined();

    // Clear
    recorder.clear();
    expect(recorder.getStatus()).toBe("idle");
    expect(recorder.getTrack()).toHaveLength(0);
    expect(recorder.getStats().distanceMeters).toBe(0);
  });

  it("aplica o filtro estrito de acurácia GPS (> 15m descartado)", () => {
    const recorder = new TrackRecorder();
    recorder.start(1000);

    // Amostra com acurácia 8m -> aceita
    const p1 = recorder.addPoint({ lat: -23.5505, lon: -46.6333, alt: 760, timestamp: 1000, accuracy: 8 });
    expect(p1).not.toBeNull();
    expect(p1?.filtered).toBe(true);

    // Amostra com acurácia 15m -> aceita (limite inclusivo)
    const p2 = recorder.addPoint({ lat: -23.5506, lon: -46.6334, alt: 762, timestamp: 1200, accuracy: 15 });
    expect(p2).not.toBeNull();

    // Amostra com acurácia 15.1m -> descartada
    const pDegraded1 = recorder.addPoint({ lat: -23.5507, lon: -46.6335, alt: 765, timestamp: 1400, accuracy: 15.1 });
    expect(pDegraded1).toBeNull();

    // Amostra com acurácia 25m -> descartada
    const pDegraded2 = recorder.addPoint({ lat: -23.5508, lon: -46.6336, alt: 770, timestamp: 1600, accuracy: 25 });
    expect(pDegraded2).toBeNull();

    // Amostra com acurácia undefined -> aceita
    const pNoAcc = recorder.addPoint({ lat: -23.5509, lon: -46.6337, alt: 763, timestamp: 1800 });
    expect(pNoAcc).not.toBeNull();

    // Amostra com acurácia inválida (-1 ou NaN) -> descartada
    expect(recorder.addPoint({ lat: -23.5510, lon: -46.6338, alt: 764, timestamp: 2000, accuracy: -1 })).toBeNull();
    expect(recorder.addPoint({ lat: -23.5511, lon: -46.6339, alt: 765, timestamp: 2200, accuracy: NaN })).toBeNull();

    // Coordenadas fora da faixa geográfica -> descartadas
    expect(recorder.addPoint({ lat: 95, lon: -46.6338, alt: 764, timestamp: 2400 })).toBeNull();
    expect(recorder.addPoint({ lat: -23.5510, lon: 190, alt: 764, timestamp: 2600 })).toBeNull();

    // Total de pontos aceitos no track deve ser 3 (p1, p2, pNoAcc)
    expect(recorder.getTrack()).toHaveLength(3);
  });

  it("calcula duração ativa desconsiderando períodos em pausa", () => {
    const recorder = new TrackRecorder({ id: "trk-time", name: "Trilha Tempo" });

    // Início em t = 1000
    recorder.start(1000);

    // Ponto em t = 2000
    recorder.addPoint({ lat: -23.5501, lon: -46.6333, alt: 760, timestamp: 2000, accuracy: 5 });

    // Pausa em t = 3000 (2 segundos gravados)
    recorder.pause(3000);
    expect(recorder.getStats(4000).durationSeconds).toBe(2);

    // Ponto submetido em pausa deve ser ignorado
    const ignoredPoint = recorder.addPoint({ lat: -23.5502, lon: -46.6334, alt: 762, timestamp: 5000, accuracy: 5 });
    expect(ignoredPoint).toBeNull();

    // Retomada em t = 9000 (6 segundos de pausa não devem ser contados)
    recorder.resume(9000);

    // Ponto em t = 12000 (+3 segundos gravados)
    recorder.addPoint({ lat: -23.5503, lon: -46.6335, alt: 764, timestamp: 12000, accuracy: 5 });

    // Parada em t = 13000 (+1 segundo gravado)
    recorder.stop(13000);

    const stats = recorder.getStats();
    // 2s (1000 a 3000) + 4s (9000 a 13000) = 6s total
    expect(stats.durationSeconds).toBe(6);
  });

  it("calcula distância geodésica acumulada e velocidade média", () => {
    const recorder = new TrackRecorder();
    recorder.start(1000);

    // Ponto inicial em São Paulo
    recorder.addPoint({ lat: -23.5500, lon: -46.6333, alt: 750, timestamp: 1000, accuracy: 4 });
    // Deslocamento para o sul (~111 metros de latitude)
    recorder.addPoint({ lat: -23.5510, lon: -46.6333, alt: 750, timestamp: 11000, accuracy: 4 });

    const stats = recorder.getStats(11000);
    // ~111 metros
    expect(stats.distanceMeters).toBeGreaterThan(105);
    expect(stats.distanceMeters).toBeLessThan(115);
    expect(stats.distanceKm).toBeCloseTo(stats.distanceMeters / 1000, 4);

    // Duração ativa: 10 segundos (1000 a 11000)
    expect(stats.durationSeconds).toBe(10);
    // Velocidade média: ~11.1 m/s (~40 km/h)
    expect(stats.avgSpeedMs).toBeCloseTo(stats.distanceMeters / 10, 1);
    expect(stats.avgSpeedKmh).toBeCloseTo(stats.avgSpeedMs * 3.6, 1);
  });

  it("calcula ganho e perda de elevação acumulados e cotas extremas", () => {
    const recorder = new TrackRecorder();
    recorder.start(1000);

    // P1: alt 700
    recorder.addPoint({ lat: -23.5501, lon: -46.6331, alt: 700, timestamp: 1000, accuracy: 5 });
    // P2: alt 725 (+25m)
    recorder.addPoint({ lat: -23.5502, lon: -46.6332, alt: 725, timestamp: 2000, accuracy: 5 });
    // P3: alt 715 (-10m)
    recorder.addPoint({ lat: -23.5503, lon: -46.6333, alt: 715, timestamp: 3000, accuracy: 5 });
    // P4: alt 740 (+25m)
    recorder.addPoint({ lat: -23.5504, lon: -46.6334, alt: 740, timestamp: 4000, accuracy: 5 });

    const stats = recorder.getStats();
    // Ganho acumulado deve ser 25 + 25 = 50m
    expect(stats.elevationGainMeters).toBeCloseTo(50, 1);
    // Perda acumulada deve ser 10m
    expect(stats.elevationLossMeters).toBeCloseTo(10, 1);
    // Min e Max
    expect(stats.minElevationMeters).toBeCloseTo(700, 1);
    expect(stats.maxElevationMeters).toBeCloseTo(740, 1);

    const profile = recorder.getElevationProfile();
    expect(profile).toHaveLength(4);
    expect(profile[0]?.elevation).toBeCloseTo(700, 1);
    expect(profile[3]?.elevation).toBeCloseTo(740, 1);
  });

  it("trata casos de borda com 0 pontos e 1 ponto para conformidade RFC 7946", () => {
    const recorder = new TrackRecorder({ id: "trk-edge", name: "Trilha Borda" });

    // 0 pontos
    const emptyGeoJSON = recorder.toGeoJSON();
    expect(emptyGeoJSON.geometry.type).toBe("LineString");
    expect(emptyGeoJSON.geometry.coordinates).toHaveLength(0);
    expect(recorder.getStats().avgSpeedKmh).toBe(0);

    // 1 ponto
    recorder.start(1000);
    recorder.addPoint({ lat: -23.55, lon: -46.63, alt: 750, timestamp: 1000, accuracy: 5 });

    const singleGeoJSON = recorder.toGeoJSON();
    expect(singleGeoJSON.geometry.type).toBe("LineString");
    // RFC 7946 exige pelo menos 2 posições: deve duplicar o único ponto
    expect(singleGeoJSON.geometry.coordinates).toHaveLength(2);
    expect(singleGeoJSON.geometry.coordinates[0]).toEqual([-46.63, -23.55, 750]);
    expect(singleGeoJSON.geometry.coordinates[1]).toEqual([-46.63, -23.55, 750]);
    expect(recorder.getStats().distanceMeters).toBe(0);
  });

  it("gera Feature GeoJSON RFC 7946 válida com propriedades ricas", () => {
    const recorder = new TrackRecorder({ id: "trk-complete", name: "Trilha Completa" });
    recorder.start(1000);

    recorder.addPoint({ lat: -23.5501, lon: -46.6331, alt: 750, timestamp: 1000, accuracy: 4 });
    recorder.addPoint({ lat: -23.5505, lon: -46.6335, alt: 755, timestamp: 3000, accuracy: 4 });
    recorder.stop(4000);

    const geojson = recorder.toGeoJSON();
    expect(geojson.type).toBe("Feature");
    expect(geojson.id).toBe("trk-complete");
    expect(geojson.geometry.type).toBe("LineString");
    expect(geojson.geometry.coordinates).toHaveLength(2);

    // Ordem [longitude, latitude, elevation]
    expect(geojson.geometry.coordinates[0]?.[0]).toBeCloseTo(-46.6331, 4);
    expect(geojson.geometry.coordinates[0]?.[1]).toBeCloseTo(-23.5501, 4);

    expect(geojson.properties).toMatchObject({
      id: "trk-complete",
      name: "Trilha Completa",
      status: "stopped",
      pointsCount: 2,
    });
    expect(geojson.properties.distanceMeters).toBeGreaterThan(0);
  });
});
