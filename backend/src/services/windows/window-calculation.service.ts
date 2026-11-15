import { IEphemerisProvider } from '../ephemeris/ephemeris.interface';
import { IDemProvider } from '../terrain/dem.interface';
import { HorizonProfileService } from '../terrain/horizon-profile.service';
import { SurfaceNormalService } from '../terrain/surface-normal.service';
import { TerrainVisibilityService } from '../terrain/terrain-visibility.service';
import { SolarIncidenceService } from '../illumination/solar-incidence.service';
import { LunarSiteCoordinates } from '../coordinates/lunar-frame.service';
import { BoundaryRefinementService } from './boundary-refinement.service';
import { generateTimeGrid } from '../../utils/time';
import { secondsToHours, roundToPrecision } from '../../utils/units';
import { ComputationLimitExceededError, ScientificValidationError } from '../../types/errors';

export interface VisibilityWindow {
  target: 'SUN' | 'EARTH' | 'BOTH';
  startUtc: string;
  endUtc: string;
  durationSeconds: number;
  durationHours: number;
  boundaryRefined: boolean;
  confidence: 'HIGH' | 'APPROXIMATE' | 'BOUNDARY_UNCERTAIN';
}

export interface SampledTimeSeriesPoint {
  epochUtc: string;
  sun: {
    azimuthDeg: number;
    elevationDeg: number;
    horizonDeg: number;
    clearanceDeg: number;
    isFacingSun: boolean;
    isVisible: boolean;
  };
  earth: {
    azimuthDeg: number;
    elevationDeg: number;
    horizonDeg: number;
    clearanceDeg: number;
    isVisible: boolean;
  };
  bothVisible: boolean;
}

export interface WindowCalculationRequest {
  siteCoords: LunarSiteCoordinates;
  startTimeUtc: string;
  endTimeUtc: string;
  stepSeconds?: number;
  boundaryToleranceSeconds?: number;
  observerHeightMeters?: number;
  solarMarginDeg?: number;
  earthMarginDeg?: number;
  searchRadiusMeters?: number;
  azimuthStepDeg?: number;
  includeTimeSeries?: boolean;
}

export interface WindowCalculationResult {
  siteCoords: LunarSiteCoordinates;
  missionInterval: {
    startUtc: string;
    endUtc: string;
    totalDurationHours: number;
    stepSeconds: number;
    totalSampleCount: number;
  };
  windows: {
    sunWindows: VisibilityWindow[];
    earthWindows: VisibilityWindow[];
    bothWindows: VisibilityWindow[];
  };
  summary: {
    sunlightTotalHours: number;
    sunlightPercentage: number;
    longestSunlightContinuousHours: number;
    earthVisibilityTotalHours: number;
    earthVisibilityPercentage: number;
    longestEarthVisibilityContinuousHours: number;
    bothVisibilityTotalHours: number;
    bothVisibilityPercentage: number;
    longestBothContinuousHours: number;
  };
  timeSeries?: SampledTimeSeriesPoint[];
  metadata: {
    ephemerisProvider: string;
    terrainDataset: string;
    boundaryToleranceSeconds: number;
    refinementMethod: string;
    assumptions: string[];
  };
}

export class WindowCalculationService {
  public static readonly MAX_ALLOWED_SAMPLES = 5000;

  /**
   * Computes visibility and illumination windows over a specified mission time interval.
   */
  public static async calculateWindows(
    ephemerisProvider: IEphemerisProvider,
    demProvider: IDemProvider,
    req: WindowCalculationRequest
  ): Promise<WindowCalculationResult> {
    const startTimeMs = new Date(req.startTimeUtc).getTime();
    const endTimeMs = new Date(req.endTimeUtc).getTime();

    if (isNaN(startTimeMs) || isNaN(endTimeMs)) {
      throw new ScientificValidationError('Invalid start or end time ISO string');
    }
    if (startTimeMs >= endTimeMs) {
      throw new ScientificValidationError('Start time must be strictly before end time');
    }

    const stepSeconds = req.stepSeconds ?? 300;
    const boundaryToleranceSeconds = req.boundaryToleranceSeconds ?? 30;
    const observerHeight = req.observerHeightMeters ?? 2.0;
    const solarMarginDeg = req.solarMarginDeg ?? 0.0;
    const earthMarginDeg = req.earthMarginDeg ?? 0.0;
    const includeTimeSeries = req.includeTimeSeries ?? true;

    // Validate sample count limit
    const totalIntervalSeconds = (endTimeMs - startTimeMs) / 1000;
    const estimatedSampleCount = Math.ceil(totalIntervalSeconds / stepSeconds) + 1;

    if (estimatedSampleCount > this.MAX_ALLOWED_SAMPLES) {
      throw new ComputationLimitExceededError(
        `Requested mission interval with step ${stepSeconds}s results in ${estimatedSampleCount} samples, exceeding maximum permitted limit of ${this.MAX_ALLOWED_SAMPLES}. Please increase stepSeconds or narrow the time interval.`
      );
    }

    // 1. Generate timestamps
    const timestamps = generateTimeGrid(req.startTimeUtc, req.endTimeUtc, stepSeconds);

    // 2. Compute terrain horizon mask once for the site
    const horizonProfile = await HorizonProfileService.calculateHorizonProfile(demProvider, {
      latitudeDeg: req.siteCoords.latitudeDeg,
      longitudeDeg: req.siteCoords.longitudeDeg,
      observerHeightMeters: observerHeight,
      searchRadiusMeters: req.searchRadiusMeters ?? 1000.0,
      azimuthStepDeg: req.azimuthStepDeg ?? 5.0,
    });
    const horizonSamples = horizonProfile.samples;

    // 3. Compute surface normal once for the site
    const surfaceNormalAnalysis = await SurfaceNormalService.analyzeSurface(demProvider, {
      latitudeDeg: req.siteCoords.latitudeDeg,
      longitudeDeg: req.siteCoords.longitudeDeg,
      observerHeightMeters: observerHeight,
    });
    const surfaceNormalEnu = surfaceNormalAnalysis.surfaceNormalEnu;

    const effectiveSiteCoords = {
      ...req.siteCoords,
      elevationMeters:
        req.siteCoords.elevationMeters ??
        horizonProfile.siteCoordinates.surfaceElevationMeters ??
        0.0,
    };

    // State evaluation helper for a single timestamp
    const evaluatePoint = async (epochUtc: string): Promise<SampledTimeSeriesPoint> => {
      const [sunEphem, earthEphem] = await Promise.all([
        ephemerisProvider.calculateTarget({
          target: 'SUN',
          epochUtc,
          siteCoords: effectiveSiteCoords,
          observerHeightMeters: observerHeight,
        }),
        ephemerisProvider.calculateTarget({
          target: 'EARTH',
          epochUtc,
          siteCoords: effectiveSiteCoords,
          observerHeightMeters: observerHeight,
        }),
      ]);

      const sunVis = TerrainVisibilityService.evaluateTargetVisibility(
        sunEphem.azimuthDeg,
        sunEphem.elevationDeg,
        horizonSamples
      );

      const earthVis = TerrainVisibilityService.evaluateTargetVisibility(
        earthEphem.azimuthDeg,
        earthEphem.elevationDeg,
        horizonSamples
      );

      const sunFacing = SolarIncidenceService.calculateSolarIncidence(
        surfaceNormalEnu,
        sunEphem.azimuthDeg,
        sunEphem.elevationDeg
      );

      const sunVisible = sunVis.clearanceDeg > solarMarginDeg && sunFacing.isFacingSun;
      const earthVisible = earthVis.clearanceDeg > earthMarginDeg;
      const bothVisible = sunVisible && earthVisible;

      return {
        epochUtc,
        sun: {
          azimuthDeg: sunEphem.azimuthDeg,
          elevationDeg: sunEphem.elevationDeg,
          horizonDeg: sunVis.horizonElevationDeg,
          clearanceDeg: sunVis.clearanceDeg,
          isFacingSun: sunFacing.isFacingSun,
          isVisible: sunVisible,
        },
        earth: {
          azimuthDeg: earthEphem.azimuthDeg,
          elevationDeg: earthEphem.elevationDeg,
          horizonDeg: earthVis.horizonElevationDeg,
          clearanceDeg: earthVis.clearanceDeg,
          isVisible: earthVisible,
        },
        bothVisible,
      };
    };

    // 4. Sample all timestamps
    const timeSeriesPoints: SampledTimeSeriesPoint[] = [];
    for (const ts of timestamps) {
      const pt = await evaluatePoint(ts);
      timeSeriesPoints.push(pt);
    }

    // 5. Extract continuous windows with boundary refinement
    const buildWindowsForTarget = async (
      targetType: 'SUN' | 'EARTH' | 'BOTH',
      isPointActive: (pt: SampledTimeSeriesPoint) => boolean,
      evaluator: (epoch: string) => Promise<boolean>
    ): Promise<VisibilityWindow[]> => {
      const windows: VisibilityWindow[] = [];
      let inWindow = false;
      let windowStart = '';

      for (let i = 0; i < timeSeriesPoints.length; i++) {
        const pt = timeSeriesPoints[i];
        const active = isPointActive(pt);

        if (active && !inWindow) {
          // Transition: Inactive -> Active
          inWindow = true;
          if (i > 0) {
            // Refine start boundary between i-1 and i
            windowStart = await BoundaryRefinementService.refineTransitionBoundary(
              timeSeriesPoints[i - 1].epochUtc,
              pt.epochUtc,
              evaluator,
              boundaryToleranceSeconds
            );
          } else {
            windowStart = pt.epochUtc;
          }
        } else if (!active && inWindow) {
          // Transition: Active -> Inactive
          inWindow = false;
          let windowEnd = pt.epochUtc;
          if (i > 0) {
            windowEnd = await BoundaryRefinementService.refineTransitionBoundary(
              timeSeriesPoints[i - 1].epochUtc,
              pt.epochUtc,
              evaluator,
              boundaryToleranceSeconds
            );
          }

          const durSec = (new Date(windowEnd).getTime() - new Date(windowStart).getTime()) / 1000;
          if (durSec > 0) {
            windows.push({
              target: targetType,
              startUtc: windowStart,
              endUtc: windowEnd,
              durationSeconds: durSec,
              durationHours: roundToPrecision(secondsToHours(durSec), 4),
              boundaryRefined: true,
              confidence: 'HIGH',
            });
          }
        }
      }

      // If active at the end of the interval
      if (inWindow) {
        const windowEnd = timeSeriesPoints[timeSeriesPoints.length - 1].epochUtc;
        const durSec = (new Date(windowEnd).getTime() - new Date(windowStart).getTime()) / 1000;
        if (durSec > 0) {
          windows.push({
            target: targetType,
            startUtc: windowStart,
            endUtc: windowEnd,
            durationSeconds: durSec,
            durationHours: roundToPrecision(secondsToHours(durSec), 4),
            boundaryRefined: false,
            confidence: 'APPROXIMATE',
          });
        }
      }

      return windows;
    };

    const sunEvaluator = async (t: string): Promise<boolean> => {
      const pt = await evaluatePoint(t);
      return pt.sun.isVisible;
    };

    const earthEvaluator = async (t: string): Promise<boolean> => {
      const pt = await evaluatePoint(t);
      return pt.earth.isVisible;
    };

    const bothEvaluator = async (t: string): Promise<boolean> => {
      const pt = await evaluatePoint(t);
      return pt.bothVisible;
    };

    const [sunWindows, earthWindows, bothWindows] = await Promise.all([
      buildWindowsForTarget('SUN', (pt) => pt.sun.isVisible, sunEvaluator),
      buildWindowsForTarget('EARTH', (pt) => pt.earth.isVisible, earthEvaluator),
      buildWindowsForTarget('BOTH', (pt) => pt.bothVisible, bothEvaluator),
    ]);

    // 6. Summary durations and metrics
    const totalMissionHours = secondsToHours(totalIntervalSeconds);

    const sumDurationsHours = (wins: VisibilityWindow[]) =>
      wins.reduce((sum, w) => sum + w.durationHours, 0);

    const longestDurationHours = (wins: VisibilityWindow[]) =>
      wins.length > 0 ? Math.max(...wins.map((w) => w.durationHours)) : 0.0;

    const sunlightTotalHours = roundToPrecision(sumDurationsHours(sunWindows), 4);
    const earthVisibilityTotalHours = roundToPrecision(sumDurationsHours(earthWindows), 4);
    const bothVisibilityTotalHours = roundToPrecision(sumDurationsHours(bothWindows), 4);

    return {
      siteCoords: req.siteCoords,
      missionInterval: {
        startUtc: req.startTimeUtc,
        endUtc: req.endTimeUtc,
        totalDurationHours: roundToPrecision(totalMissionHours, 4),
        stepSeconds,
        totalSampleCount: timeSeriesPoints.length,
      },
      windows: {
        sunWindows,
        earthWindows,
        bothWindows,
      },
      summary: {
        sunlightTotalHours,
        sunlightPercentage: roundToPrecision((sunlightTotalHours / totalMissionHours) * 100, 2),
        longestSunlightContinuousHours: roundToPrecision(longestDurationHours(sunWindows), 4),
        earthVisibilityTotalHours,
        earthVisibilityPercentage: roundToPrecision(
          (earthVisibilityTotalHours / totalMissionHours) * 100,
          2
        ),
        longestEarthVisibilityContinuousHours: roundToPrecision(
          longestDurationHours(earthWindows),
          4
        ),
        bothVisibilityTotalHours,
        bothVisibilityPercentage: roundToPrecision(
          (bothVisibilityTotalHours / totalMissionHours) * 100,
          2
        ),
        longestBothContinuousHours: roundToPrecision(longestDurationHours(bothWindows), 4),
      },
      timeSeries: includeTimeSeries ? timeSeriesPoints : undefined,
      metadata: {
        ephemerisProvider: ephemerisProvider.name,
        terrainDataset: horizonProfile.demMetadata.source,
        boundaryToleranceSeconds,
        refinementMethod: 'BISECTION_NUMERICAL_REFINEMENT',
        assumptions: [
          'Point-source direct illumination model',
          'Geometric line-of-sight terrain obstruction',
          'Local East-North-Up coordinate transformation with selenocentric Moon-fixed frame',
        ],
      },
    };
  }
}
