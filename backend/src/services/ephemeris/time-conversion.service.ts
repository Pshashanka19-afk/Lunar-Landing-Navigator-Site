import {
  dateToJulianDate,
  dateToEphemerisTimeSeconds,
  ephemerisTimeToDate,
  dateToJulianCenturiesJ2000,
} from '../../utils/time';
import { ScientificValidationError } from '../../types/errors';

export class TimeConversionService {
  /**
   * Validates an ISO 8601 UTC date string.
   */
  public static validateUtcIsoString(isoString: string): Date {
    if (typeof isoString !== 'string' || isoString.trim().length === 0) {
      throw new ScientificValidationError('Epoch timestamp must be a non-empty string');
    }

    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      throw new ScientificValidationError(
        `Invalid ISO 8601 UTC timestamp format: "${isoString}". Expected format e.g. "2026-10-29T12:00:00Z"`
      );
    }

    return date;
  }

  /**
   * Converts UTC ISO string to Ephemeris Time (seconds past J2000).
   */
  public static utcToEphemerisTime(isoString: string): number {
    const date = this.validateUtcIsoString(isoString);
    return dateToEphemerisTimeSeconds(date);
  }

  /**
   * Converts Ephemeris Time (seconds past J2000) to ISO 8601 UTC string.
   */
  public static ephemerisTimeToUtcIso(etSeconds: number): string {
    return ephemerisTimeToDate(etSeconds).toISOString();
  }

  /**
   * Converts UTC ISO string to Julian Date.
   */
  public static utcToJulianDate(isoString: string): number {
    const date = this.validateUtcIsoString(isoString);
    return dateToJulianDate(date);
  }

  /**
   * Converts UTC ISO string to Julian Centuries since J2000.
   */
  public static utcToJulianCenturies(isoString: string): number {
    const date = this.validateUtcIsoString(isoString);
    return dateToJulianCenturiesJ2000(date);
  }
}
