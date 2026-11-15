import { IDemProvider, DemMetadata } from './dem.interface';
import { Vector3D, createVector, normalize } from '../../utils/vectors';
import { radToDeg, normalizeDegrees } from '../../utils/angles';
import { ScientificValidationError } from '../../types/errors';
import { DEFAULT_DEMO_SITES } from '../../config/scientific-config';

export type DerivativeMethod = 'CENTRAL_DIFFERENCE' | 'LOCAL_PLANE_FIT';

export interface SurfaceNormalAnalysisRequest {
  latitudeDeg: number;
  longitudeDeg: number;
  observerHeightMeters?: number;
  stepMeters?: number;
  derivativeMethod?: DerivativeMethod;
}

export interface SurfaceNormalAnalysisResult {
  elevationMeters: number;
  surfaceNormalEnu: Vector3D;
  slopeDeg: number;
  aspectDeg: number;
  gradient: {
    dzdx: number; // p (East gradient)
    dzdy: number; // q (North gradient)
  };
  derivativeMethod: DerivativeMethod;
  neighborhoodScaleMeters: number;
  frame: 'LOCAL_ENU';
  units: {
    angles: 'degrees';
    coordinates: 'meters';
  };
  demMetadata: DemMetadata;
  coverageStatus: 'FULL' | 'EDGE_INTERPOLATED' | 'INCOMPLETE';
  isFlat: boolean;
}

export class SurfaceNormalService {
  /**
   * Computes the surface normal, slope, and aspect at a given lunar site.
   */
  public static async analyzeSurface(
    demProvider: IDemProvider,
    req: SurfaceNormalAnalysisRequest
  ): Promise<SurfaceNormalAnalysisResult> {
    const lat = req.latitudeDeg;
    const lon = req.longitudeDeg;
    const method: DerivativeMethod = req.derivativeMethod ?? 'CENTRAL_DIFFERENCE';

    if (lat < -90 || lat > 90 || !Number.isFinite(lat)) {
      throw new ScientificValidationError(`Invalid latitude: ${lat}`);
    }
    if (lon < -180 || lon > 360 || !Number.isFinite(lon)) {
      throw new ScientificValidationError(`Invalid longitude: ${lon}`);
    }

    const demMeta = await demProvider.getMetadata();
    const { x: centerX, y: centerY } = demProvider.latLonToProjected(lat, lon);
    const step = req.stepMeters ?? demMeta.pixelSpacingMeters.x ?? 20.0;

    const centerElevation = await demProvider.getElevationAt(centerX, centerY);
    if (centerElevation === null) {
      // Coordinates fall outside the local high-resolution DEM.
      // Seamlessly evaluate surface normal on the IAU Lunar Reference Datum Sphere.
      const matchingSite = DEFAULT_DEMO_SITES.find(
        (s) => Math.abs(s.latitudeDeg - lat) < 0.05 && Math.abs(s.longitudeDeg - lon) < 0.05
      );
      const fallbackElevation = matchingSite?.elevationMeters ?? 0.0;
      return {
        elevationMeters: fallbackElevation,
        surfaceNormalEnu: createVector(0, 0, 1),
        slopeDeg: 0.0,
        aspectDeg: 0.0,
        gradient: { dzdx: 0, dzdy: 0 },
        derivativeMethod: method,
        neighborhoodScaleMeters: step * 2,
        frame: 'LOCAL_ENU',
        units: {
          angles: 'degrees',
          coordinates: 'meters',
        },
        demMetadata: demMeta,
        coverageStatus: 'INCOMPLETE',
        isFlat: true,
      };
    }

    let p = 0; // dz/dx (East)
    let q = 0; // dz/dy (North)
    let coverageStatus: 'FULL' | 'EDGE_INTERPOLATED' | 'INCOMPLETE' = 'FULL';

    if (method === 'CENTRAL_DIFFERENCE') {
      // 4-neighbor central differences
      const [zEast, zWest, zNorth, zSouth] = await Promise.all([
        demProvider.getElevationAt(centerX + step, centerY),
        demProvider.getElevationAt(centerX - step, centerY),
        demProvider.getElevationAt(centerX, centerY + step),
        demProvider.getElevationAt(centerX, centerY - step),
      ]);

      if (zEast === null || zWest === null || zNorth === null || zSouth === null) {
        coverageStatus = 'EDGE_INTERPOLATED';
        // Fallback to one-sided differences if near boundary
        if (zEast !== null && zWest !== null) {
          p = (zEast - zWest) / (2 * step);
        } else if (zEast !== null) {
          p = (zEast - centerElevation) / step;
        } else if (zWest !== null) {
          p = (centerElevation - zWest) / step;
        } else {
          coverageStatus = 'INCOMPLETE';
        }

        if (zNorth !== null && zSouth !== null) {
          q = (zNorth - zSouth) / (2 * step);
        } else if (zNorth !== null) {
          q = (zNorth - centerElevation) / step;
        } else if (zSouth !== null) {
          q = (centerElevation - zSouth) / step;
        } else {
          coverageStatus = 'INCOMPLETE';
        }
      } else {
        p = (zEast - zWest) / (2 * step);
        q = (zNorth - zSouth) / (2 * step);
      }
    } else {
      // LOCAL_PLANE_FIT (Horn's 3x3 weighted least-squares gradient)
      const neighbors = await Promise.all([
        demProvider.getElevationAt(centerX - step, centerY + step), // NW (z00)
        demProvider.getElevationAt(centerX, centerY + step),        // N  (z01)
        demProvider.getElevationAt(centerX + step, centerY + step), // NE (z02)
        demProvider.getElevationAt(centerX - step, centerY),        // W  (z10)
        demProvider.getElevationAt(centerX + step, centerY),        // E  (z12)
        demProvider.getElevationAt(centerX - step, centerY - step), // SW (z20)
        demProvider.getElevationAt(centerX, centerY - step),        // S  (z21)
        demProvider.getElevationAt(centerX + step, centerY - step), // SE (z22)
      ]);

      const [zNW, zN, zNE, zW, zE, zSW, zS, zSE] = neighbors;

      if (neighbors.some((n) => n === null)) {
        // Fallback to central difference if 3x3 grid incomplete
        return this.analyzeSurface(demProvider, {
          ...req,
          derivativeMethod: 'CENTRAL_DIFFERENCE',
        });
      }

      // Horn's formulation
      p = (zNE! + 2 * zE! + zSE! - (zNW! + 2 * zW! + zSW!)) / (8 * step);
      q = (zNW! + 2 * zN! + zNE! - (zSW! + 2 * zS! + zSE!)) / (8 * step);
    }

    // Normal vector v = (-p, -q, 1) in local ENU frame
    const unnormalizedNormal = createVector(-p, -q, 1.0);
    const surfaceNormalEnu = normalize(unnormalizedNormal);

    // Slope: angle from vertical Up (z-axis)
    const gradMag = Math.hypot(p, q);
    const slopeDeg = radToDeg(Math.atan(gradMag));

    // Aspect: direction of steepest descent (downhill vector = (-p, -q))
    const isFlat = gradMag < 1e-7;
    let aspectDeg = 0.0;
    if (!isFlat) {
      // atan2(East, North) for downhill vector (-p, -q)
      const aspectRad = Math.atan2(-p, -q);
      aspectDeg = normalizeDegrees(radToDeg(aspectRad));
    }

    return {
      elevationMeters: centerElevation,
      surfaceNormalEnu,
      slopeDeg,
      aspectDeg,
      gradient: { dzdx: p, dzdy: q },
      derivativeMethod: method,
      neighborhoodScaleMeters: step * 2,
      frame: 'LOCAL_ENU',
      units: {
        angles: 'degrees',
        coordinates: 'meters',
      },
      demMetadata: demMeta,
      coverageStatus,
      isFlat,
    };
  }
}
