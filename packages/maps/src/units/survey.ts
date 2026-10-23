export type DistanceUnit = "meters" | "kilometers" | "survey_feet" | "chains" | "rods" | "nautical_miles";
export type AreaUnit = "square_meters" | "hectares" | "square_kilometers" | "alqueire_paulista" | "alqueire_mineiro" | "alqueire_baiano" | "alqueire_norte";
export type AngleUnit = "degrees" | "radians" | "gon" | "mils";

const METERS_PER_UNIT: Record<DistanceUnit, number> = {
  meters: 1,
  kilometers: 1000,
  survey_feet: 12 / 39.37, // Precise US Survey Foot definition
  chains: 20.1168,
  rods: 5.0292,
  nautical_miles: 1852,
};

const SQUARE_METERS_PER_AREA: Record<AreaUnit, number> = {
  square_meters: 1,
  hectares: 10000,
  square_kilometers: 1000000,
  alqueire_paulista: 24200, // 2.42 ha
  alqueire_mineiro: 48400, // 4.84 ha (also goiano)
  alqueire_baiano: 96800, // 9.68 ha
  alqueire_norte: 27225, // 2.7225 ha
};

export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  if (!Number.isFinite(value)) throw new RangeError("Distance value must be finite");
  const meters = value * METERS_PER_UNIT[from];
  return meters / METERS_PER_UNIT[to];
}

export function convertArea(squareMeters: number, to: AreaUnit): number {
  if (!Number.isFinite(squareMeters) || squareMeters < 0) {
    throw new RangeError("Square meters must be a non-negative finite number");
  }
  const divisor = SQUARE_METERS_PER_AREA[to];
  return squareMeters / divisor;
}

export function convertAngle(value: number, from: AngleUnit, to: AngleUnit): number {
  if (!Number.isFinite(value)) throw new RangeError("Angle value must be finite");
  let deg = value;
  if (from === "radians") deg = (value * 180) / Math.PI;
  if (from === "gon") deg = (value * 360) / 400;
  if (from === "mils") deg = (value * 360) / 6400;

  if (to === "degrees") return deg;
  if (to === "radians") return (deg * Math.PI) / 180;
  if (to === "gon") return (deg * 400) / 360;
  if (to === "mils") return (deg * 6400) / 360;
  return deg;
}
