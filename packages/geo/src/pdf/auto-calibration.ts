import proj4 from "proj4";

import { createGeoReference } from "./transform.js";
import type { GeoReference, PagePoint } from "./types.js";

export type PdfTextSample = {
  text: string;
  page: PagePoint;
};

export type AutoCalibrationMethod = "geographic-grid" | "utm-grid";

export type AutoCalibrationDiagnostics = {
  xLabels: number;
  yLabels: number;
  r2X: number | null;
  r2Y: number | null;
  maxNormalizedResidual: number | null;
  pageSpanRatio: number | null;
};

export type AutoCalibrationResult = {
  reference: GeoReference | null;
  method: AutoCalibrationMethod | null;
  confidence: number;
  reason: string;
  diagnostics: AutoCalibrationDiagnostics;
};

type AxisLabel = {
  page: number;
  ground: number;
};

type AxisFit = {
  labels: AxisLabel[];
  slope: number;
  intercept: number;
  r2: number;
  maxNormalizedResidual: number;
  pageSpan: number;
  groundSpan: number;
};

type PageGeometry = {
  pageIndex: number;
  cropBox: GeoReference["cropBox"];
  rotation: GeoReference["rotation"];
};

const EMPTY_DIAGNOSTICS: AutoCalibrationDiagnostics = {
  xLabels: 0,
  yLabels: 0,
  r2X: null,
  r2Y: null,
  maxNormalizedResidual: null,
  pageSpanRatio: null,
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const parseHemisphereCoordinate = (
  text: string,
): { axis: "x" | "y"; value: number } | null => {
  const normalized = text
    .trim()
    .toUpperCase()
    .replace(/,/g, ".")
    .replace(/º/g, "°")
    .replace(/’/g, "′")
    .replace(/"/g, "″");
  const match =
    /(?:^|\s)(\d{1,3}(?:\.\d+)?)\s*°?\s*(?:(\d{1,2}(?:\.\d+)?)\s*[\'′]?)?\s*(?:(\d{1,2}(?:\.\d+)?)\s*[″]?)?\s*([NSEW])(?:\s|$)/i.exec(
      normalized,
    );
  if (!match) return null;
  const degrees = Number(match[1]);
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);
  const hemisphere = match[4]!.toUpperCase();
  if (
    !Number.isFinite(degrees) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    minutes >= 60 ||
    seconds >= 60
  )
    return null;
  const axis = hemisphere === "E" || hemisphere === "W" ? "x" : "y";
  const maximum = axis === "x" ? 180 : 90;
  if (degrees > maximum) return null;
  const sign = hemisphere === "W" || hemisphere === "S" ? -1 : 1;
  return {
    axis,
    value: sign * (degrees + minutes / 60 + seconds / 3600),
  };
};

const parseMetricLabel = (text: string): number | null => {
  let normalized = text
    .trim()
    .toUpperCase()
    .replace(/\u00A0/g, " ")
    .replace(/\s*M?\s*[EN]\s*$/, "")
    .trim();
  if (/^\d{1,3}(?:[.\s]\d{3}){1,2}$/.test(normalized))
    normalized = normalized.replace(/[.\s]/g, "");
  else if (!/^\d{5,8}$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
};

const detectUtmZone = (
  samples: readonly PdfTextSample[],
): { zone: number; hemisphere: "S" } | null => {
  const text = samples.map((sample) => sample.text).join(" ");
  const match =
    /\b(?:SIRGAS\s*2000[\s/:-]*)?(?:UTM|FUSO|ZONE|ZONA)\s*(?:(?:FUSO|ZONE|ZONA)\s*)?(\d{1,2})\s*([NS])\b/i.exec(
      text,
    );
  if (!match || match[2]?.toUpperCase() !== "S") return null;
  const zone = Number(match[1]);
  return Number.isInteger(zone) && zone >= 18 && zone <= 25
    ? { zone, hemisphere: "S" }
    : null;
};

const nearHorizontalEdge = (
  point: PagePoint,
  cropBox: GeoReference["cropBox"],
): boolean => {
  const height = cropBox[3] - cropBox[1];
  const margin = height * 0.22;
  return point[1] <= cropBox[1] + margin || point[1] >= cropBox[3] - margin;
};

const nearVerticalEdge = (
  point: PagePoint,
  cropBox: GeoReference["cropBox"],
): boolean => {
  const width = cropBox[2] - cropBox[0];
  const margin = width * 0.22;
  return point[0] <= cropBox[0] + margin || point[0] >= cropBox[2] - margin;
};

const deduplicateLabels = (
  labels: readonly AxisLabel[],
  epsilon: number,
): AxisLabel[] => {
  const sorted = [...labels].sort((first, second) => first.ground - second.ground);
  const groups: AxisLabel[][] = [];
  for (const label of sorted) {
    const group = groups.at(-1);
    if (
      group &&
      Math.abs(group[0]!.ground - label.ground) <= epsilon
    )
      group.push(label);
    else groups.push([label]);
  }
  return groups.map((group) => ({
    ground:
      group.reduce((sum, label) => sum + label.ground, 0) / group.length,
    page: group.reduce((sum, label) => sum + label.page, 0) / group.length,
  }));
};

const fitAxis = (labels: readonly AxisLabel[]): AxisFit | null => {
  if (labels.length < 3) return null;
  const meanPage =
    labels.reduce((sum, label) => sum + label.page, 0) / labels.length;
  const meanGround =
    labels.reduce((sum, label) => sum + label.ground, 0) / labels.length;
  let pageVariance = 0;
  let covariance = 0;
  let groundVariance = 0;
  for (const label of labels) {
    const page = label.page - meanPage;
    const ground = label.ground - meanGround;
    pageVariance += page * page;
    covariance += page * ground;
    groundVariance += ground * ground;
  }
  if (
    pageVariance <= 1e-12 ||
    groundVariance <= 1e-18 ||
    !Number.isFinite(pageVariance) ||
    !Number.isFinite(groundVariance)
  )
    return null;
  const slope = covariance / pageVariance;
  const intercept = meanGround - slope * meanPage;
  const residuals = labels.map(
    (label) => label.ground - (slope * label.page + intercept),
  );
  const residualSquareSum = residuals.reduce(
    (sum, residual) => sum + residual * residual,
    0,
  );
  const r2 = 1 - residualSquareSum / groundVariance;
  const pageValues = labels.map((label) => label.page);
  const groundValues = labels.map((label) => label.ground);
  const pageSpan = Math.max(...pageValues) - Math.min(...pageValues);
  const groundSpan = Math.max(...groundValues) - Math.min(...groundValues);
  if (pageSpan <= 0 || groundSpan <= 0 || !Number.isFinite(slope)) return null;
  return {
    labels: [...labels],
    slope,
    intercept,
    r2,
    maxNormalizedResidual:
      Math.max(...residuals.map((value) => Math.abs(value))) / groundSpan,
    pageSpan,
    groundSpan,
  };
};

const diagnosticsFor = (
  x: AxisFit | null,
  y: AxisFit | null,
  geometry: PageGeometry,
): AutoCalibrationDiagnostics => {
  const width = geometry.cropBox[2] - geometry.cropBox[0];
  const height = geometry.cropBox[3] - geometry.cropBox[1];
  return {
    xLabels: x?.labels.length ?? 0,
    yLabels: y?.labels.length ?? 0,
    r2X: x?.r2 ?? null,
    r2Y: y?.r2 ?? null,
    maxNormalizedResidual:
      x && y
        ? Math.max(x.maxNormalizedResidual, y.maxNormalizedResidual)
        : null,
    pageSpanRatio:
      x && y
        ? Math.min(x.pageSpan / width, y.pageSpan / height)
        : null,
  };
};

const confidenceFor = (
  x: AxisFit,
  y: AxisFit,
  geometry: PageGeometry,
): number => {
  const diagnostics = diagnosticsFor(x, y, geometry);
  const countScore = Math.min(1, Math.min(x.labels.length, y.labels.length) / 4);
  const fitScore = clamp01(Math.min(x.r2, y.r2));
  const residualScore =
    1 - clamp01((diagnostics.maxNormalizedResidual ?? 1) / 0.02);
  const spreadScore = clamp01((diagnostics.pageSpanRatio ?? 0) / 0.6);
  return clamp01(
    0.35 * fitScore +
      0.25 * residualScore +
      0.2 * spreadScore +
      0.2 * countScore,
  );
};

const acceptable = (
  x: AxisFit,
  y: AxisFit,
  geometry: PageGeometry,
): { accepted: boolean; confidence: number } => {
  const diagnostics = diagnosticsFor(x, y, geometry);
  const confidence = confidenceFor(x, y, geometry);
  return {
    confidence,
    accepted:
      Math.min(x.r2, y.r2) >= 0.995 &&
      (diagnostics.maxNormalizedResidual ?? 1) <= 0.015 &&
      (diagnostics.pageSpanRatio ?? 0) >= 0.35 &&
      confidence >= 0.88,
  };
};

const neatlineFor = (
  cropBox: GeoReference["cropBox"],
): PagePoint[] => [
  [cropBox[0], cropBox[1]],
  [cropBox[2], cropBox[1]],
  [cropBox[2], cropBox[3]],
  [cropBox[0], cropBox[3]],
];

const buildGeographic = (
  samples: readonly PdfTextSample[],
  geometry: PageGeometry,
): AutoCalibrationResult | null => {
  const longitude = deduplicateLabels(
    samples.flatMap((sample) => {
      const parsed = parseHemisphereCoordinate(sample.text);
      return parsed?.axis === "x" &&
        nearHorizontalEdge(sample.page, geometry.cropBox)
        ? [{ page: sample.page[0], ground: parsed.value }]
        : [];
    }),
    1e-7,
  );
  const latitude = deduplicateLabels(
    samples.flatMap((sample) => {
      const parsed = parseHemisphereCoordinate(sample.text);
      return parsed?.axis === "y" &&
        nearVerticalEdge(sample.page, geometry.cropBox)
        ? [{ page: sample.page[1], ground: parsed.value }]
        : [];
    }),
    1e-7,
  );
  if (longitude.length === 0 && latitude.length === 0) return null;

  const x = fitAxis(longitude);
  const y = fitAxis(latitude);
  const diagnostics = diagnosticsFor(x, y, geometry);
  if (!x || !y)
    return {
      reference: null,
      method: "geographic-grid",
      confidence: 0,
      reason:
        "A grade geográfica não possui ao menos três rótulos independentes em cada eixo.",
      diagnostics,
    };

  const quality = acceptable(x, y, geometry);
  if (!quality.accepted)
    return {
      reference: null,
      method: "geographic-grid",
      confidence: quality.confidence,
      reason:
        "A grade geográfica foi detectada, mas alinhamento, dispersão ou cobertura não atingiram o limiar automático.",
      diagnostics,
    };

  try {
    const controls = x.labels.flatMap((longitudeLabel) =>
      y.labels.map((latitudeLabel) => ({
        page: [longitudeLabel.page, latitudeLabel.page] as PagePoint,
        ground: [longitudeLabel.ground, latitudeLabel.ground] as PagePoint,
      })),
    );
    const reference = createGeoReference({
      profile: "manual",
      sourceCrs: "EPSG:4326",
      pageIndex: geometry.pageIndex,
      cropBox: geometry.cropBox,
      rotation: geometry.rotation,
      controls,
      neatline: neatlineFor(geometry.cropBox),
      maxIndependentErrorMeters: 25,
    });
    return {
      reference,
      method: "geographic-grid",
      confidence: quality.confidence,
      reason: "Grade geográfica reconhecida e validada automaticamente.",
      diagnostics,
    };
  } catch {
    return {
      reference: null,
      method: "geographic-grid",
      confidence: quality.confidence,
      reason:
        "A grade geográfica foi detectada, mas o ajuste affine não passou pela validação espacial.",
      diagnostics,
    };
  }
};

const buildUtm = (
  samples: readonly PdfTextSample[],
  geometry: PageGeometry,
): AutoCalibrationResult | null => {
  const zone = detectUtmZone(samples);
  if (!zone) return null;
  const eastings = deduplicateLabels(
    samples.flatMap((sample) => {
      const value = parseMetricLabel(sample.text);
      return value !== null &&
        value >= 100_000 &&
        value <= 900_000 &&
        nearHorizontalEdge(sample.page, geometry.cropBox)
        ? [{ page: sample.page[0], ground: value }]
        : [];
    }),
    0.1,
  );
  const northings = deduplicateLabels(
    samples.flatMap((sample) => {
      const value = parseMetricLabel(sample.text);
      return value !== null &&
        value >= 1_000_000 &&
        value <= 10_000_000 &&
        nearVerticalEdge(sample.page, geometry.cropBox)
        ? [{ page: sample.page[1], ground: value }]
        : [];
    }),
    0.1,
  );
  const x = fitAxis(eastings);
  const y = fitAxis(northings);
  const diagnostics = diagnosticsFor(x, y, geometry);
  if (!x || !y)
    return {
      reference: null,
      method: "utm-grid",
      confidence: 0,
      reason:
        "A referência UTM foi encontrada, mas a grade não possui três rótulos independentes por eixo.",
      diagnostics,
    };

  if (x.groundSpan < 10 || y.groundSpan < 10)
    return {
      reference: null,
      method: "utm-grid",
      confidence: 0,
      reason: "A grade UTM não cobre distância suficiente para calibração.",
      diagnostics,
    };

  const quality = acceptable(x, y, geometry);
  if (!quality.accepted)
    return {
      reference: null,
      method: "utm-grid",
      confidence: quality.confidence,
      reason:
        "A grade UTM foi detectada, mas alinhamento, dispersão ou cobertura não atingiram o limiar automático.",
      diagnostics,
    };

  const projection = `+proj=utm +zone=${zone.zone} +south +ellps=GRS80 +units=m +no_defs`;
  try {
    const controls = x.labels.flatMap((easting) =>
      y.labels.map((northing) => {
        const converted = proj4(projection, "EPSG:4326", [
          easting.ground,
          northing.ground,
        ]);
        const longitude = Number(converted[0]);
        const latitude = Number(converted[1]);
        if (
          !Number.isFinite(longitude) ||
          !Number.isFinite(latitude) ||
          longitude < -75 ||
          longitude > -30 ||
          latitude < -35 ||
          latitude > 6
        )
          throw new Error("UTM grid resolves outside Brazil");
        return {
          page: [easting.page, northing.page] as PagePoint,
          ground: [longitude, latitude] as PagePoint,
        };
      }),
    );
    const reference = createGeoReference({
      profile: "manual",
      sourceCrs: "EPSG:4326",
      pageIndex: geometry.pageIndex,
      cropBox: geometry.cropBox,
      rotation: geometry.rotation,
      controls,
      neatline: neatlineFor(geometry.cropBox),
      maxIndependentErrorMeters: 25,
    });
    return {
      reference,
      method: "utm-grid",
      confidence: quality.confidence,
      reason: `Grade UTM ${zone.zone}S reconhecida e validada automaticamente.`,
      diagnostics,
    };
  } catch {
    return {
      reference: null,
      method: "utm-grid",
      confidence: quality.confidence,
      reason:
        "A grade UTM foi detectada, mas a transformação espacial não passou pela validação.",
      diagnostics,
    };
  }
};

export const autoCalibrateFromText = (
  samples: readonly PdfTextSample[],
  geometry: PageGeometry,
): AutoCalibrationResult => {
  const width = geometry.cropBox[2] - geometry.cropBox[0];
  const height = geometry.cropBox[3] - geometry.cropBox[1];
  if (
    samples.length === 0 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return {
      reference: null,
      method: null,
      confidence: 0,
      reason: "O PDF não fornece texto de grade utilizável.",
      diagnostics: EMPTY_DIAGNOSTICS,
    };

  const geographic = buildGeographic(samples, geometry);
  if (geographic?.reference) return geographic;

  const utm = buildUtm(samples, geometry);
  if (utm?.reference) return utm;

  return (
    geographic ??
    utm ?? {
      reference: null,
      method: null,
      confidence: 0,
      reason:
        "Nenhuma grade geográfica ou UTM confiável foi identificada no texto do PDF.",
      diagnostics: EMPTY_DIAGNOSTICS,
    }
  );
};
