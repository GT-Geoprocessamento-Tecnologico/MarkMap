// Desenvolvido por MtsFerreira. Do not confuse GPS uncertainty with bad PDF coordinates.
export const MAX_GEO_PDF_GPS_ACCURACY_METERS = 100;

function onSegment(point, start, end) {
  const cross = (point[0] - start[0]) * (end[1] - start[1]) -
    (point[1] - start[1]) * (end[0] - start[0]);
  return Math.abs(cross) < 1e-10 &&
    point[0] >= Math.min(start[0], end[0]) - 1e-10 &&
    point[0] <= Math.max(start[0], end[0]) + 1e-10 &&
    point[1] >= Math.min(start[1], end[1]) - 1e-10 &&
    point[1] <= Math.max(start[1], end[1]) + 1e-10;
}

function containsPoint(point, corners) {
  let inside = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const a = corners[j];
    const b = corners[i];
    if (onSegment(point, a, b)) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}

/** An exact-position claim requires reliable GPS and a point inside the raster. */
export function evaluateGeoPdfGps(fix, corners) {
  if (!fix || !Number.isFinite(fix.lon) || !Number.isFinite(fix.lat) ||
      Math.abs(fix.lon) > 180 || Math.abs(fix.lat) > 90 ||
      !Number.isFinite(fix.accuracyM) || fix.accuracyM < 0 ||
      !Array.isArray(corners) || corners.length !== 4 ||
      !corners.every((point) => Array.isArray(point) && point.length === 2 &&
        Number.isFinite(point[0]) && Number.isFinite(point[1]) &&
        Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90)) {
    return { status: "unavailable" };
  }
  if (fix.accuracyM > MAX_GEO_PDF_GPS_ACCURACY_METERS) {
    return { status: "imprecise", accuracyM: fix.accuracyM };
  }
  if (!containsPoint([fix.lon, fix.lat], corners)) {
    return { status: "outside", accuracyM: fix.accuracyM };
  }
  return { status: "inside", center: [fix.lon, fix.lat], accuracyM: fix.accuracyM };
}

/** Display the position provider's accuracy, without claiming PDF calibration accuracy. */
export function describeGeoPdfGps(result) {
  if (result.status === "inside") {
    return `GPS ±${Math.round(result.accuracyM)} m: sua posição está na área georreferenciada do PDF.`;
  }
  if (result.status === "outside") {
    return `GPS ±${Math.round(result.accuracyM)} m: posição fora da área do PDF, visível no mapa-base.`;
  }
  if (result.status === "imprecise") {
    return `GPS aproximado (±${Math.round(result.accuracyM)} m). O ponto mostrado pode estar deslocado; use GPS mais preciso.`;
  }
  return "Posição GPS indisponível para conferir a carta PDF.";
}
