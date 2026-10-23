import { describe, it, expect } from "vitest";
import { parseSigefParcel, classifySigefVertexType } from "../../src/formats/sigef.js";

describe("SIGEF (INCRA) Parcel Importer & Vertex Auditor", () => {
  it("classifies vertex types correctly", () => {
    expect(classifySigefVertexType("M-0100")).toBe("M");
    expect(classifySigefVertexType("MARCO")).toBe("M");
    expect(classifySigefVertexType("V-0050")).toBe("V");
    expect(classifySigefVertexType("VERTICE")).toBe("V");
    expect(classifySigefVertexType("P-0001")).toBe("P");
    expect(classifySigefVertexType("VIRTUAL")).toBe("P");
  });

  it("audits SIGEF parcel geometry, perimeter, area in Alqueires and vertex compliance", () => {
    const feature = {
      type: "Feature",
      properties: {
        cod_parcela: "BR-350010-001234",
        denominacao: "Fazenda Santa Maria",
        proprietario: "João da Silva",
        area_ha: 242.0, // 10 alqueires paulista
        vertices: [
          { code: "M-0001", type: "M", sigma: 0.05, coord: [-48.0, -16.0] },
          { code: "V-0002", type: "V", sigma: 0.40, coord: [-48.0, -16.1] },
          { code: "P-0003", type: "P", sigma: 2.50, coord: [-48.1, -16.1] },
          { code: "M-0004", type: "M", sigma: 0.20, coord: [-48.1, -16.0] }, // non-compliant for Marco (> 0.1m)
        ],
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-48.0, -16.0],
            [-48.0, -16.1],
            [-48.1, -16.1],
            [-48.1, -16.0],
            [-48.0, -16.0],
          ],
        ],
      },
    };

    const report = parseSigefParcel(feature);
    expect(report.parcelCode).toBe("BR-350010-001234");
    expect(report.denomination).toBe("Fazenda Santa Maria");
    expect(report.areaHa).toBe(242.0);
    expect(report.areaAlqueiresPaulista).toBe(100.0);
    expect(report.perimeterMeters).toBeGreaterThan(0);

    expect(report.complianceSummary.marcoCount).toBe(2);
    expect(report.complianceSummary.verticeCount).toBe(1);
    expect(report.complianceSummary.virtualCount).toBe(1);
    expect(report.complianceSummary.nonCompliantCount).toBe(1);
    expect(report.complianceSummary.isFullyCompliant).toBe(false);
  });
});
