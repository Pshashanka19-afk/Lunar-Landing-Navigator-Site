import { IEphemerisProvider, EphemerisCalculationResult } from '../ephemeris/ephemeris.interface';
import { IDemProvider } from '../terrain/dem.interface';
import { HorizonProfileService } from '../terrain/horizon-profile.service';
import { SurfaceNormalService } from '../terrain/surface-normal.service';
import { TerrainVisibilityService } from '../terrain/terrain-visibility.service';
import { SolarIncidenceService } from '../illumination/solar-incidence.service';
import { LunarSiteCoordinates } from '../coordinates/lunar-frame.service';
import { ThermalModelService, ThermalParameters } from '../thermal/thermal-model.service';
import { Vector3D } from '../../utils/vectors';
import { generateTimeGrid } from '../../utils/time';
import { radToDeg } from '../../utils/angles';
import { roundToPrecision } from '../../utils/units';
import { ComputationLimitExceededError, ScientificValidationError } from '../../types/errors';

export type SeriesComponent = 'moon' | 'sunlight' | 'temperature';

export type SeriesIlluminationStatus =
  | 'ILLUMINATED'
  | 'SHADOWED_BY_TERRAIN'
  | 'SELF_SHADOWED'
  | 'BLOCKED_AND_SELF_SHADOWED';

/** Optional capability: only the SPICE provider implements this. */
interface MoonJ2000Capable {
  computeMoonFromEarthJ2000(etSeconds: number): Promise<Vector3D>;
}

function hasMoonJ2000(p: IEphemerisProvider): p is IEphemerisProvider & MoonJ2000Capable {
  return typeof (p as unknown as MoonJ2000Capable).computeMoonFromEarthJ2000 === 'function';
}

export interface SiteSeriesRequest {
  siteCoords: LunarSiteCoordinates;
  startTimeUtc: string;
  endTimeUtc: string;
  stepSeconds: number;
  include: SeriesComponent[];
  observerHeightMeters?: number;
  searchRadiusMeters?: number;
  azimuthStepDeg?: number;
  thermal?: Partial<ThermalParameters>;
}

export interface MoonSeriesData {
  /** Earth-Moon centre-to-centre distance (km) */
  earthMoonDistanceKm: number;
  /** Earth position relative to the Moon centre, MOON_ME frame (km) */
  earthFromMoonCentreMeKm: Vector3D;
  /** Sub-Earth point on the Moon (selenographic; shows libration) */
  subEarthPoint: { latitudeDeg: number; longitudeDeg: number };
  /** Sub-solar point on the Moon (selenographic; shows where the Sun is overhead) */
  subSolarPoint: { latitudeDeg: number; longitudeDeg: number };
  /** Moon position relative to Earth in J2000 (km). Null unless the SPICE provider is used. */
  earthToMoonJ2000Km: Vector3D | null;
}

export interface SunlightSeriesData {
  sunAzimuthDeg: number;
  sunElevationDeg: number;
  terrainHorizonDeg: number;
  clearanceDeg: number;
  incidenceAngleDeg: number;
  illuminationStatus: SeriesIlluminationStatus;
  isDirectlyIlluminated: boolean;
}

export interface TemperatureSeriesData {
  surfaceTemperatureK: number;
  surfaceTemperatureC: number;
  solarFluxWm2: number;
  regime: 'SUNLIT' | 'NIGHT_OR_SHADOW';
}

export interface SiteSeriesPoint {
  epochUtc: string;
  moon?: MoonSeriesData;
  sunlight?: SunlightSeriesData;
  temperature?: TemperatureSeriesData;
}

export interface SiteSeriesResult {
  siteCoords: LunarSiteCoordinates;
  interval: {
    startUtc: string;
    endUtc: string;
    stepSeconds: number;
    sampleCount: number;
  };
  included: SeriesComponent[];
  series: SiteSeriesPoint[];
  summary: {
    sunlit?: {
      litSampleCount: number;
      litPercentage: number;
      /** Quantised to stepSeconds; not boundary-refined */
      longestContinuousSunlightHours: number;
      longestContinuousDarknessHours: number;
    };
    temperature?: {
      minK: number;
      maxK: number;
      meanK: number;
    };
    moon?: {
      minEarthMoonDistanceKm: number;
      maxEarthMoonDistanceKm: number;
    };
  };
  metadata: {
    ephemeris: {
      providerName: string;
      ephemerisModel: string;
      kernels?: string[];
      referenceFrame: string;
      aberrationCorrection: string;
    };
    terrainDataset: string | null;
    thermalModel: (ThermalParameters & { description: string }) | null;
    assumptions: string[];
  };
}

function selenographic(v: Vector3D): { latitudeDeg: number; longitudeDeg: number } {
  const r = Math.hypot(v.x, v.y, v.z);
  if (!(r > 0)) {
    throw new ScientificValidationError('Zero-length vector cannot define a sub-point');
  }
  const latitudeDeg = radToDeg(Math.asin(Math.max(-1, Math.min(1, v.z / r))));
  let longitudeDeg = radToDeg(Math.atan2(v.y, v.x));
  if (longitudeDeg > 180) longitudeDeg -= 360;
  if (longitudeDeg <= -180) longitudeDeg += 360;
  return {
    latitudeDeg: roundToPrecision(latitudeDeg, 4),
    longitudeDeg: roundToPrecision(longitudeDeg, 4),
  };
}

function toKm(v: Vector3D): Vector3D {
  return {
    x: roundToPrecision(v.x / 1000.0, 3),
    y: roundToPrecision(v.y / 1000.0, 3),
    z: roundToPrecision(v.z / 1000.0, 3),
  };
}

export class SiteSeriesService {
  public static readonly MAX_ALLOWED_SAMPLES = 5000;

  public static async calculateSeries(
    ephemerisProvider: IEphemerisProvider,
    demProvider: IDemProvider,
    req: SiteSeriesRequest
  ): Promise<SiteSeriesResult> {
    const startMs = new Date(req.startTimeUtc).getTime();
    const endMs = new Date(req.endTimeUtc).getTime();
    if (isNaN(startMs) || isNaN(endMs)) {
      throw new ScientificValidationError('Invalid start or end time ISO string');
    }
    if (startMs >= endMs) {
      throw new ScientificValidationError('Start time must be strictly before end time');
    }

    const include = Array.from(new Set(req.include));
    if (include.length === 0) {
      throw new ScientificValidationError('include must contain at least one of: moon, sunlight, temperature');
    }
    const wantMoon = include.includes('moon');
    const wantSunlight = include.includes('sunlight');
    const wantTemperature = include.includes('temperature');
    const needSunGeometry = wantSunlight || wantTemperature;

    const estimated = Math.ceil((endMs - startMs) / 1000 / req.stepSeconds) + 1;
    if (estimated > this.MAX_ALLOWED_SAMPLES) {
      throw new ComputationLimitExceededError(
        `Requested interval with step ${req.stepSeconds}s results in ${estimated} samples, exceeding the maximum of ${this.MAX_ALLOWED_SAMPLES}. Increase stepSeconds or narrow the interval.`
      );
    }

    const observerHeight = req.observerHeightMeters ?? 2.0;
    const thermalParams = wantTemperature ? ThermalModelService.resolveParameters(req.thermal) : null;
    const timestamps = generateTimeGrid(req.startTimeUtc, req.endTimeUtc, req.stepSeconds);

    // Terrain products are computed once per site, not per time step.
    let horizonSamples: Awaited<ReturnType<typeof HorizonProfileService.calculateHorizonProfile>>['samples'] = [];
    let terrainDataset: string | null = null;
    let surfaceNormalEnu: Vector3D | null = null;
    if (needSunGeometry) {
      const horizonProfile = await HorizonProfileService.calculateHorizonProfile(demProvider, {
        latitudeDeg: req.siteCoords.latitudeDeg,
        longitudeDeg: req.siteCoords.longitudeDeg,
        observerHeightMeters: observerHeight,
        searchRadiusMeters: req.searchRadiusMeters ?? 1000.0,
        azimuthStepDeg: req.azimuthStepDeg ?? 5.0,
      });
      horizonSamples = horizonProfile.samples;
      terrainDataset = horizonProfile.demMetadata.source;

      const surface = await SurfaceNormalService.analyzeSurface(demProvider, {
        latitudeDeg: req.siteCoords.latitudeDeg,
        longitudeDeg: req.siteCoords.longitudeDeg,
        observerHeightMeters: observerHeight,
      });
      surfaceNormalEnu = surface.surfaceNormalEnu;
    }

    const series: SiteSeriesPoint[] = [];
    let provenanceSource: EphemerisCalculationResult | null = null;

    for (const epochUtc of timestamps) {
      const point: SiteSeriesPoint = { epochUtc };

      let sunEphem: EphemerisCalculationResult | null = null;
      if (wantMoon || needSunGeometry) {
        sunEphem = await ephemerisProvider.calculateTarget({
          target: 'SUN',
          epochUtc,
          siteCoords: req.siteCoords,
          observerHeightMeters: observerHeight,
        });
        provenanceSource = provenanceSource ?? sunEphem;
      }

      if (wantMoon && sunEphem) {
        const earthEphem = await ephemerisProvider.calculateTarget({
          target: 'EARTH',
          epochUtc,
          siteCoords: req.siteCoords,
          observerHeightMeters: observerHeight,
        });
        const earthVec = earthEphem.targetPositionMoonCenteredME;
        const sunVec = sunEphem.targetPositionMoonCenteredME;

        let earthToMoonJ2000Km: Vector3D | null = null;
        if (hasMoonJ2000(ephemerisProvider)) {
          earthToMoonJ2000Km = toKm(await ephemerisProvider.computeMoonFromEarthJ2000(earthEphem.ephemerisTimeSeconds));
        }

        point.moon = {
          earthMoonDistanceKm: roundToPrecision(Math.hypot(earthVec.x, earthVec.y, earthVec.z) / 1000.0, 3),
          earthFromMoonCentreMeKm: toKm(earthVec),
          subEarthPoint: selenographic(earthVec),
          subSolarPoint: selenographic(sunVec),
          earthToMoonJ2000Km,
        };
      }

      if (needSunGeometry && sunEphem && surfaceNormalEnu) {
        const vis = TerrainVisibilityService.evaluateTargetVisibility(
          sunEphem.azimuthDeg,
          sunEphem.elevationDeg,
          horizonSamples
        );
        const incidence = SolarIncidenceService.calculateSolarIncidence(
          surfaceNormalEnu,
          sunEphem.azimuthDeg,
          sunEphem.elevationDeg
        );

        const sunClears = vis.clearanceDeg > 0;
        const facing = incidence.isFacingSun;
        const status: SeriesIlluminationStatus =
          sunClears && facing
            ? 'ILLUMINATED'
            : !sunClears && facing
              ? 'SHADOWED_BY_TERRAIN'
              : sunClears && !facing
                ? 'SELF_SHADOWED'
                : 'BLOCKED_AND_SELF_SHADOWED';
        const lit = status === 'ILLUMINATED';

        if (wantSunlight) {
          point.sunlight = {
            sunAzimuthDeg: roundToPrecision(sunEphem.azimuthDeg, 4),
            sunElevationDeg: roundToPrecision(sunEphem.elevationDeg, 4),
            terrainHorizonDeg: roundToPrecision(vis.horizonElevationDeg, 4),
            clearanceDeg: roundToPrecision(vis.clearanceDeg, 4),
            incidenceAngleDeg: roundToPrecision(incidence.incidenceAngleDeg, 4),
            illuminationStatus: status,
            isDirectlyIlluminated: lit,
          };
        }

        if (wantTemperature && thermalParams) {
          const t = ThermalModelService.calculateSurfaceTemperature(
            {
              sunDistanceMeters: sunEphem.distanceMeters,
              cosineIncidence: incidence.cosineIncidenceAngle,
              isDirectlyIlluminated: lit,
            },
            thermalParams
          );
          point.temperature = {
            surfaceTemperatureK: roundToPrecision(t.surfaceTemperatureK, 2),
            surfaceTemperatureC: roundToPrecision(t.surfaceTemperatureC, 2),
            solarFluxWm2: roundToPrecision(t.solarFluxWm2, 2),
            regime: t.regime,
          };
        }
      }

      series.push(point);
    }

    return {
      siteCoords: req.siteCoords,
      interval: {
        startUtc: new Date(startMs).toISOString(),
        endUtc: new Date(endMs).toISOString(),
        stepSeconds: req.stepSeconds,
        sampleCount: series.length,
      },
      included: include,
      series,
      summary: this.summarize(series, req.stepSeconds, wantSunlight, wantTemperature, wantMoon),
      metadata: {
        ephemeris: {
          providerName: ephemerisProvider.name,
          ephemerisModel: provenanceSource?.provenance.ephemerisModel ?? 'n/a',
          kernels: provenanceSource?.provenance.kernels,
          referenceFrame: provenanceSource?.provenance.referenceFrame ?? 'n/a',
          aberrationCorrection: provenanceSource?.provenance.aberrationCorrection ?? 'n/a',
        },
        terrainDataset,
        thermalModel: thermalParams
          ? {
              ...thermalParams,
              description:
                'First-order radiative-equilibrium model (modelled, not measured). Ignores thermal inertia and subsurface conduction.',
            }
          : null,
        assumptions: [
          'Illumination is direct geometric line of sight: Sun above the DEM horizon and surface facing the Sun',
          'Sunlight run lengths are quantised to stepSeconds and not boundary-refined; use /windows/calculate for refined windows',
          'Temperature is a modelled value; permanently shadowed regions and polar nights are far colder than the default night temperature, so override nightTemperatureK for polar sites',
          'earthToMoonJ2000Km is only available with the SPICE provider (null otherwise)',
        ],
      },
    };
  }

  private static summarize(
    series: SiteSeriesPoint[],
    stepSeconds: number,
    wantSunlight: boolean,
    wantTemperature: boolean,
    wantMoon: boolean
  ): SiteSeriesResult['summary'] {
    const summary: SiteSeriesResult['summary'] = {};

    if (wantSunlight) {
      let lit = 0;
      let runLit = 0;
      let runDark = 0;
      let maxLit = 0;
      let maxDark = 0;
      for (const p of series) {
        if (p.sunlight?.isDirectlyIlluminated) {
          lit++;
          runLit++;
          runDark = 0;
          maxLit = Math.max(maxLit, runLit);
        } else {
          runDark++;
          runLit = 0;
          maxDark = Math.max(maxDark, runDark);
        }
      }
      summary.sunlit = {
        litSampleCount: lit,
        litPercentage: roundToPrecision((100.0 * lit) / series.length, 2),
        longestContinuousSunlightHours: roundToPrecision((maxLit * stepSeconds) / 3600.0, 3),
        longestContinuousDarknessHours: roundToPrecision((maxDark * stepSeconds) / 3600.0, 3),
      };
    }

    if (wantTemperature) {
      const temps = series.map((p) => p.temperature?.surfaceTemperatureK ?? NaN).filter((t) => Number.isFinite(t));
      if (temps.length > 0) {
        summary.temperature = {
          minK: Math.min(...temps),
          maxK: Math.max(...temps),
          meanK: roundToPrecision(temps.reduce((a, b) => a + b, 0) / temps.length, 2),
        };
      }
    }

    if (wantMoon) {
      const d = series.map((p) => p.moon?.earthMoonDistanceKm ?? NaN).filter((x) => Number.isFinite(x));
      if (d.length > 0) {
        summary.moon = {
          minEarthMoonDistanceKm: Math.min(...d),
          maxEarthMoonDistanceKm: Math.max(...d),
        };
      }
    }

    return summary;
  }
}
