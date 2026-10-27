import { describe, expect, it } from "vitest";
import { exportToGpx, exportToKml } from "../../src/formats/export.js";

/**
 * Validador léxico e estrutural de XML independente.
 * Verifica balanceamento de tags, ausência de caracteres ilegais e integridade de entidades.
 */
function validateXmlStructure(xml: string): { tags: string[]; root: string } {
  const tagRegex = /<(\/)?([a-zA-Z0-9_:-]+)([^>]*?)(\/)?>/g;
  const stack: string[] = [];
  const tags: string[] = [];
  let match: RegExpExecArray | null;

  // 1. Verificar declaração XML
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);

  // 2. Descartar declaração XML antes de validar pilha de nós
  const xmlBody = xml.replace(/<\?xml[^?]*\?>/g, "");

  while ((match = tagRegex.exec(xmlBody)) !== null) {
    const isClosing = match[1] === "/";
    const tagName = match[2]!;
    const isSelfClosing = match[4] === "/";

    tags.push((isClosing ? "/" : "") + tagName);

    if (isSelfClosing) {
      continue;
    }

    if (isClosing) {
      if (stack.length === 0) {
        throw new Error(`Tag de fechamento inesperada </${tagName}> sem tag de abertura correspondente`);
      }
      const last = stack.pop();
      if (last !== tagName) {
        throw new Error(`Desbalanceamento de tags XML: esperava </${last}>, encontrou </${tagName}>`);
      }
    } else {
      stack.push(tagName);
    }
  }

  if (stack.length > 0) {
    throw new Error(`Tags XML não fechadas ao término do documento: ${stack.join(", ")}`);
  }

  // 3. Garantir que não há '&' desescapados soltos no XML
  const nakedAmpersand = /&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/;
  if (nakedAmpersand.test(xml)) {
    throw new Error("XML contém caractere '&' não sanitizado (naked ampersand)");
  }

  return { tags, root: tags[0] || "" };
}

describe("Vector Export Engine — Empirical Adversarial Stress & Schema Compliance", () => {
  // --------------------------------------------------------------------------
  // Vetor 1: Injeção de Caracteres Perigosos e Quebra de Tags
  // --------------------------------------------------------------------------
  describe("Vetor 1: Injeção de Caracteres Perigosos e Tags Falsas (Sanitização)", () => {
    it("sanitiza completamente injeção de XSS e quebra de tags XML em GPX", () => {
      const maliciousPayload = '<script>alert("xss")</script>&<evil attr="val">\'test\'</trk></gpx>]]>';

      const features: GeoJSON.Feature[] = [
        {
          type: "Feature",
          properties: {
            name: maliciousPayload,
            description: maliciousPayload,
            time: '2026-10-27T12:00:00Z" hack="true"',
          },
          geometry: {
            type: "Point",
            coordinates: [-48.2, -7.1, 250],
          },
        },
      ];

      const gpx = exportToGpx(features, {
        name: 'Projeto <Injetado> & "Asm"',
        creator: 'Creator <Danger> & "Test"',
      });

      // Validação de XML bem-formado sem quebra de tags
      validateXmlStructure(gpx);

      // Nenhuma tag perigosa deve existir de forma desescapada
      expect(gpx).not.toContain("<script>");
      expect(gpx).not.toContain("</script>");
      expect(gpx).not.toContain("<evil");
      expect(gpx).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
      expect(gpx).toContain("&amp;&lt;evil attr=&quot;val&quot;&gt;&apos;test&apos;&lt;/trk&gt;&lt;/gpx&gt;]]&gt;");
    });

    it("sanitiza completamente injeção de XSS e quebra de tags XML em KML", () => {
      const maliciousPayload = '"><script>document.cookie</script><kml><Placemark>';

      const features: GeoJSON.Feature[] = [
        {
          type: "Feature",
          properties: {
            name: maliciousPayload,
            desc: 'Desc & <danger> "quotes"',
          },
          geometry: {
            type: "LineString",
            coordinates: [
              [-48.2, -7.1],
              [-48.21, -7.11],
            ],
          },
        },
      ];

      const kml = exportToKml(features, {
        name: 'Doc "KML" & <Special>',
        description: 'Doc </description><script>',
      });

      validateXmlStructure(kml);

      expect(kml).not.toContain("<script>");
      expect(kml).toContain("&quot;&gt;&lt;script&gt;document.cookie&lt;/script&gt;&lt;kml&gt;&lt;Placemark&gt;");
      expect(kml).toContain("Doc &lt;/description&gt;&lt;script&gt;");
    });
  });

  // --------------------------------------------------------------------------
  // Vetor 2: Polígonos Complexos com Múltiplos Buracos/Ilhas
  // --------------------------------------------------------------------------
  describe("Vetor 2: Polígonos Complexos com Múltiplos Anéis Interiores (Ilhas)", () => {
    it("serializa polígono com anel exterior e 3 anéis interiores em GPX e KML", () => {
      const complexPolygon: GeoJSON.Feature = {
        type: "Feature",
        properties: {
          name: "Fazenda Rio Grande - Talhão 10 com 3 Lagoas",
          description: "Área com 3 depressões/buracos interiores",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            // Anel Exterior
            [
              [-48.5, -7.2, 260],
              [-48.4, -7.2, 260],
              [-48.4, -7.3, 255],
              [-48.5, -7.3, 255],
              [-48.5, -7.2, 260],
            ],
            // Buraco 1
            [
              [-48.48, -7.22, 240],
              [-48.46, -7.22, 240],
              [-48.46, -7.24, 239],
              [-48.48, -7.24, 239],
              [-48.48, -7.22, 240],
            ],
            // Buraco 2
            [
              [-48.45, -7.25, 241],
              [-48.43, -7.25, 241],
              [-48.43, -7.27, 240],
              [-48.45, -7.27, 240],
              [-48.45, -7.25, 241],
            ],
            // Buraco 3
            [
              [-48.42, -7.22, 255],
              [-48.41, -7.22, 255],
              [-48.41, -7.23, 254],
              [-48.42, -7.23, 254],
              [-48.42, -7.22, 255],
            ],
          ],
        },
      };

      // GPX: 1 anel exterior + 3 anéis interiores = 4 <trkseg>
      const gpx = exportToGpx([complexPolygon]);
      validateXmlStructure(gpx);
      const trksegMatches = gpx.match(/<trkseg>/g) || [];
      expect(trksegMatches).toHaveLength(4);
      expect(gpx).toContain("<ele>260</ele>");
      expect(gpx).toContain("<ele>239</ele>");

      // KML: 1 <outerBoundaryIs> + 3 <innerBoundaryIs>
      const kml = exportToKml([complexPolygon]);
      validateXmlStructure(kml);
      const outerMatches = kml.match(/<outerBoundaryIs>/g) || [];
      const innerMatches = kml.match(/<innerBoundaryIs>/g) || [];
      expect(outerMatches).toHaveLength(1);
      expect(innerMatches).toHaveLength(3);
      expect(kml).toContain("-48.5,-7.2,260");
      expect(kml).toContain("-48.48,-7.22,240");
    });
  });

  // --------------------------------------------------------------------------
  // Vetor 3: Coordenadas Limítrofes, Depressões e Anomalias
  // --------------------------------------------------------------------------
  describe("Vetor 3: Coordenadas Limítrofes, Altitudes Negativas e Rejeição de Anomalias", () => {
    it("aceita coordenadas nos limites exatos do elipsoide WGS 84 (±90, ±180)", () => {
      const boundaryFeatures: GeoJSON.Feature[] = [
        { type: "Feature", properties: { name: "Pólo Norte" }, geometry: { type: "Point", coordinates: [0, 90] } },
        { type: "Feature", properties: { name: "Pólo Sul" }, geometry: { type: "Point", coordinates: [0, -90] } },
        { type: "Feature", properties: { name: "Antimeridiano E" }, geometry: { type: "Point", coordinates: [180, 0] } },
        { type: "Feature", properties: { name: "Antimeridiano W" }, geometry: { type: "Point", coordinates: [-180, 0] } },
      ];

      const gpx = exportToGpx(boundaryFeatures);
      const kml = exportToKml(boundaryFeatures);

      validateXmlStructure(gpx);
      validateXmlStructure(kml);

      expect(gpx).toContain('lat="90" lon="0"');
      expect(gpx).toContain('lat="-90" lon="0"');
      expect(gpx).toContain('lat="0" lon="180"');
      expect(gpx).toContain('lat="0" lon="-180"');
    });

    it("preserva altitudes extremas positivas e depressões negativas", () => {
      const altFeatures: GeoJSON.Feature[] = [
        { type: "Feature", properties: { name: "Mar Morto" }, geometry: { type: "Point", coordinates: [35.5, 31.5, -430.5] } },
        { type: "Feature", properties: { name: "Everest" }, geometry: { type: "Point", coordinates: [86.9, 27.9, 8848.86] } },
      ];

      const gpx = exportToGpx(altFeatures);
      const kml = exportToKml(altFeatures);

      expect(gpx).toContain("<ele>-430.5</ele>");
      expect(gpx).toContain("<ele>8848.86</ele>");
      expect(kml).toContain("35.5,31.5,-430.5");
      expect(kml).toContain("86.9,27.9,8848.86");
    });

    it("rejeita com RangeError coordenadas fora dos limites WGS 84 e NaN / Infinity", () => {
      const invalidRanges = [
        [180.0001, 0],
        [-180.0001, 0],
        [0, 90.0001],
        [0, -90.0001],
        [NaN, 0],
        [0, NaN],
        [Infinity, 0],
        [0, -Infinity],
        [0, 0, NaN],
        [0, 0, Infinity],
      ];

      for (const coords of invalidRanges) {
        const feat: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: coords } };
        expect(() => exportToGpx([feat])).toThrow(RangeError);
        expect(() => exportToKml([feat])).toThrow(RangeError);
      }
    });

    it("rejeita com TypeError tipos não numéricos, arrays vazios e polígonos abertos", () => {
      const typeErrors = [
        ["-48.2", -7.1],
        [-48.2, "-7.1"],
        [-48.2, -7.1, "100"],
        [],
        [-48.2],
        [-48.2, -7.1, 100, 50],
      ];

      for (const coords of typeErrors) {
        const feat = { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: coords } } as unknown as GeoJSON.Feature;
        expect(() => exportToGpx([feat])).toThrow(TypeError);
        expect(() => exportToKml([feat])).toThrow(TypeError);
      }

      // Polígono não fechado
      const openPolygon = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [[[-48, -7], [-48.1, -7], [-48.1, -7.1], [-48, -7.1]]],
        },
      } as unknown as GeoJSON.Feature;
      expect(() => exportToGpx([openPolygon])).toThrow(TypeError);
    });
  });

  // --------------------------------------------------------------------------
  // Vetor 4: Carga Massiva (5.000 Feições Mistas)
  // --------------------------------------------------------------------------
  describe("Vetor 4: Carga Massiva (5.000 Feições Mistas — Pontos, Linhas e Polígonos)", () => {
    it("serializa 5.000 feições sem estouro de memória e em tempo inferior a 1.000 ms", () => {
      const features: GeoJSON.Feature[] = [];

      // 2000 Pontos
      for (let i = 0; i < 2000; i++) {
        features.push({
          type: "Feature",
          properties: { name: `Ponto ${i}` },
          geometry: { type: "Point", coordinates: [-48 - (i % 100) * 0.01, -7 - (i % 50) * 0.01, 200 + (i % 50)] },
        });
      }

      // 1500 Linhas (5 vértices cada)
      for (let i = 0; i < 1500; i++) {
        const coords: [number, number][] = [];
        for (let j = 0; j < 5; j++) coords.push([-49 - (i % 50) * 0.01 + j * 0.001, -8 - (i % 50) * 0.01 + j * 0.001]);
        features.push({
          type: "Feature",
          properties: { name: `Linha ${i}` },
          geometry: { type: "LineString", coordinates: coords },
        });
      }

      // 500 MultiLinhas
      for (let i = 0; i < 500; i++) {
        const l1: [number, number][] = [[-50, -9], [-50.01, -9.01]];
        const l2: [number, number][] = [[-50.02, -9.02], [-50.03, -9.03]];
        features.push({
          type: "Feature",
          properties: { name: `MultiLinha ${i}` },
          geometry: { type: "MultiLineString", coordinates: [l1, l2] },
        });
      }

      // 1000 Polígonos
      for (let i = 0; i < 1000; i++) {
        const ring: [number, number][] = [
          [-51, -10],
          [-51.01, -10],
          [-51.01, -10.01],
          [-51, -10.01],
          [-51, -10],
        ];
        features.push({
          type: "Feature",
          properties: { name: `Polígono ${i}` },
          geometry: { type: "Polygon", coordinates: [ring] },
        });
      }

      expect(features).toHaveLength(5000);

      // Desempenho GPX
      const t0Gpx = performance.now();
      const gpx = exportToGpx(features, { name: "Carga 5000 GPX" });
      const durGpx = performance.now() - t0Gpx;

      expect(durGpx).toBeLessThan(1000);
      expect(gpx).toContain("</gpx>");

      // Desempenho KML
      const t0Kml = performance.now();
      const kml = exportToKml(features, { name: "Carga 5000 KML" });
      const durKml = performance.now() - t0Kml;

      expect(durKml).toBeLessThan(1000);
      expect(kml).toContain("</kml>");
    });
  });

  // --------------------------------------------------------------------------
  // Vetor 5: Conformidade de Esquema Formal TopoGrafix GPX 1.1
  // --------------------------------------------------------------------------
  describe("Vetor 5: Conformidade com o Esquema GPX 1.1 (TopoGrafix XSD)", () => {
    it("deve obedecer à sequência obrigatória de <wpt> e não conter tags proibidas em <trk>", () => {
      const featPoint: GeoJSON.Feature = {
        type: "Feature",
        properties: {
          name: "Vértice 01",
          description: "Marco de fronteira",
          time: "2026-10-27T12:00:00Z",
        },
        geometry: { type: "Point", coordinates: [-48.2, -7.1, 150] },
      };

      const featTrack: GeoJSON.Feature = {
        type: "Feature",
        properties: {
          name: "Trilha 01",
          description: "Trajeto de fiscalização",
          time: "2026-10-27T12:30:00Z",
        },
        geometry: { type: "LineString", coordinates: [[-48.2, -7.1], [-48.21, -7.11]] },
      };

      const gpx = exportToGpx([featPoint, featTrack]);

      // 1. No tipo wptType do GPX 1.1, a sequência estrita é: ele -> time -> magvar -> geoidheight -> name -> cmt -> desc
      // Portanto, <time> deve obrigatoriamente preceder <name> e <desc>.
      const wptBlock = gpx.slice(gpx.indexOf("<wpt"), gpx.indexOf("</wpt>"));
      const timePosInWpt = wptBlock.indexOf("<time>");
      const namePosInWpt = wptBlock.indexOf("<name>");
      const descPosInWpt = wptBlock.indexOf("<desc>");

      expect(timePosInWpt).toBeGreaterThan(0);
      expect(namePosInWpt).toBeGreaterThan(0);
      // Se time estiver depois de name, viola gpx.xsd!
      expect(timePosInWpt).toBeLessThan(namePosInWpt);
      expect(namePosInWpt).toBeLessThan(descPosInWpt);

      // 2. No tipo trkType do GPX 1.1, NÃO EXISTE a tag <time> diretamente sob <trk>!
      // trkType aceita apenas: name, cmt, desc, src, link, number, type, extensions, trkseg.
      const trkBlock = gpx.slice(gpx.indexOf("<trk>"), gpx.indexOf("<trkseg>"));
      expect(trkBlock).not.toContain("<time>");
    });
  });
});
