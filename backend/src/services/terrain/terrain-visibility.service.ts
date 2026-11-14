import { HorizonProfileService, HorizonSample } from './horizon-profile.service';

export type VisibilityClassification =
  | 'CENTER_CLEAR'
  | 'CENTER_BLOCKED'
  | 'BOUNDARY_CASE'
  | 'UNKNOWN';

export interface GeometricVisibilityEvaluation {
  targetAzimuthDeg: number;
  targetElevationDeg: number;
  horizonElevationDeg: number;
  clearanceDeg: number;
  toleranceDeg: number;
  status: VisibilityClassification;
  isGeometricallyVisible: boolean;
  reason: string;
}

export class TerrainVisibilityService {
  /**
   * Evaluates the geometric visibility of a celestial target relative to the terrain horizon profile.
   */
  public static evaluateTargetVisibility(
    targetAzimuthDeg: number,
    targetElevationDeg: number,
    horizonSamples: HorizonSample[],
    toleranceDeg = 0.1
  ): GeometricVisibilityEvaluation {
    if (!Number.isFinite(targetAzimuthDeg) || !Number.isFinite(targetElevationDeg)) {
      return {
        targetAzimuthDeg,
        targetElevationDeg,
        horizonElevationDeg: 0,
        clearanceDeg: 0,
        toleranceDeg,
        status: 'UNKNOWN',
        isGeometricallyVisible: false,
        reason: 'Target azimuth or elevation is non-finite or invalid.',
      };
    }

    if (!horizonSamples || horizonSamples.length === 0) {
      return {
        targetAzimuthDeg,
        targetElevationDeg,
        horizonElevationDeg: 0,
        clearanceDeg: 0,
        toleranceDeg,
        status: 'UNKNOWN',
        isGeometricallyVisible: false,
        reason: 'Terrain horizon profile is unavailable.',
      };
    }

    // Interpolate horizon angle at target azimuth
    const horizonElevationDeg = HorizonProfileService.interpolateHorizonAtAzimuth(
      horizonSamples,
      targetAzimuthDeg
    );

    const clearanceDeg = targetElevationDeg - horizonElevationDeg;

    let status: VisibilityClassification = 'BOUNDARY_CASE';
    let isGeometricallyVisible = false;
    let reason = '';

    if (clearanceDeg > toleranceDeg) {
      status = 'CENTER_CLEAR';
      isGeometricallyVisible = true;
      reason = `Target elevation (${targetElevationDeg.toFixed(2)}°) clears the terrain horizon (${horizonElevationDeg.toFixed(2)}°) by +${clearanceDeg.toFixed(2)}°.`;
    } else if (clearanceDeg < -toleranceDeg) {
      status = 'CENTER_BLOCKED';
      isGeometricallyVisible = false;
      reason = `Target elevation (${targetElevationDeg.toFixed(2)}°) is obstructed by the terrain horizon (${horizonElevationDeg.toFixed(2)}°) with clearance ${clearanceDeg.toFixed(2)}°.`;
    } else {
      status = 'BOUNDARY_CASE';
      // At the boundary, target is grazing horizon within angular tolerance
      isGeometricallyVisible = clearanceDeg >= 0;
      reason = `Target is near the horizon boundary (clearance ${clearanceDeg.toFixed(2)}° within +/-${toleranceDeg.toFixed(2)}° tolerance).`;
    }

    return {
      targetAzimuthDeg,
      targetElevationDeg,
      horizonElevationDeg,
      clearanceDeg,
      toleranceDeg,
      status,
      isGeometricallyVisible,
      reason,
    };
  }
}
