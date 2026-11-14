/**
 * Time conversion utilities for astronomical and ephemeris computations.
 */

// Standard J2000.0 epoch in Julian Date
export const JD_J2000 = 2451545.0;

// Approximate leap seconds + 32.184s offset for recent epochs (TT - UTC)
// In 2026, cumulative leap seconds are 37s, so TT - UTC = 37 + 32.184 = 69.184s
export const DEFAULT_TT_MINUS_UTC_SECONDS = 69.184;

/**
 * Converts a JS Date or ISO 8601 string into Julian Date (JD) in UTC.
 */
export function dateToJulianDate(dateInput: Date | string): number {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date input for Julian Date conversion: ${dateInput}`);
  }

  // Unix epoch 1970-01-01T00:00:00Z in Julian Date is 2440587.5
  return 2440587.5 + date.getTime() / 86400000.0;
}

/**
 * Converts Julian Date to a JavaScript Date object (UTC).
 */
export function julianDateToDate(jd: number): Date {
  const timeMs = (jd - 2440587.5) * 86400000.0;
  return new Date(timeMs);
}

/**
 * Converts a UTC Date into Ephemeris Time / Barycentric Dynamical Time (TDB/ET)
 * in seconds past J2000.0.
 */
export function dateToEphemerisTimeSeconds(dateInput: Date | string): number {
  const jd = dateToJulianDate(dateInput);
  const daysSinceJ2000 = jd - JD_J2000;
  // Convert days to seconds and add TT/TDB offset
  return daysSinceJ2000 * 86400.0 + DEFAULT_TT_MINUS_UTC_SECONDS;
}

/**
 * Converts Ephemeris Time (seconds past J2000) back to UTC Date.
 */
export function ephemerisTimeToDate(etSeconds: number): Date {
  const daysSinceJ2000 = (etSeconds - DEFAULT_TT_MINUS_UTC_SECONDS) / 86400.0;
  const jd = JD_J2000 + daysSinceJ2000;
  return julianDateToDate(jd);
}

/**
 * Calculates centuries since J2000.0 (T) for use in planetary orbital series.
 */
export function dateToJulianCenturiesJ2000(dateInput: Date | string): number {
  const jd = dateToJulianDate(dateInput);
  return (jd - JD_J2000) / 36525.0;
}

/**
 * Generates an array of ISO timestamp strings between start and end with a given step in seconds.
 */
export function generateTimeGrid(
  start: Date | string,
  end: Date | string,
  stepSeconds: number
): string[] {
  const startTime = typeof start === 'string' ? new Date(start).getTime() : start.getTime();
  const endTime = typeof end === 'string' ? new Date(end).getTime() : end.getTime();

  if (isNaN(startTime) || isNaN(endTime)) {
    throw new Error('Invalid start or end date');
  }

  if (startTime > endTime) {
    throw new Error('Start time cannot be after end time');
  }

  const stepMs = Math.max(1, stepSeconds) * 1000;
  const timestamps: string[] = [];

  for (let t = startTime; t <= endTime; t += stepMs) {
    timestamps.push(new Date(t).toISOString());
  }

  // Ensure the exact end boundary is included if not precisely aligned with step
  if (timestamps.length > 0) {
    const lastTime = new Date(timestamps[timestamps.length - 1]).getTime();
    if (lastTime < endTime) {
      timestamps.push(new Date(endTime).toISOString());
    }
  }

  return timestamps;
}
