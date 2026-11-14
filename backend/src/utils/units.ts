/**
 * Unit conversion and standardization utilities.
 */

export const UNITS = {
  ANGLE: 'degrees',
  DISTANCE: 'meters',
  DISTANCE_KM: 'kilometers',
  TIME: 'seconds',
  TIME_HOURS: 'hours',
  SPEED: 'meters/second',
} as const;

export function metersToKilometers(m: number): number {
  return m / 1000.0;
}

export function kilometersToMeters(km: number): number {
  return km * 1000.0;
}

export function secondsToHours(s: number): number {
  return s / 3600.0;
}

export function hoursToSeconds(h: number): number {
  return h * 3600.0;
}

export function roundToPrecision(val: number, decimalPlaces = 4): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(val * factor) / factor;
}
