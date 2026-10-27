/**
 * @file survey.ts
 * @module @markmap/geo/units/survey
 * @description Definições oficiais e conversão de unidades de agrimensura e unidades rurais brasileiras.
 * Unidades agrárias canônicas: Hectares e Alqueires (Paulista, Mineiro/Goiano, Baiano, Norte).
 */

export type DistanceUnit =
  | 'meters'
  | 'kilometers'
  | 'survey_feet'
  | 'chains'
  | 'rods'
  | 'nautical_miles';

export type RuralAreaUnit =
  | 'hectares'
  | 'alqueire_paulista'
  | 'alqueire_mineiro'
  | 'alqueire_baiano'
  | 'alqueire_norte';

export type AreaUnit =
  | 'square_meters'
  | 'square_kilometers'
  | RuralAreaUnit;

export type AngleUnit = 'degrees' | 'radians' | 'gon' | 'mils';

export interface AreaUnitDefinition {
  readonly id: AreaUnit;
  readonly label: string;
  readonly shortLabel: string;
  readonly squareMeters: number;
  readonly description: string;
}

export const AREA_UNITS: Record<AreaUnit, AreaUnitDefinition> = {
  square_meters: {
    id: 'square_meters',
    label: 'Metros quadrados',
    shortLabel: 'm²',
    squareMeters: 1,
    description: 'Metro quadrado (1 m²)',
  },
  hectares: {
    id: 'hectares',
    label: 'Hectares',
    shortLabel: 'ha',
    squareMeters: 10_000,
    description: 'Hectare (10.000 m²)',
  },
  alqueire_paulista: {
    id: 'alqueire_paulista',
    label: 'Alqueire Paulista',
    shortLabel: 'alq. paulista',
    squareMeters: 24_200,
    description: 'Alqueire Paulista (2,42 ha = 24.200 m²)',
  },
  alqueire_mineiro: {
    id: 'alqueire_mineiro',
    label: 'Alqueire Mineiro / Goiano',
    shortLabel: 'alq. mineiro',
    squareMeters: 48_400,
    description: 'Alqueire Mineiro / Goiano (4,84 ha = 48.400 m²)',
  },
  alqueire_baiano: {
    id: 'alqueire_baiano',
    label: 'Alqueire Baiano',
    shortLabel: 'alq. baiano',
    squareMeters: 96_800,
    description: 'Alqueire Baiano (9,68 ha = 96.800 m²)',
  },
  alqueire_norte: {
    id: 'alqueire_norte',
    label: 'Alqueirão do Norte',
    shortLabel: 'alq. norte',
    squareMeters: 27_200,
    description: 'Alqueirão do Norte (2,72 ha = 27.200 m²)',
  },
  square_kilometers: {
    id: 'square_kilometers',
    label: 'Quilômetros quadrados',
    shortLabel: 'km²',
    squareMeters: 1_000_000,
    description: 'Quilômetro quadrado (1.000.000 m²)',
  },
};

export const METERS_PER_UNIT: Record<DistanceUnit, number> = {
  meters: 1,
  kilometers: 1000,
  survey_feet: 12 / 39.37, // Definição oficial US Survey Foot
  chains: 20.1168,
  rods: 5.0292,
  nautical_miles: 1852,
};

/**
 * Converte distâncias entre unidades métricas, náuticas e agrimensura histórica.
 */
export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  if (!Number.isFinite(value)) {
    throw new RangeError('Distance value must be finite');
  }
  const fromFactor = METERS_PER_UNIT[from];
  const toFactor = METERS_PER_UNIT[to];
  if (fromFactor === undefined || toFactor === undefined) {
    throw new RangeError(`Unknown distance unit: ${String(from)} -> ${String(to)}`);
  }
  const meters = value * fromFactor;
  return meters / toFactor;
}

/**
 * Converte uma área em metros quadrados para uma unidade agrária ou métrica de destino.
 */
export function convertArea(squareMeters: number, to: AreaUnit): number {
  if (!Number.isFinite(squareMeters) || squareMeters < 0) {
    throw new RangeError('Square meters must be a non-negative finite number');
  }
  if (!Object.hasOwn(AREA_UNITS, to)) {
    throw new RangeError(`Unknown area unit: ${String(to)}`);
  }
  const unitDef = AREA_UNITS[to];
  return squareMeters / unitDef.squareMeters;
}

/**
 * Converte ângulos entre graus, radianos, grados (gon) e milésimos de artilharia (mils).
 */
export function convertAngle(value: number, from: AngleUnit, to: AngleUnit): number {
  if (!Number.isFinite(value)) {
    throw new RangeError('Angle value must be finite');
  }
  let deg = value;
  if (from === 'radians') deg = (value * 180) / Math.PI;
  if (from === 'gon') deg = (value * 360) / 400;
  if (from === 'mils') deg = (value * 360) / 6400;

  if (to === 'degrees') return deg;
  if (to === 'radians') return (deg * Math.PI) / 180;
  if (to === 'gon') return (deg * 400) / 360;
  if (to === 'mils') return (deg * 6400) / 360;
  return deg;
}

/**
 * Formata área com precisão, separadores decimais e sufixo de unidade no padrão pt-BR.
 */
export function formatArea(
  squareMeters: number,
  unit: AreaUnit = 'hectares',
  options: { locale?: string; decimals?: number; includeUnit?: boolean } = {},
): string {
  if (!Number.isFinite(squareMeters) || squareMeters < 0) {
    return options.includeUnit === false ? '0,00' : '0,00 m²';
  }
  if (!Object.hasOwn(AREA_UNITS, unit)) {
    throw new RangeError(`Unknown area unit: ${String(unit)}`);
  }
  const { locale = 'pt-BR', decimals = 2, includeUnit = true } = options;
  const value = convertArea(squareMeters, unit);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  if (!includeUnit) {
    return formatted;
  }
  const unitDef = AREA_UNITS[unit];
  return `${formatted} ${unitDef.shortLabel}`;
}
