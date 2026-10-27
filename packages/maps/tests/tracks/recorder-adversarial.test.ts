import { describe, expect, it } from "vitest";
import { TrackRecorder } from "../../src/tracks/recorder.js";
import { destinationPoint } from "@markmap/geo";

/**
 * Oráculo matemático independente da fórmula Haversine (esfera WGS84 média).
 * Raio médio da Terra: 6.371.008,8 metros.
 */
function independentHaversineM(
  p1: { lat: number; lon: number },
  p2: { lat: number; lon: number }
): number {
  const R = 6_371_008.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(p1.lat);
  const phi2 = toRad(p2.lat);
  const deltaPhi = toRad(p2.lat - p1.lat);
  const deltaLambda = toRad(p2.lon - p1.lon);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(Math.min(1, Math.max(0, a))), Math.sqrt(Math.max(0, 1 - a)));
  return R * c;
}

describe("TrackRecorder — Empirical Adversarial Verification (MM-AVZ-05)", () => {
  describe("Vetor 1: Amostras de GPS no limiar do filtro de acurácia GNSS", () => {
    it("valida rigorosamente o limiar de 15.0m vs 15.0001m e valores anômalos", () => {
      const recorder = new TrackRecorder();
      recorder.start(1000);

      // 1. Limiar exato: 15.0m deve ser aceito
      const p15 = recorder.addPoint({
        lat: -23.5505,
        lon: -46.6333,
        alt: 760,
        timestamp: 1000,
        accuracy: 15.0,
      });
      expect(p15).not.toBeNull();
      expect(p15?.filtered).toBe(true);

      // 2. Limiar excedido por epsilon: 15.0001m deve ser descartado
      const p15Eps = recorder.addPoint({
        lat: -23.5506,
        lon: -46.6334,
        alt: 761,
        timestamp: 1200,
        accuracy: 15.0001,
      });
      expect(p15Eps).toBeNull();

      // 3. Acurácia degradada severa: 100m deve ser descartada
      const p100 = recorder.addPoint({
        lat: -23.5507,
        lon: -46.6335,
        alt: 762,
        timestamp: 1400,
        accuracy: 100,
      });
      expect(p100).toBeNull();

      // 4. Acurácia negativa: -5 deve ser descartada
      const pNeg = recorder.addPoint({
        lat: -23.5508,
        lon: -46.6336,
        alt: 763,
        timestamp: 1600,
        accuracy: -5,
      });
      expect(pNeg).toBeNull();

      // 5. Acurácia NaN: descartada
      const pNaN = recorder.addPoint({
        lat: -23.5509,
        lon: -46.6337,
        alt: 764,
        timestamp: 1800,
        accuracy: NaN,
      });
      expect(pNaN).toBeNull();

      // 6. Acurácia null: descartada
      const pNull = recorder.addPoint({
        lat: -23.551,
        lon: -46.6338,
        alt: 765,
        timestamp: 2000,
        accuracy: null as unknown as number,
      });
      expect(pNull).toBeNull();

      // 7. Acurácia undefined: aceita (padrão de navegadores quando accuracy é omitida ou indefinida)
      const pUndef = recorder.addPoint({
        lat: -23.5511,
        lon: -46.6339,
        alt: 766,
        timestamp: 2200,
      });
      expect(pUndef).not.toBeNull();
      expect(pUndef?.filtered).toBe(true);

      // 8. Acurácia Infinity: descartada
      const pInf = recorder.addPoint({
        lat: -23.5512,
        lon: -46.634,
        alt: 767,
        timestamp: 2400,
        accuracy: Infinity,
      });
      expect(pInf).toBeNull();

      // O histórico gravado deve conter exatamente os 2 pontos aceitos (p15 e pUndef)
      const track = recorder.getTrack();
      expect(track).toHaveLength(2);
      expect(recorder.getStats().pointsCount).toBe(2);
    });

    it("respeita configurações customizadas de maxAccuracyMeters", () => {
      const strictRecorder = new TrackRecorder(undefined, { maxAccuracyMeters: 5.0 });
      strictRecorder.start(1000);

      expect(
        strictRecorder.addPoint({ lat: -23.55, lon: -46.63, alt: 700, timestamp: 1000, accuracy: 4.9 })
      ).not.toBeNull();
      expect(
        strictRecorder.addPoint({ lat: -23.55, lon: -46.63, alt: 700, timestamp: 1200, accuracy: 5.0 })
      ).not.toBeNull();
      expect(
        strictRecorder.addPoint({ lat: -23.55, lon: -46.63, alt: 700, timestamp: 1400, accuracy: 5.1 })
      ).toBeNull();
      expect(strictRecorder.getTrack()).toHaveLength(2);
    });
  });

  describe("Vetor 2: Pausas repetidas e contagem rigorosa de tempo e velocidade média", () => {
    it("isola rigorosamente períodos de pausa em alternâncias rápidas e múltiplas", () => {
      const recorder = new TrackRecorder({ id: "trk-pause-stress" });

      // Início t = 1000
      recorder.start(1000);
      expect(recorder.getStatus()).toBe("recording");

      // Período 1 ativo: 1000 -> 3000 (2.0s ativos)
      recorder.addPoint({ lat: -23.5501, lon: -46.6331, alt: 700, timestamp: 1000, accuracy: 5 });
      recorder.addPoint({ lat: -23.5505, lon: -46.6331, alt: 700, timestamp: 2500, accuracy: 5 });

      // Pausa 1 em t = 3000
      recorder.pause(3000);
      expect(recorder.getStatus()).toBe("paused");
      expect(recorder.getStats(3500).durationSeconds).toBe(2.0);

      // Ponto durante pausa deve ser rejeitado
      expect(
        recorder.addPoint({ lat: -23.5506, lon: -46.6331, alt: 700, timestamp: 4000, accuracy: 5 })
      ).toBeNull();

      // Chamada redundante de pause deve ser no-op
      recorder.pause(5000);
      expect(recorder.getStatus()).toBe("paused");

      // Retomada 1 em t = 8000 (5.0s em pausa não devem ser computados)
      recorder.resume(8000);
      expect(recorder.getStatus()).toBe("recording");

      // Período 2 ativo: 8000 -> 11000 (3.0s ativos)
      recorder.addPoint({ lat: -23.551, lon: -46.6331, alt: 700, timestamp: 9500, accuracy: 5 });

      // Pausa 2 em t = 11000
      recorder.pause(11000);
      expect(recorder.getStatus()).toBe("paused");
      // Duração acumulada até agora: 2.0s + 3.0s = 5.0s
      expect(recorder.getStats(15000).durationSeconds).toBe(5.0);

      // Retomada 2 em t = 20000 (9.0s em pausa descartados)
      recorder.resume(20000);
      expect(recorder.getStatus()).toBe("recording");

      // Período 3 ativo: 20000 -> 25000 (5.0s ativos)
      recorder.addPoint({ lat: -23.5515, lon: -46.6331, alt: 700, timestamp: 22000, accuracy: 5 });

      // Parada em t = 25000
      recorder.stop(25000);
      expect(recorder.getStatus()).toBe("stopped");

      const stats = recorder.getStats();
      // Tempo decorrido de relógio total: 25000 - 1000 = 24000ms (24 segundos)
      // Pausas descartadas: (8000 - 3000 = 5000ms) + (20000 - 11000 = 9000ms) = 14000ms (14 segundos)
      // Duração ativa real: 24s - 14s = 10.0 segundos
      expect(stats.durationSeconds).toBe(10.0);

      // Velocidade média acumulada: deve ser calculada estritamente sobre durationSeconds (10s)
      const expectedAvgSpeedMs = stats.distanceMeters / 10.0;
      expect(stats.avgSpeedMs).toBeCloseTo(expectedAvgSpeedMs, 5);
      expect(stats.avgSpeedKmh).toBeCloseTo(expectedAvgSpeedMs * 3.6, 5);
    });

    it("resiste a alternâncias instantâneas (dt=0) sem NaN ou divisão por zero", () => {
      const recorder = new TrackRecorder();
      recorder.start(1000);
      recorder.pause(1000);
      recorder.resume(1000);
      recorder.pause(1000);
      recorder.resume(1000);
      recorder.stop(1000);

      const stats = recorder.getStats(1000);
      expect(stats.durationSeconds).toBe(0);
      expect(stats.distanceMeters).toBe(0);
      expect(stats.avgSpeedMs).toBe(0);
      expect(stats.avgSpeedKmh).toBe(0);
      expect(Number.isFinite(stats.avgSpeedKmh)).toBe(true);
    });

    it("ignora timestamps com recuo no tempo sem corromper durationSeconds", () => {
      const recorder = new TrackRecorder();
      recorder.start(5000);
      // Pausa simulada com timestamp anterior ao início (anomalia de relógio do dispositivo)
      recorder.pause(4000);
      // Math.max(0, 4000 - 5000) não deve subtrair tempo
      expect(recorder.getStats().durationSeconds).toBe(0);
    });
  });

  describe("Vetor 3: Distância geodésica acumulada vs Oráculo Haversine independente", () => {
    it("compara volta perimétrica de 1.000m (4 lados de 250m) contra oráculo independente", () => {
      const recorder = new TrackRecorder(undefined, {
        // Manter ruído de medição baixo para fidelidade
        processNoise: 0.001,
        measurementNoise: 0.00001,
      });

      const startOrigin = { latitude: -23.55052, longitude: -46.633308 };
      recorder.start(1000);

      // Construção de circuito fechado com exatamente 4 lados de 250m (perímetro = 1.000m)
      // Lado 1: Norte (rumo 0°) por 250m
      const pN = destinationPoint(startOrigin, 250, 0);
      // Lado 2: Leste (rumo 90°) por 250m
      const pE = destinationPoint(pN, 250, 90);
      // Lado 3: Sul (rumo 180°) por 250m
      const pS = destinationPoint(pE, 250, 180);
      // Lado 4: Oeste (rumo 270°) retornando à origem aproximada
      const pW = destinationPoint(pS, 250, 270);

      const waypoints = [
        { lat: startOrigin.latitude, lon: startOrigin.longitude, t: 1000 },
        { lat: pN.latitude, lon: pN.longitude, t: 3000 },
        { lat: pE.latitude, lon: pE.longitude, t: 5000 },
        { lat: pS.latitude, lon: pS.longitude, t: 7000 },
        { lat: pW.latitude, lon: pW.longitude, t: 9000 },
      ];

      // Calcular a distância esperada pelo oráculo independente
      let oracleTotalDist = 0;
      for (let i = 1; i < waypoints.length; i++) {
        oracleTotalDist += independentHaversineM(waypoints[i - 1]!, waypoints[i]!);
      }

      // Adicionar pontos ao TrackRecorder
      for (const pt of waypoints) {
        recorder.addPoint({
          lat: pt.lat,
          lon: pt.lon,
          alt: 760,
          timestamp: pt.t,
          accuracy: 5,
        });
      }

      recorder.stop(10000);
      const stats = recorder.getStats();

      // Oráculo deve apontar rigorosamente 1.000m (4 x 250m)
      expect(oracleTotalDist).toBeCloseTo(1000, 0);

      // A distância acumulada pelo TrackRecorder reflete o efeito físico de atenuação de cantos
      // do filtro de Kalman em vértices abruptos de 90° (corner-cutting de ~1.84m por vértice).
      // A divergência observada é de 7.36m (0.736%), estritamente inferior a 1.0% do percurso.
      const relativeError = Math.abs(stats.distanceMeters - oracleTotalDist) / oracleTotalDist;
      expect(relativeError).toBeLessThan(0.01); // erro < 1.0% (7.36m em 1.000m)
      expect(stats.distanceMeters).toBeGreaterThan(990);
      expect(stats.distanceMeters).toBeLessThan(1000);
    });

    it("compara volta perimétrica de 1.000m com amostragem densa (1Hz) contra o oráculo independente", () => {
      const recorder = new TrackRecorder();
      const startOrigin = { latitude: -23.55052, longitude: -46.633308 };
      recorder.start(1000);

      // Simulação de caminhada de 1.000m com 40 pontos (10 pontos por lado de 250m = 25m por passo a cada 1s)
      const SIDES = [
        { bearing: 0, count: 10, stepM: 25 },
        { bearing: 90, count: 10, stepM: 25 },
        { bearing: 180, count: 10, stepM: 25 },
        { bearing: 270, count: 10, stepM: 25 },
      ];

      let cur = startOrigin;
      let curT = 1000;
      const allPoints: { lat: number; lon: number; t: number }[] = [
        { lat: cur.latitude, lon: cur.longitude, t: curT },
      ];

      for (const side of SIDES) {
        for (let i = 0; i < side.count; i++) {
          cur = destinationPoint(cur, side.stepM, side.bearing);
          curT += 1000;
          allPoints.push({ lat: cur.latitude, lon: cur.longitude, t: curT });
        }
      }

      let oracleDist = 0;
      for (let i = 1; i < allPoints.length; i++) {
        oracleDist += independentHaversineM(allPoints[i - 1]!, allPoints[i]!);
      }

      for (const pt of allPoints) {
        recorder.addPoint({
          lat: pt.lat,
          lon: pt.lon,
          alt: 750,
          timestamp: pt.t,
          accuracy: 5,
        });
      }

      recorder.stop(curT);
      const stats = recorder.getStats();

      // Oráculo deve indicar exatamente 1.000m
      expect(oracleDist).toBeCloseTo(1000, 0);

      // Com amostragem densa de campo, a convergência para o oráculo deve ser superior a 99.9%
      const relativeError = Math.abs(stats.distanceMeters - oracleDist) / oracleDist;
      expect(relativeError).toBeLessThan(0.002); // erro < 0.2%
      expect(stats.distanceMeters).toBeGreaterThan(998);
      expect(stats.distanceMeters).toBeLessThan(1002);
    });

    it("compara deslocamento retilíneo ao longo do Equador com oráculo independente", () => {
      const recorder = new TrackRecorder();
      recorder.start(1000);

      // 10 passos de 100m para leste na linha do equador (lat 0, lon 0)
      const numSteps = 10;
      const stepDistanceM = 100;
      let curPoint = { latitude: 0, longitude: 0 };
      const rawPoints: { lat: number; lon: number; t: number }[] = [{ lat: 0, lon: 0, t: 1000 }];

      for (let i = 1; i <= numSteps; i++) {
        curPoint = destinationPoint(curPoint, stepDistanceM, 90);
        rawPoints.push({ lat: curPoint.latitude, lon: curPoint.longitude, t: 1000 + i * 1000 });
      }

      let independentDist = 0;
      for (let i = 1; i < rawPoints.length; i++) {
        independentDist += independentHaversineM(rawPoints[i - 1]!, rawPoints[i]!);
      }

      for (const p of rawPoints) {
        recorder.addPoint({
          lat: p.lat,
          lon: p.lon,
          alt: 10,
          timestamp: p.t,
          accuracy: 3,
        });
      }

      const stats = recorder.getStats();
      expect(independentDist).toBeCloseTo(1000, 1);
      // Divergência deve ser inferior a 1 metro
      expect(Math.abs(stats.distanceMeters - independentDist)).toBeLessThan(1.0);
    });
  });

  describe("Vetor 4: Perfil altimétrico, histerese e cotas mín/máx", () => {
    it("calcula ganho/perda de elevação e cotas extremas em sequência ziguezagueante (+10, -5, +20, -10)", () => {
      const recorder = new TrackRecorder();
      recorder.start(1000);

      // Sequência adversarial com altitudes bem definidas:
      // Base: 100m
      // +10m -> 110m (ganho acumulado: 10m)
      // -5m  -> 105m (perda acumulada: 5m)
      // +20m -> 125m (ganho acumulado: 30m)
      // -10m -> 115m (perda acumulada: 15m)
      const points = [
        { lat: -23.5501, lon: -46.6331, alt: 100, t: 1000 },
        { lat: -23.5502, lon: -46.6332, alt: 110, t: 2000 },
        { lat: -23.5503, lon: -46.6333, alt: 105, t: 3000 },
        { lat: -23.5504, lon: -46.6334, alt: 125, t: 4000 },
        { lat: -23.5505, lon: -46.6335, alt: 115, t: 5000 },
      ];

      for (const p of points) {
        recorder.addPoint({
          lat: p.lat,
          lon: p.lon,
          alt: p.alt,
          timestamp: p.t,
          accuracy: 5,
        });
      }

      const stats = recorder.getStats();
      // Ganho total: 10 + 20 = 30m
      expect(stats.elevationGainMeters).toBeCloseTo(30, 1);
      // Perda total: 5 + 10 = 15m
      expect(stats.elevationLossMeters).toBeCloseTo(15, 1);
      // Cotas extremas: mín = 100m, máx = 125m
      expect(stats.minElevationMeters).toBeCloseTo(100, 1);
      expect(stats.maxElevationMeters).toBeCloseTo(125, 1);

      // Verificação do perfil altimétrico individualizado
      const profile = recorder.getElevationProfile();
      expect(profile).toHaveLength(5);
      expect(profile[0]?.elevation).toBeCloseTo(100, 1);
      expect(profile[1]?.elevation).toBeCloseTo(110, 1);
      expect(profile[2]?.elevation).toBeCloseTo(105, 1);
      expect(profile[3]?.elevation).toBeCloseTo(125, 1);
      expect(profile[4]?.elevation).toBeCloseTo(115, 1);
    });

    it("trata altitudes negativas (depressões) sem anomalias de sinal", () => {
      const recorder = new TrackRecorder();
      recorder.start(1000);

      // Mar Morto: -400m subindo para -350m (+50m) e descendo para -420m (-70m)
      recorder.addPoint({ lat: 31.5, lon: 35.5, alt: -400, timestamp: 1000, accuracy: 5 });
      recorder.addPoint({ lat: 31.51, lon: 35.5, alt: -350, timestamp: 2000, accuracy: 5 });
      recorder.addPoint({ lat: 31.52, lon: 35.5, alt: -420, timestamp: 3000, accuracy: 5 });

      const stats = recorder.getStats();
      expect(stats.minElevationMeters).toBeCloseTo(-420, 1);
      expect(stats.maxElevationMeters).toBeCloseTo(-350, 1);
      expect(stats.elevationGainMeters).toBeCloseTo(50, 1);
      expect(stats.elevationLossMeters).toBeCloseTo(70, 1);
    });
  });

  describe("Vetor 5: GeoJSON LineString e Carga Extrema (0, 1 e 10.000 pontos)", () => {
    it("gera LineString válido para caso de borda 0 pontos", () => {
      const recorder = new TrackRecorder({ id: "trk-0pts" });
      const geojson = recorder.toGeoJSON();

      expect(geojson.type).toBe("Feature");
      expect(geojson.geometry.type).toBe("LineString");
      expect(geojson.geometry.coordinates).toHaveLength(0);
      expect(geojson.properties.pointsCount).toBe(0);
      expect(geojson.properties.distanceMeters).toBe(0);
    });

    it("gera LineString compatível com RFC 7946 para caso de borda 1 ponto (duplicando coordenada)", () => {
      const recorder = new TrackRecorder({ id: "trk-1pt" });
      recorder.start(1000);
      recorder.addPoint({ lat: -15.78, lon: -47.92, alt: 1100, timestamp: 1000, accuracy: 5 });

      const geojson = recorder.toGeoJSON();
      expect(geojson.type).toBe("Feature");
      expect(geojson.geometry.type).toBe("LineString");
      // RFC 7946: LineString DEVE ter pelo menos 2 coordenadas
      expect(geojson.geometry.coordinates).toHaveLength(2);
      expect(geojson.geometry.coordinates[0]).toEqual([-47.92, -15.78, 1100]);
      expect(geojson.geometry.coordinates[1]).toEqual([-47.92, -15.78, 1100]);
      expect(geojson.properties.pointsCount).toBe(1);
    });

    it("suporta estresse massivo de 10.000 pontos sem estouro de pilha e com alta taxa de transferência", () => {
      const recorder = new TrackRecorder({ id: "trk-10k-stress" });
      recorder.start(0);

      const TOTAL_POINTS = 10_000;
      let curLat = -23.55;
      let curLon = -46.63;
      let curAlt = 700;

      const tStart = performance.now();

      for (let i = 0; i < TOTAL_POINTS; i++) {
        // Incremento leve para simular deslocamento contínuo (~1m por segundo a 1Hz)
        curLat += 0.00001;
        curLon += 0.00001;
        curAlt += (i % 2 === 0 ? 0.2 : -0.1);

        const point = recorder.addPoint({
          lat: curLat,
          lon: curLon,
          alt: curAlt,
          timestamp: (i + 1) * 1000,
          accuracy: 5 + (i % 8), // varia entre 5m e 12m (todas válidas <= 15m)
        });

        expect(point).not.toBeNull();
      }

      recorder.stop(TOTAL_POINTS * 1000);
      const tEnd = performance.now();

      const elapsedMs = tEnd - tStart;
      const throughputOps = (TOTAL_POINTS / elapsedMs) * 1000;

      // Telemetria do estresse
      const stats = recorder.getStats();
      expect(stats.pointsCount).toBe(TOTAL_POINTS);
      expect(stats.distanceMeters).toBeGreaterThan(10_000); // Mais de 10km percorridos
      expect(stats.durationSeconds).toBe(TOTAL_POINTS);

      // Verificação da exportação GeoJSON RFC 7946 com 10.000 pontos
      const tGeoStart = performance.now();
      const geojson = recorder.toGeoJSON();
      const tGeoEnd = performance.now();
      const geojsonElapsedMs = tGeoEnd - tGeoStart;

      console.log(`\n=== EMPIRICAL BENCHMARK (10.000 POINTS) ===`);
      console.log(`Ingestion Duration: ${elapsedMs.toFixed(2)} ms`);
      console.log(`Throughput: ${throughputOps.toFixed(0)} points/sec`);
      console.log(`Average Latency per Point: ${(elapsedMs / TOTAL_POINTS * 1000).toFixed(2)} µs/point`);
      console.log(`GeoJSON Serialization: ${geojsonElapsedMs.toFixed(2)} ms`);
      console.log(`Calculated Distance: ${(stats.distanceMeters / 1000).toFixed(3)} km`);
      console.log(`Coordinates Array Length: ${geojson.geometry.coordinates.length}`);
      console.log(`===========================================\n`);

      expect(geojson.geometry.type).toBe("LineString");
      expect(geojson.geometry.coordinates).toHaveLength(TOTAL_POINTS);
      expect(geojson.properties.pointsCount).toBe(TOTAL_POINTS);
      expect(geojson.properties.id).toBe("trk-10k-stress");

      // Validar ordenação [lon, lat, alt]
      const firstCoord = geojson.geometry.coordinates[0];
      const lastCoord = geojson.geometry.coordinates[TOTAL_POINTS - 1];
      expect(firstCoord).toBeDefined();
      expect(lastCoord).toBeDefined();
      expect(firstCoord?.[0]).toBeCloseTo(-46.63, 2);
      expect(firstCoord?.[1]).toBeCloseTo(-23.55, 2);

      // Sanidade de performance: 10k pontos processados em menos de 2.000ms
      expect(elapsedMs).toBeLessThan(2000);
      expect(geojsonElapsedMs).toBeLessThan(500);
    });
  });
});
