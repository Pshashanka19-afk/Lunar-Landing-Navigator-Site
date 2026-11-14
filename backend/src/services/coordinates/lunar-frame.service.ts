import { Vector3D, createVector } from '../../utils/vectors';
import { degToRad, radToDeg, normalizeDegrees } from '../../utils/angles';
import { SCIENTIFIC_CONSTANTS } from '../../config/scientific-config';
import { ScientificValidationError } from '../../types/errors';

export interface LunarSiteCoordinates {
  latitudeDeg: number;
  longitudeDeg: number;
  elevationMeters?: number;
}

export class LunarFrameService {
  /**
   * Validates lunar selenographic coordinates.
   * Latitude must be in [-90, +90], longitude in [-180, +360].
   */
  public static validateCoordinates(coords: LunarSiteCoordinates): void {
    if (
      typeof coords.latitudeDeg !== 'number' ||
      coords.latitudeDeg < -90.0 ||
      coords.latitudeDeg > 90.0 ||
      !Number.isFinite(coords.latitudeDeg)
    ) {
      throw new ScientificValidationError(
        `Latitude must be a valid number between -90 and +90 degrees. Received: ${coords.latitudeDeg}`
      );
    }

    if (
      typeof coords.longitudeDeg !== 'number' ||
      coords.longitudeDeg < -180.0 ||
      coords.longitudeDeg > 360.0 ||
      !Number.isFinite(coords.longitudeDeg)
    ) {
      throw new ScientificValidationError(
        `Longitude must be a valid number between -180 and +360 degrees. Received: ${coords.longitudeDeg}`
      );
    }
  }

  /**
   * Converts Selenographic coordinates (lat, lon, elevation) to 3D Cartesian coordinates
   * in the Mean Earth/Polar Axis (MOON_ME) frame relative to the Moon center.
   */
  public static selenographicToCartesianME(
    coords: LunarSiteCoordinates,
    referenceRadiusMeters = SCIENTIFIC_CONSTANTS.MOON_MEAN_RADIUS_M
  ): Vector3D {
    this.validateCoordinates(coords);

    const latRad = degToRad(coords.latitudeDeg);
    const lonRad = degToRad(coords.longitudeDeg);
    const elevation = coords.elevationMeters ?? 0.0;
    const r = referenceRadiusMeters + elevation;

    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);
    const cosLon = Math.cos(lonRad);
    const sinLon = Math.sin(lonRad);

    return createVector(
      r * cosLat * cosLon,
      r * cosLat * sinLon,
      r * sinLat
    );
  }

  /**
   * Converts 3D Cartesian coordinates in the MOON_ME frame back to Selenographic coordinates.
   */
  public static cartesianMEToSelenographic(
    pos: Vector3D,
    referenceRadiusMeters = SCIENTIFIC_CONSTANTS.MOON_MEAN_RADIUS_M
  ): LunarSiteCoordinates {
    const x = pos.x;
    const y = pos.y;
    const z = pos.z;
    const r = Math.hypot(x, y, z);

    if (r === 0) {
      return { latitudeDeg: 0, longitudeDeg: 0, elevationMeters: -referenceRadiusMeters };
    }

    const latRad = Math.asin(z / r);
    const lonRad = Math.atan2(y, x);

    return {
      latitudeDeg: radToDeg(latRad),
      longitudeDeg: normalizeDegrees(radToDeg(lonRad)),
      elevationMeters: r - referenceRadiusMeters,
    };
  }
}
