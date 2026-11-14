import { Vector3D, dot, normalize, clamp } from '../../utils/vectors';
import { radToDeg, azElToEnuVector } from '../../utils/angles';

export interface SolarIncidenceResult {
  surfaceNormalEnu: Vector3D;
  sunVectorEnu: Vector3D;
  cosineIncidenceAngle: number; // mu = dot(n, s)
  incidenceAngleDeg: number;    // arccos(mu)
  sunElevationRelativeToSlopeDeg: number; // 90 - incidenceAngle
  isFacingSun: boolean;
  cosineEfficiency: number;     // max(0, mu)
}

export class SolarIncidenceService {
  /**
   * Evaluates the solar orientation of a local surface.
   * Both surface normal and Sun vector must be in the same local ENU coordinate frame.
   */
  public static calculateSolarIncidence(
    surfaceNormalEnu: Vector3D,
    sunAzimuthDeg: number,
    sunElevationDeg: number
  ): SolarIncidenceResult {
    const unitNormal = normalize(surfaceNormalEnu);
    const unitSun = normalize(azElToEnuVector(sunAzimuthDeg, sunElevationDeg));

    const mu = dot(unitNormal, unitSun);
    const clampedMu = clamp(mu, -1.0, 1.0);

    const incidenceAngleRad = Math.acos(clampedMu);
    const incidenceAngleDeg = radToDeg(incidenceAngleRad);
    const sunElevationRelativeToSlopeDeg = 90.0 - incidenceAngleDeg;

    const isFacingSun = mu > 0.0;
    const cosineEfficiency = Math.max(0.0, mu);

    return {
      surfaceNormalEnu: unitNormal,
      sunVectorEnu: unitSun,
      cosineIncidenceAngle: mu,
      incidenceAngleDeg,
      sunElevationRelativeToSlopeDeg,
      isFacingSun,
      cosineEfficiency,
    };
  }
}
