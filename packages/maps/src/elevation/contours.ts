import type { Contour, ContourLayer, DemMetadata } from "@geonexo/contracts";

export function generateContours(
  dem: Int16Array | Float32Array,
  metadata: DemMetadata,
  interval: number,
  majorInterval: number,
): ContourLayer {
  const contours: Contour[] = [];
  const [minLon, minLat, maxLon, maxLat] = metadata.bounds;
  const lonStep = (maxLon - minLon) / (metadata.width - 1);
  const latStep = (maxLat - minLat) / (metadata.height - 1);

  let minElev = Infinity;
  let maxElev = -Infinity;
  for (let i = 0; i < dem.length; i++) {
    const v = dem[i];
    if (v === undefined || v === metadata.noDataValue) continue;
    if (v < minElev) minElev = v;
    if (v > maxElev) maxElev = v;
  }
  if (!Number.isFinite(minElev)) minElev = 0;
  if (!Number.isFinite(maxElev)) maxElev = 0;

  const startLevel = Math.ceil(minElev / interval) * interval;
  const endLevel = Math.floor(maxElev / interval) * interval;

  for (let level = startLevel; level <= endLevel; level += interval) {
    const isMajor = level % majorInterval === 0;
    const segments = marchingSquares(dem, metadata, level, lonStep, latStep);
    for (const seg of segments) {
      contours.push({ elevation: level, interval, isMajor, geometry: seg });
    }
  }

  return { interval, majorInterval, minElevation: minElev, maxElevation: maxElev, contours };
}

function marchingSquares(
  dem: Int16Array | Float32Array,
  metadata: DemMetadata,
  level: number,
  lonStep: number,
  latStep: number,
): Array<Array<[number, number]>> {
  const segments: Array<Array<[number, number]>> = [];
  const [minLon, minLat] = metadata.bounds;

  for (let row = 0; row < metadata.height - 1; row++) {
    for (let col = 0; col < metadata.width - 1; col++) {
      const tl = dem[row * metadata.width + col];
      const tr = dem[row * metadata.width + col + 1];
      const bl = dem[(row + 1) * metadata.width + col];
      const br = dem[(row + 1) * metadata.width + col + 1];

      if (
        tl === undefined || tr === undefined ||
        bl === undefined || br === undefined ||
        tl === metadata.noDataValue || tr === metadata.noDataValue ||
        bl === metadata.noDataValue || br === metadata.noDataValue
      )
        continue;

      const index =
        (tl >= level ? 8 : 0) |
        (tr >= level ? 4 : 0) |
        (br >= level ? 2 : 0) |
        (bl >= level ? 1 : 0);

      if (index === 0 || index === 15) continue;

      const x0 = minLon + col * lonStep;
      const y0 = minLat + row * latStep;
      const x1 = x0 + lonStep;
      const y1 = y0 + latStep;

      const top: [number, number] = [x0 + lonStep * ((level - tl) / (tr - tl)), y0];
      const right: [number, number] = [x1, y0 + latStep * ((level - tr) / (br - tr))];
      const bottom: [number, number] = [x0 + lonStep * ((level - bl) / (br - bl)), y1];
      const left: [number, number] = [x0, y0 + latStep * ((level - tl) / (bl - tl))];

      const cases: Record<number, Array<[number, number][]>> = {
        1: [[bottom, left]],
        2: [[right, bottom]],
        3: [[right, left]],
        4: [[top, right]],
        5: [
          [top, right],
          [bottom, left],
        ],
        6: [[top, bottom]],
        7: [[top, left]],
        8: [[top, left]],
        9: [[top, bottom]],
        10: [
          [top, right],
          [bottom, left],
        ],
        11: [[top, right]],
        12: [[right, left]],
        13: [[right, bottom]],
        14: [[bottom, left]],
      };

      const segs = cases[index];
      if (segs) {
        for (const seg of segs) segments.push(seg);
      }
    }
  }

  return segments;
}
