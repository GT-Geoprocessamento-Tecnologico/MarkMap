export type DistanceUnit = "meters" | "kilometers" | "survey_feet" | "chains" | "rods" | "nautical_miles";
export type AngleUnit = "degrees" | "radians" | "gon" | "mils";

const METERS_PER_UNIT: Record<DistanceUnit, number> = {
  meters: 1,
  kilometers: 1000,
  survey_feet: 12 / 39.37, // Precise US Survey Foot definition
  chains: 20.1168,
  rods: 5.0292,
  nautical_miles: 1852,
};

export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  const meters = value * METERS_PER_UNIT[from];
  return meters / METERS_PER_UNIT[to];
}

export function convertAngle(value: number, from: AngleUnit, to: AngleUnit): number {
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
