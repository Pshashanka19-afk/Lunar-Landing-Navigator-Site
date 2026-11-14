import { Vector3D } from './vectors';

export const DEG_TO_RAD = Math.PI / 180.0;
export const RAD_TO_DEG = 180.0 / Math.PI;

export function degToRad(degrees: number): number {
  return degrees * DEG_TO_RAD;
}

export function radToDeg(radians: number): number {
  return radians * RAD_TO_DEG;
}

/**
 * Normalizes an angle in degrees to the [0, 360) interval.
 */
export function normalizeDegrees(deg: number): number {
  const mod = deg % 360;
  const res = mod < 0 ? mod + 360 : mod;
  return res === 0 ? 0 : res;
}

/**
 * Normalizes an angle in degrees to the [-180, 180) interval.
 */
export function normalizeDegrees180(deg: number): number {
  let angle = normalizeDegrees(deg);
  if (angle >= 180) {
    angle -= 360;
  }
  return angle === 0 ? 0 : angle;
}

/**
 * Calculates the shortest angular difference from angle1 to angle2 in degrees [-180, 180].
 */
export function angularDifferenceDeg(angle1: number, angle2: number): number {
  const diff = normalizeDegrees(angle2) - normalizeDegrees(angle1);
  return normalizeDegrees180(diff);
}

/**
 * Computes East-North-Up (ENU) azimuth and elevation from an ENU vector.
 * - E: East component (x)
 * - N: North component (y)
 * - U: Up component (z)
 * 
 * Conventions:
 * Azimuth: 0° North, 90° East, 180° South, 270° West (clockwise)
 * Elevation: -90° to +90° relative to local horizontal plane
 */
export function enuVectorToAzEl(enuVector: Vector3D): { azimuthDeg: number; elevationDeg: number } {
  const E = enuVector.x;
  const N = enuVector.y;
  const U = enuVector.z;

  const horizontalDistance = Math.hypot(E, N);

  if (horizontalDistance < 1e-12) {
    // Purely vertical vector pointing up or down
    const elevationDeg = U > 0 ? 90.0 : U < 0 ? -90.0 : 0.0;
    return { azimuthDeg: 0.0, elevationDeg };
  }

  // atan2(E, N) returns 0 for North (E=0, N>0), +pi/2 for East (E>0, N=0), etc.
  const azimuthRad = Math.atan2(E, N);
  const azimuthDeg = normalizeDegrees(radToDeg(azimuthRad));

  const elevationRad = Math.atan2(U, horizontalDistance);
  const elevationDeg = radToDeg(elevationRad);

  return { azimuthDeg, elevationDeg };
}

/**
 * Converts azimuth and elevation angles to a normalized unit vector in ENU coordinates.
 */
export function azElToEnuVector(azimuthDeg: number, elevationDeg: number): Vector3D {
  const azRad = degToRad(azimuthDeg);
  const elRad = degToRad(elevationDeg);

  const cosEl = Math.cos(elRad);
  const sinEl = Math.sin(elRad);

  // E = cos(el) * sin(az)
  // N = cos(el) * cos(az)
  // U = sin(el)
  return {
    x: cosEl * Math.sin(azRad),
    y: cosEl * Math.cos(azRad),
    z: sinEl,
  };
}

/**
 * Circular interpolation between two azimuth angles across the 0°/360° boundary.
 * @param az1 Starting azimuth in degrees
 * @param az2 Ending azimuth in degrees
 * @param t Interpolation factor [0, 1]
 */
export function interpolateAzimuthDeg(az1: number, az2: number, t: number): number {
  const diff = angularDifferenceDeg(az1, az2);
  return normalizeDegrees(az1 + diff * t);
}
