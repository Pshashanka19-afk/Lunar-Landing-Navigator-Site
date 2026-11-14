import { IEphemerisProvider } from '../ephemeris/ephemeris.interface';
import { IDemProvider } from '../terrain/dem.interface';
import { SurfaceNormalService } from '../terrain/surface-normal.service';
import { HorizonProfileService, HorizonSample } from '../terrain/horizon-profile.service';
import { TerrainVisibilityService, GeometricVisibilityEvaluation } from '../terrain/terrain-visibility.service';
import { SolarIncidenceService, SolarIncidenceResult } from './solar-incidence.service';
import { LunarSiteCoordinates } from '../coordinates/lunar-frame.service';

export type DirectIlluminationClassification =
  | 'ILLUMINATED'
  | 'SHADOWED_BY_TERRAIN'
  | 'SELF_SHADOWED'
  | 'BLOCKED_AND_SELF_SHADOWED'
  | 'UNKNOWN';

export interface InstantIlluminationRequest {
  siteCoords: LunarSiteCoordinates;
  epochUtc: string;
  observerHeightMeters?: number;
  horizonSamples?: HorizonSample[];
  searchRadiusMeters?: number;
  azimuthStepDeg?: number;
}

export interface InstantIlluminationResult {
  siteCoords: LunarSiteCoordinates;
  epochUtc: string;
  sunGeometry: {
    azimuthDeg: number;
    elevationDeg: number;
    distanceMeters: number;
  };
  terrainVisibility: GeometricVisibilityEvaluation;
  surfaceOrientation: SolarIncidenceResult;
  illuminationStatus: DirectIlluminationClassification;
  isDirectlyIlluminated: boolean;
  conditions: {
    sunClearsHorizon: boolean;
    surfaceFacesSun: boolean;
  };
  limitations: string[];
}

export class IlluminationService {
  /**
   * Calculates instantaneous solar geometry, terrain clearance, surface orientation,
   * and simplified direct illumination.
   */
  public static async calculateInstantIllumination(
    ephemerisProvider: IEphemerisProvider,
    demProvider: IDemProvider,
    req: InstantIlluminationRequest
  ): Promise<InstantIlluminationResult> {
    const observerHeight = req.observerHeightMeters ?? 2.0;

    // 1. Calculate Sun ephemeris
    const sunEphemeris = await ephemerisProvider.calculateTarget({
      target: 'SUN',
      epochUtc: req.epochUtc,
      siteCoords: req.siteCoords,
      observerHeightMeters: observerHeight,
    });

    // 2. Obtain Horizon Profile (or compute if not supplied)
    let horizonSamples = req.horizonSamples;
    if (!horizonSamples || horizonSamples.length === 0) {
      const horizonResult = await HorizonProfileService.calculateHorizonProfile(demProvider, {
        latitudeDeg: req.siteCoords.latitudeDeg,
        longitudeDeg: req.siteCoords.longitudeDeg,
        observerHeightMeters: observerHeight,
        searchRadiusMeters: req.searchRadiusMeters ?? 1000.0,
        azimuthStepDeg: req.azimuthStepDeg ?? 5.0,
      });
      horizonSamples = horizonResult.samples;
    }

    // 3. Evaluate Geometric Visibility vs Horizon
    const terrainVisibility = TerrainVisibilityService.evaluateTargetVisibility(
      sunEphemeris.azimuthDeg,
      sunEphemeris.elevationDeg,
      horizonSamples
    );

    // 4. Calculate Surface Normal & Orientation
    const surfaceAnalysis = await SurfaceNormalService.analyzeSurface(demProvider, {
      latitudeDeg: req.siteCoords.latitudeDeg,
      longitudeDeg: req.siteCoords.longitudeDeg,
      observerHeightMeters: observerHeight,
    });

    const surfaceOrientation = SolarIncidenceService.calculateSolarIncidence(
      surfaceAnalysis.surfaceNormalEnu,
      sunEphemeris.azimuthDeg,
      sunEphemeris.elevationDeg
    );

    // 5. Direct Illumination Decision
    const sunClearsHorizon = terrainVisibility.clearanceDeg > 0;
    const surfaceFacesSun = surfaceOrientation.isFacingSun;

    let illuminationStatus: DirectIlluminationClassification = 'UNKNOWN';
    let isDirectlyIlluminated = false;

    if (sunClearsHorizon && surfaceFacesSun) {
      illuminationStatus = 'ILLUMINATED';
      isDirectlyIlluminated = true;
    } else if (!sunClearsHorizon && surfaceFacesSun) {
      illuminationStatus = 'SHADOWED_BY_TERRAIN';
      isDirectlyIlluminated = false;
    } else if (sunClearsHorizon && !surfaceFacesSun) {
      illuminationStatus = 'SELF_SHADOWED';
      isDirectlyIlluminated = false;
    } else {
      illuminationStatus = 'BLOCKED_AND_SELF_SHADOWED';
      isDirectlyIlluminated = false;
    }

    return {
      siteCoords: req.siteCoords,
      epochUtc: req.epochUtc,
      sunGeometry: {
        azimuthDeg: sunEphemeris.azimuthDeg,
        elevationDeg: sunEphemeris.elevationDeg,
        distanceMeters: sunEphemeris.distanceMeters,
      },
      terrainVisibility,
      surfaceOrientation,
      illuminationStatus,
      isDirectlyIlluminated,
      conditions: {
        sunClearsHorizon,
        surfaceFacesSun,
      },
      limitations: [
        'Point-source solar model without partial solar disc limb darkening',
        'Direct geometric line-of-sight only; does not model secondary scattered regolith light',
        'Does not calculate solar array electrical power output or operational margins',
      ],
    };
  }
}
