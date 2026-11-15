/**
 * CLPS Lunar Mission Browser API Client
 * Connects frontend to the Express/TypeScript NASA SPICE & LOLA DEM backend.
 */

const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT;
const BACKEND_HOST = import.meta.env.VITE_BACKEND_HOST;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export const DIRECT_BACKEND_ORIGIN =
  BACKEND_URL || (BACKEND_PORT ? `http://${BACKEND_HOST || '127.0.0.1'}:${BACKEND_PORT}` : '');

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';
const DIRECT_API_BASE = DIRECT_BACKEND_ORIGIN ? `${DIRECT_BACKEND_ORIGIN}${API_BASE}` : API_BASE;

export interface MoonTrekLayerMetadata {
  id: string;
  title: string;
  description: string;
  projection: 'EQ' | 'SP' | 'NP';
  crs: string;
  format: 'image/jpeg' | 'image/png';
  tileMatrixSet: string;
  minZoom: number;
  maxZoom: number;
  resolutionMpp: number;
  wmtsEndpoint: string;
  tileUrlTemplate: string;
  localFallbackUrl?: string;
  bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  instrument: string;
  mission: string;
  attribution: string;
  isElevationOrShade: boolean;
}

export interface BackendHealth {
  status: string;
  service: string;
  version: string;
  uptimeSeconds: number;
}

export interface ScienceHealth {
  ephemeris: {
    activeDefaultProvider: string;
    spice: {
      ready: boolean;
      message: string;
      availableKernelsCount: number;
      missingKernelsCount: number;
    };
    analytical: {
      ready: boolean;
      message: string;
      model: string;
    };
  };
  terrainDem: {
    ready: boolean;
    datasetId: string;
    datasetSource: string;
    isSynthetic: boolean;
  };
  operationalMode: string;
}

export interface SkyTargetGeometry {
  azimuthDeg: number;
  elevationDeg: number;
  distanceMeters: number;
  targetPositionMoonCenteredME?: { x: number; y: number; z: number };
  targetVelocityMoonCenteredME?: { x: number; y: number; z: number };
  topocentricVectorME?: { x: number; y: number; z: number };
  earthRotationAngleDeg?: number;
  localEnuVector?: { x: number; y: number; z: number };
  provenance: {
    providerName: string;
    ephemerisModel: string;
    kernels?: string[];
    aberrationCorrection: string;
    referenceFrame: string;
    timeStandard: string;
  };
}

export interface SkyGeometryResponse {
  site: {
    latitudeDeg: number;
    longitudeDeg: number;
    elevationMeters?: number;
  };
  epochUtc: string;
  sun: SkyTargetGeometry;
  earth: SkyTargetGeometry;
  units: {
    angles: string;
    distance: string;
  };
  frame: string;
  referenceFrame: string;
}

export interface HorizonSample {
  azimuthDeg: number;
  horizonElevationDeg: number;
  obstacleDistanceMeters: number;
  obstacleElevationMeters: number;
}

export interface HorizonProfileResponse {
  siteCoordinates: {
    latitudeDeg: number;
    longitudeDeg: number;
    surfaceElevationMeters: number;
    observerHeightMeters: number;
  };
  searchRadiusMeters: number;
  azimuthStepDeg: number;
  radialStepMeters: number;
  samples: HorizonSample[];
  minHorizonElevationDeg: number;
  maxHorizonElevationDeg: number;
  meanHorizonElevationDeg: number;
  coverageStatus: string;
}

export interface SurfaceNormalResponse {
  elevationMeters: number;
  surfaceNormalEnu: { x: number; y: number; z: number };
  slopeDeg: number;
  aspectDeg: number;
  gradient: { dzdx: number; dzdy: number };
  isFlat: boolean;
}

export interface SiteAnalysisData {
  site: {
    id: string;
    name: string;
    latitudeDeg: number;
    longitudeDeg: number;
    elevationMeters: number;
    observerHeightMeters?: number;
    projectedX?: number;
    projectedY?: number;
    isDemCovered: boolean;
  };
  terrain: {
    elevationMeters: number;
    slopeDeg: number;
    aspectDeg: number;
    surfaceNormalEnu: { x: number; y: number; z: number };
    source: string;
  };
  sun: {
    azimuthDeg: number;
    elevationDeg: number;
    distanceKm: number;
    targetPositionMoonCenteredME?: { x: number; y: number; z: number };
    targetVelocityMoonCenteredME?: { x: number; y: number; z: number };
    topocentricVectorME?: { x: number; y: number; z: number };
    horizonElevationDeg: number;
    clearanceDeg: number;
    isDirectlyVisible: boolean;
    incidenceAngleDeg: number;
    relativeIncidenceFactor: number;
  };
  earth: {
    azimuthDeg: number;
    elevationDeg: number;
    distanceKm: number;
    targetPositionMoonCenteredME?: { x: number; y: number; z: number };
    targetVelocityMoonCenteredME?: { x: number; y: number; z: number };
    topocentricVectorME?: { x: number; y: number; z: number };
    earthRotationAngleDeg?: number;
    horizonElevationDeg: number;
    clearanceDeg: number;
    isDirectlyVisible: boolean;
  };
  next24HoursSummary?: {
    sunlightTotalHours: number;
    sunlightPercentage: number;
    earthVisibilityTotalHours: number;
    earthVisibilityPercentage: number;
    bothVisibilityTotalHours: number;
  };
}

export interface DemonstrationLandingSite {
  id: string;
  name: string;
  latitudeDeg: number;
  longitudeDeg: number;
  elevationMeters: number;
  targetRegion: string;
  description: string;
  scientificInterest: string[];
  siteType?: 'candidate_region' | 'proposed_landing_site' | 'clps_touchdown' | 'historical_reference';
  source?: string;
  coordinateReference?: string;
  uncertaintyKm?: number;
}

export interface IlluminationEvaluationRequest {
  siteId?: string;
  latitude?: number;
  longitude?: number;
  elevationMeters?: number;
  observerHeightMeters?: number;
  timestamp: string;
}

export interface IlluminationEvaluationData {
  siteId: string;
  siteName: string;
  siteType: string;
  latitude: number;
  longitude: number;
  elevationMeters: number;
  slopeDeg: number;
  aspectDeg: number;
  timestamp: string;
  dataSource: string;
  isIlluminated: boolean;
  illuminationStatus: string;
  solarElevationDeg: number;
  solarAzimuthDeg: number;
  horizonElevationDeg: number;
  horizonClearanceDeg: number;
  incidenceAngleDeg: number;
  relativeIncidenceFactor: number;
  continuousSunlightHours: number;
  sunriseUtc: string | null;
  sunsetUtc: string | null;
}

export interface WindowsCalculationSummary {
  sunlightTotalHours: number;
  sunlightPercentage: number;
  longestSunlightContinuousHours: number;
  earthVisibilityTotalHours: number;
  earthVisibilityPercentage: number;
  longestEarthVisibilityContinuousHours: number;
  bothVisibilityTotalHours: number;
  bothVisibilityPercentage: number;
  longestBothContinuousHours: number;
}

export interface WindowTimeSeriesSample {
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

export interface WindowsCalculationResponse {
  siteCoords?: {
    latitudeDeg: number;
    longitudeDeg: number;
    observerHeightMeters?: number;
  };
  site?: {
    latitudeDeg: number;
    longitudeDeg: number;
  };
  missionInterval?: {
    startUtc: string;
    endUtc: string;
    totalDurationHours: number;
    stepSeconds: number;
    totalSampleCount: number;
  };
  interval?: {
    startTimeUtc: string;
    endTimeUtc: string;
    durationDays: number;
  };
  windows?: {
    sunWindows: Array<{ target?: string; startUtc: string; endUtc: string; durationHours?: number; durationSeconds?: number }>;
    earthWindows: Array<{ target?: string; startUtc: string; endUtc: string; durationHours?: number; durationSeconds?: number }>;
    bothWindows: Array<{ target?: string; startUtc: string; endUtc: string; durationHours?: number; durationSeconds?: number }>;
  };
  sunlightWindows?: Array<{ startUtc: string; endUtc: string; durationHours: number }>;
  earthVisibilityWindows?: Array<{ startUtc: string; endUtc: string; durationHours: number }>;
  bothWindows?: Array<{ startUtc: string; endUtc: string; durationHours: number }>;
  summary: WindowsCalculationSummary;
  metadata?: {
    ephemerisProvider?: string;
    terrainDataset?: string;
    refinementMethod?: string;
    assumptions?: string[];
  };
  timeSeries?: Array<WindowTimeSeriesSample>;
}

export interface SiteComparisonRequestParams {
  sites: Array<{ id?: string; name?: string; latitudeDeg: number; longitudeDeg: number; elevationMeters?: number }>;
  requirements: {
    minSunlightHours?: number;
    minContinuousSunlightHours?: number;
    minEarthVisibilityHours?: number;
    minSimultaneousSunEarthHours?: number;
    maxSlopeDeg?: number;
    weights?: {
      sunlightDuration?: number;
      continuousSunlight?: number;
      earthVisibility?: number;
      slopeFlatness?: number;
    };
  };
  startTimeUtc: string;
  endTimeUtc: string;
  stepSeconds?: number;
  ephemerisProvider?: 'spice' | 'analytical' | 'mock';
  demProvider?: 'geotiff' | 'synthetic';
}

export interface SiteComparisonItem {
  site: {
    id: string;
    name: string;
    latitudeDeg: number;
    longitudeDeg: number;
    elevationMeters: number;
  };
  metrics: {
    slopeDeg: number;
    elevationMeters: number;
    aspectDeg: number;
    sunlightTotalHours: number;
    longestSunlightContinuousHours: number;
    earthVisibilityTotalHours: number;
    longestEarthContinuousHours: number;
    bothVisibilityTotalHours: number;
  };
  requirementChecks: Array<{
    requirementName: string;
    requiredValue: number;
    actualValue: number;
    unit: string;
    status: 'PASS' | 'FAIL' | 'UNKNOWN';
    details: string;
  }>;
  overallStatus: 'ALL_PASSED' | 'CONSTRAINTS_VIOLATED' | 'INCOMPLETE_DATA';
  score?: number;
  scoreBreakdown?: Record<string, number>;
  reasons: string[];
  limitations: string[];
}

export interface SiteComparisonResponse {
  interval: {
    startUtc: string;
    endUtc: string;
    durationHours: number;
  };
  requirementsApplied: {
    minSunlightHours?: number;
    minContinuousSunlightHours?: number;
    minEarthVisibilityHours?: number;
    minSimultaneousSunEarthHours?: number;
    maxSlopeDeg?: number;
    weights?: Record<string, number>;
  };
  sites: SiteComparisonItem[];
  ranking: string[];
  disclaimer: string;
}

export interface InstantIlluminationResponse {
  illuminationStatus: 'ILLUMINATED' | 'SHADOWED_BY_TERRAIN' | 'SELF_SHADOWED' | 'BLOCKED_AND_SELF_SHADOWED' | 'UNKNOWN';
  isDirectlyIlluminated: boolean;
  conditions: {
    sunClearsHorizon: boolean;
    surfaceFacesSun: boolean;
  };
  surfaceOrientation: {
    incidenceAngleDeg: number;
    mu: number;
    directFluxWattsPerM2: number;
  };
}

export interface MissionAssessmentResponse {
  site: {
    latitudeDeg: number;
    longitudeDeg: number;
    elevationMeters: number;
  };
  interval: {
    startUtc: string;
    endUtc: string;
    durationHours: number;
  };
  thresholdsApplied: {
    minSolarElevationDeg: number;
    minSunlightDurationHours: number;
    minEarthElevationDeg: number;
    minCommWindowHours: number;
    maxSlopeDeg: number;
  };
  finalAssessment: {
    status: 'FEASIBLE' | 'MARGINAL' | 'UNFAVORABLE' | 'UNFEASIBLE';
    score: number;
    reasons: string[];
  };
  powerAssessment: {
    maxSolarElevationDeg: number;
    minSolarElevationDeg: number;
    sunlightTotalHours: number;
    sunlightPercentage: number;
    longestContinuousSunlightHours: number;
    solarWindowsCount?: number;
    relativeGeometricIncidenceFactor: number;
    hardwareDisclaimer?: string;
  };
  communicationAssessment: {
    earthVisibilityTotalHours: number;
    earthVisibilityPercentage: number;
    longestContinuousEarthHours: number;
    terrainOcclusionHours: number;
    communicationWindowsCount?: number;
  };
  terrainParameters: {
    elevationMeters: number;
    slopeDeg: number;
    aspectDeg: number;
    source: string;
  };
  executionTimeMs?: number;
}

export interface TimelinePoint {
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

export interface DayMetric {
  dayIndex: number;
  startUtc: string;
  endUtc: string;
  sunlightHours: number;
  earthVisibilityHours: number;
  simultaneousHours: number;
  maxSolarElevationDeg: number;
}

export interface TimelineResponse {
  site: {
    latitudeDeg: number;
    longitudeDeg: number;
    elevationMeters: number;
  };
  startTimeUtc: string;
  endTimeUtc: string;
  durationHours: number;
  stepSeconds: number;
  pointCount: number;
  timelinePoints: TimelinePoint[];
  dayMetrics: DayMetric[];
  summary: WindowsCalculationSummary;
  executionTimeMs?: number;
}

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  let serverError: Error | null = null;

  // First try relative URL (proxied by Vite dev server to backend)
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    if (res.ok) {
      const json = await res.json();
      return json.data !== undefined ? json.data : json;
    }
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody.error?.message || errBody.message || `HTTP ${res.status}: Failed request to ${endpoint}`;
    serverError = new Error(msg);
    // If it's a 4xx client/validation response from the backend, don't repeat the exact same failing payload
    if (res.status >= 400 && res.status < 500) {
      throw serverError;
    }
  } catch (err: any) {
    if (serverError) throw serverError;
    // Proxy or network unreachable - fall through to direct connection configured in .env
  }

  const directRes = await fetch(`${DIRECT_API_BASE}${endpoint}`, options);
  if (!directRes.ok) {
    const errorBody = await directRes.json().catch(() => ({}));
    const msg = errorBody.error?.message || errorBody.message || `HTTP ${directRes.status}: Failed request to ${endpoint}`;
    throw new Error(msg);
  }
  const json = await directRes.json();
  return json.data !== undefined ? json.data : json;
}

export const lunarApi = {
  /**
   * Health and service diagnostics
   */
  async checkHealth(): Promise<BackendHealth> {
    return apiFetch<BackendHealth>('/health');
  },

  /**
   * Detailed scientific readiness: SPICE kernel validation and LOLA DEM status
   */
  async checkScienceHealth(): Promise<ScienceHealth> {
    return apiFetch<ScienceHealth>('/health/science');
  },

  /**
   * Calculate topocentric Sun and Earth azimuth, elevation, and distance
   */
  async getSkyGeometry(params: {
    latitudeDeg: number;
    longitudeDeg: number;
    epochUtc: string;
    elevationMeters?: number;
    observerHeightMeters?: number;
  }): Promise<SkyGeometryResponse> {
    return apiFetch<SkyGeometryResponse>('/geometry/sky', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        epochUtc: params.epochUtc,
        site: {
          latitudeDeg: params.latitudeDeg,
          longitudeDeg: params.longitudeDeg,
          elevationMeters: params.elevationMeters ?? 0,
        },
        observerHeightMeters: params.observerHeightMeters ?? 2.0,
      }),
    });
  },

  /**
   * Retrieve default lunar landing sites
   */
  async getDefaultSites(): Promise<DemonstrationLandingSite[]> {
    try {
      const missionRes: any = await apiFetch<any>('/mission/candidate-sites');
      if (missionRes && Array.isArray(missionRes.candidateSites)) {
        return missionRes.candidateSites;
      }
    } catch {
      // fallback to legacy
    }
    const res: any = await apiFetch<any>('/sites/defaults');
    return res.demonstrationSites || res;
  },

  /**
   * Official NASA Artemis South Pole Candidate Landing Sites
   * (GET /api/mission/candidate-sites)
   */
  async getCandidateSites(): Promise<DemonstrationLandingSite[]> {
    try {
      const res: any = await apiFetch<any>('/mission/candidate-sites');
      if (res && Array.isArray(res.candidateSites)) {
        return res.candidateSites;
      }
    } catch {
      // fallback
    }
    return this.getDefaultSites();
  },

  /**
   * Retrieve an individual candidate landing site by ID
   * (GET /api/mission/candidate-sites/:id)
   */
  async getSiteById(id: string): Promise<DemonstrationLandingSite> {
    try {
      const missionRes: any = await apiFetch<any>(`/mission/candidate-sites/${id}`);
      if (missionRes && missionRes.site) {
        return missionRes.site;
      }
    } catch {
      // fallback
    }
    const res: any = await apiFetch<any>(`/sites/${id}`);
    return res.site || res;
  },

  /**
   * Evaluates location-specific solar illumination at the selected landing site
   * combining SPICE DE440 ephemeris, LOLA DEM terrain horizon, surface normal, and continuous sunlight duration.
   * (POST /api/mission/illumination/evaluate)
   */
  async evaluateIllumination(params: IlluminationEvaluationRequest): Promise<IlluminationEvaluationData> {
    const res: any = await apiFetch<any>('/mission/illumination/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.data || res;
  },

  /**
   * 360-degree local terrain horizon elevation profile from LOLA DEM GeoTIFF.
   * Gracefully falls back to synthetic flat datum if coordinates are outside South Pole DEM coverage.
   */
  async getTerrainHorizon(params: {
    latitudeDeg: number;
    longitudeDeg: number;
    radialRangeMeters?: number;
    azimuthStepDeg?: number;
    demProvider?: 'geotiff' | 'synthetic';
  }): Promise<HorizonProfileResponse> {
    const requestBody = {
      site: {
        latitudeDeg: params.latitudeDeg,
        longitudeDeg: params.longitudeDeg,
      },
      searchRadiusMeters: params.radialRangeMeters ?? 1000,
      azimuthStepDeg: params.azimuthStepDeg ?? 10,
      demProvider: params.demProvider ?? 'geotiff',
    };

    try {
      return await apiFetch<HorizonProfileResponse>('/terrain/horizon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (err: any) {
      if (requestBody.demProvider === 'geotiff') {
        try {
          // Automatically retry with synthetic datum provider if GeoTIFF is out-of-bounds or unavailable
          return await apiFetch<HorizonProfileResponse>('/terrain/horizon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...requestBody, demProvider: 'synthetic' }),
          });
        } catch {
          // Fall through to throw original error
        }
      }
      throw err;
    }
  },

  /**
   * Surface normal, topographic slope, and aspect from LOLA DEM.
   * Gracefully falls back to synthetic flat datum if coordinates are outside South Pole DEM coverage.
   */
  async getSurfaceNormal(params: {
    latitudeDeg: number;
    longitudeDeg: number;
    demProvider?: 'geotiff' | 'synthetic';
  }): Promise<SurfaceNormalResponse> {
    const requestBody = {
      site: {
        latitudeDeg: params.latitudeDeg,
        longitudeDeg: params.longitudeDeg,
      },
      demProvider: params.demProvider ?? 'geotiff',
    };

    try {
      return await apiFetch<SurfaceNormalResponse>('/terrain/surface-normal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (err: any) {
      if (requestBody.demProvider === 'geotiff') {
        try {
          // Automatically retry with synthetic datum provider if GeoTIFF is out-of-bounds or unavailable
          return await apiFetch<SurfaceNormalResponse>('/terrain/surface-normal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...requestBody, demProvider: 'synthetic' }),
          });
        } catch {
          // Fall through to throw original error
        }
      }
      throw err;
    }
  },

  /**
   * Calculate instant solar illumination, slope normal, and obstruction
   */
  async getInstantIllumination(params: {
    latitudeDeg: number;
    longitudeDeg: number;
    epochUtc: string;
  }): Promise<InstantIlluminationResponse> {
    return apiFetch<InstantIlluminationResponse>('/illumination/instant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        epochUtc: params.epochUtc,
        site: {
          latitudeDeg: params.latitudeDeg,
          longitudeDeg: params.longitudeDeg,
        },
      }),
    });
  },

  /**
   * Calculate multi-epoch visibility windows with bisection refinement.
   * Defaults includeTimeSeries to true and falls back to synthetic datum if outside DEM coverage.
   */
  async calculateWindows(params: {
    latitudeDeg: number;
    longitudeDeg: number;
    startTimeUtc: string;
    endTimeUtc: string;
    stepSeconds?: number;
    includeTimeSeries?: boolean;
    demProvider?: 'geotiff' | 'synthetic';
    ephemerisProvider?: 'spice' | 'analytical' | 'mock';
    observerHeightMeters?: number;
  }): Promise<WindowsCalculationResponse> {
    const requestBody = {
      site: {
        latitudeDeg: params.latitudeDeg,
        longitudeDeg: params.longitudeDeg,
        observerHeightMeters: params.observerHeightMeters ?? 2.0,
      },
      startTimeUtc: params.startTimeUtc,
      endTimeUtc: params.endTimeUtc,
      stepSeconds: params.stepSeconds ?? 3600,
      includeTimeSeries: params.includeTimeSeries ?? true,
      demProvider: params.demProvider ?? 'geotiff',
      ephemerisProvider: params.ephemerisProvider ?? 'spice',
    };

    try {
      return await apiFetch<WindowsCalculationResponse>('/windows/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (err: any) {
      if (
        requestBody.demProvider === 'geotiff' &&
        err.message &&
        (err.message.includes('outside DEM coverage') || err.message.includes('NoData'))
      ) {
        // Automatically retry with synthetic datum provider
        return apiFetch<WindowsCalculationResponse>('/windows/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...requestBody, demProvider: 'synthetic' }),
        });
      }
      throw err;
    }
  },

  /**
   * Evaluate and rank candidate landing sites using NASA SPICE ephemeris and LOLA DEM.
   * Falls back to synthetic datum if any compared site is outside DEM coverage.
   */
  async compareSites(params: SiteComparisonRequestParams): Promise<SiteComparisonResponse> {
    try {
      return await apiFetch<SiteComparisonResponse>('/sites/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
    } catch (err: any) {
      if (
        (!params.demProvider || params.demProvider === 'geotiff') &&
        err.message &&
        (err.message.includes('outside DEM coverage') || err.message.includes('NoData'))
      ) {
        return apiFetch<SiteComparisonResponse>('/sites/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...params, demProvider: 'synthetic' }),
        });
      }
      throw err;
    }
  },

  /**
   * Validate selenographic coordinates and convert to Cartesian ME coordinates
   */
  async validateSite(site: {
    id?: string;
    name?: string;
    latitudeDeg: number;
    longitudeDeg: number;
    elevationMeters?: number;
  }): Promise<{ valid: boolean; site: any; cartesianCoordinatesME: { x: number; y: number; z: number } }> {
    return apiFetch('/sites/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site }),
    });
  },

  /**
   * Complete instant site analysis for chosen epoch (Sun, Earth, Slope, Clearance)
   */
  async getSiteAnalysis(params: {
    site: {
      id?: string;
      name?: string;
      latitudeDeg: number;
      longitudeDeg: number;
      elevationMeters?: number;
    };
    epochUtc: string;
    observerHeightMeters?: number;
  }): Promise<SiteAnalysisData> {
    try {
      return await apiFetch<SiteAnalysisData>('/sites/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
    } catch {
      try {
        const res = await fetch('/api/test/site-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        if (res.ok) {
          const json = await res.json();
          return json.data !== undefined ? json.data : json;
        }
      } catch {
        // Fallback to individual endpoints
      }
    }

    const [sky, surface, illumination] = await Promise.all([
      this.getSkyGeometry({
        latitudeDeg: params.site.latitudeDeg,
        longitudeDeg: params.site.longitudeDeg,
        epochUtc: params.epochUtc,
        elevationMeters: params.site.elevationMeters,
        observerHeightMeters: params.observerHeightMeters,
      }),
      this.getSurfaceNormal({
        latitudeDeg: params.site.latitudeDeg,
        longitudeDeg: params.site.longitudeDeg,
      }).catch(() => null),
      this.getInstantIllumination({
        latitudeDeg: params.site.latitudeDeg,
        longitudeDeg: params.site.longitudeDeg,
        epochUtc: params.epochUtc,
      }).catch(() => null),
    ]);

    const isDemCovered = surface !== null;
    const elevationMeters = surface?.elevationMeters ?? params.site.elevationMeters ?? 0;
    const slopeDeg = surface?.slopeDeg ?? 0;
    const aspectDeg = surface?.aspectDeg ?? 0;
    const surfaceNormalEnu = surface?.surfaceNormalEnu ?? { x: 0, y: 0, z: 1 };

    const isSunLit = illumination?.isDirectlyIlluminated ?? sky.sun.elevationDeg > 0;
    const isEarthVisible = sky.earth.elevationDeg > 0;

    return {
      site: {
        id: params.site.id ?? 'site',
        name: params.site.name ?? 'Selected Site',
        latitudeDeg: params.site.latitudeDeg,
        longitudeDeg: params.site.longitudeDeg,
        elevationMeters,
        isDemCovered,
      },
      terrain: {
        elevationMeters,
        slopeDeg,
        aspectDeg,
        surfaceNormalEnu,
        source: isDemCovered ? 'NASA LOLA GeoTIFF' : 'Outside DEM Coverage (Spherical Datum)',
      },
      sun: {
        azimuthDeg: sky.sun.azimuthDeg,
        elevationDeg: sky.sun.elevationDeg,
        distanceKm: sky.sun.distanceMeters / 1000,
        targetPositionMoonCenteredME: sky.sun.targetPositionMoonCenteredME,
        targetVelocityMoonCenteredME: sky.sun.targetVelocityMoonCenteredME,
        topocentricVectorME: sky.sun.topocentricVectorME,
        horizonElevationDeg: 0,
        clearanceDeg: sky.sun.elevationDeg,
        isDirectlyVisible: isSunLit,
        incidenceAngleDeg: illumination?.surfaceOrientation?.incidenceAngleDeg ?? 0,
        relativeIncidenceFactor: illumination?.surfaceOrientation?.mu ?? 0,
      },
      earth: {
        azimuthDeg: sky.earth.azimuthDeg,
        elevationDeg: sky.earth.elevationDeg,
        distanceKm: sky.earth.distanceMeters / 1000,
        targetPositionMoonCenteredME: sky.earth.targetPositionMoonCenteredME,
        targetVelocityMoonCenteredME: sky.earth.targetVelocityMoonCenteredME,
        topocentricVectorME: sky.earth.topocentricVectorME,
        earthRotationAngleDeg: sky.earth.earthRotationAngleDeg,
        horizonElevationDeg: 0,
        clearanceDeg: sky.earth.elevationDeg,
        isDirectlyVisible: isEarthVisible,
      },
    };
  },

  /**
   * Extract 2D/3D elevation subgrid from real LOLA DEM GeoTIFF
   */
  async getTerrainSubgrid(params: {
    site: { latitudeDeg: number; longitudeDeg: number };
    radiusMeters?: number;
    gridResolution?: number;
  }): Promise<any> {
    try {
      return await apiFetch('/terrain/subgrid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
    } catch {
      const res = await fetch('/api/test/terrain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error('Terrain subgrid fetch failed');
      const json = await res.json();
      return json.data !== undefined ? json.data : json;
    }
  },

  /**
   * Comprehensive Mission Feasibility & Power/Comm Assessment with reasons and score
   */
  async getMissionAssessment(params: {
    site: {
      latitudeDeg: number;
      longitudeDeg: number;
      elevationMeters?: number;
    };
    startTimeUtc: string;
    durationHours?: number;
    minSolarElevationDeg?: number;
    minSunlightDurationHours?: number;
    minEarthElevationDeg?: number;
    minCommWindowHours?: number;
    maxSlopeDeg?: number;
  }): Promise<MissionAssessmentResponse> {
    try {
      const res = await fetch('/api/test/mission-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data !== undefined ? json.data : json;
      }
    } catch {
      // Fallback
    }

    const directUrl = DIRECT_BACKEND_ORIGIN
      ? `${DIRECT_BACKEND_ORIGIN}/api/test/mission-assessment`
      : '/api/test/mission-assessment';
    const directRes = await fetch(directUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!directRes.ok) {
      throw new Error(`Failed mission assessment: HTTP ${directRes.status}`);
    }
    const directJson = await directRes.json();
    return directJson.data !== undefined ? directJson.data : directJson;
  },

  /**
   * Calendar-Day Multi-Epoch Continuous Timeline (hourly samples of Sun, Earth & simultaneous LOS)
   */
  async getTimelineData(params: {
    site: {
      latitudeDeg: number;
      longitudeDeg: number;
      elevationMeters?: number;
    };
    startTimeUtc: string;
    durationHours?: number;
    stepSeconds?: number;
  }): Promise<TimelineResponse> {
    try {
      const res = await fetch('/api/test/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data !== undefined ? json.data : json;
      }
    } catch {
      // Fallback
    }

    const directUrl = DIRECT_BACKEND_ORIGIN
      ? `${DIRECT_BACKEND_ORIGIN}/api/test/timeline`
      : '/api/test/timeline';
    const directRes = await fetch(directUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!directRes.ok) {
      throw new Error(`Failed timeline query: HTTP ${directRes.status}`);
    }
    const directJson = await directRes.json();
    return directJson.data !== undefined ? directJson.data : directJson;
  },

  /**
   * NASA Moon Trek WMTS Verified Layers Catalog
   */
  async getMoonTrekLayers(): Promise<MoonTrekLayerMetadata[]> {
    try {
      const res = await fetch(`${API_BASE}/trek/layers`);
      if (res.ok) {
        const json = await res.json();
        if (json.layers) return json.layers;
      }
    } catch {
      // Direct origin fallback
    }
    const directUrl = DIRECT_BACKEND_ORIGIN ? `${DIRECT_BACKEND_ORIGIN}${API_BASE}/trek/layers` : `${API_BASE}/trek/layers`;
    try {
      const directRes = await fetch(directUrl);
      if (directRes.ok) {
        const directJson = await directRes.json();
        if (directJson.layers) return directJson.layers;
      }
    } catch {
      // ignore
    }
    return [
      {
        id: 'LRO_WAC_Mosaic_Global_303ppd_v02',
        title: 'LROC WAC Global Photographic Mosaic',
        description: 'NASA LRO Wide Angle Camera global morphologic mosaic (~100m/pixel, 303 pixels/degree).',
        projection: 'EQ',
        crs: 'urn:ogc:def:crs:EPSG::104903',
        format: 'image/jpeg',
        tileMatrixSet: 'default028mm',
        minZoom: 0,
        maxZoom: 8,
        resolutionMpp: 100,
        wmtsEndpoint: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/',
        tileUrlTemplate: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
        localFallbackUrl: '/tiles/lroc/{z}/{x}/{y}.png',
        bounds: { west: -180, south: -90, east: 180, north: 90 },
        instrument: 'Wide Angle Camera (WAC)',
        mission: 'Lunar Reconnaissance Orbiter (LRO)',
        attribution: 'NASA / GSFC / Arizona State University (LROC)',
        isElevationOrShade: false,
      },
      {
        id: 'LRO_LOLA_ClrShade_Global_128ppd_v04',
        title: 'LOLA Global Color Altimetry Hillshade',
        description: 'LOLA topography colorized relief map (~237m/pixel, 128 ppd).',
        projection: 'EQ',
        crs: 'urn:ogc:def:crs:EPSG::104903',
        format: 'image/png',
        tileMatrixSet: 'default028mm',
        minZoom: 0,
        maxZoom: 7,
        resolutionMpp: 237,
        wmtsEndpoint: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLA_ClrShade_Global_128ppd_v04/1.0.0/',
        tileUrlTemplate: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLA_ClrShade_Global_128ppd_v04/1.0.0/default/default028mm/{z}/{y}/{x}.png',
        bounds: { west: -180, south: -90, east: 180, north: 90 },
        instrument: 'Lunar Orbiter Laser Altimeter (LOLA)',
        mission: 'Lunar Reconnaissance Orbiter (LRO)',
        attribution: 'NASA / GSFC / LOLA Science Team',
        isElevationOrShade: true,
      },
      {
        id: 'LRO_LOLAKaguya_Hillshade_60N60S_512ppd',
        title: 'LOLA & Kaguya TC High-Detail Grayscale Shaded Relief',
        description: 'LRO LOLA and JAXA Kaguya Terrain Camera stereo photometry (~59m/pixel, 512 ppd).',
        projection: 'EQ',
        crs: 'urn:ogc:def:crs:EPSG::104903',
        format: 'image/png',
        tileMatrixSet: 'default028mm',
        minZoom: 0,
        maxZoom: 8,
        resolutionMpp: 59,
        wmtsEndpoint: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLAKaguya_Hillshade_60N60S_512ppd/1.0.0/',
        tileUrlTemplate: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLAKaguya_Hillshade_60N60S_512ppd/1.0.0/default/default028mm/{z}/{y}/{x}.png',
        bounds: { west: -180, south: -60, east: 180, north: 60 },
        instrument: 'LOLA + Terrain Camera (TC)',
        mission: 'LRO & JAXA SELENE (Kaguya)',
        attribution: 'NASA / GSFC / JAXA / USGS Astrogeology',
        isElevationOrShade: true,
      },
      {
        id: 'LRO_LOLA_ClrShade_SPole75_30mp_v04_EQ',
        title: 'LOLA South Pole Artemis Exploration Zone Color Shading',
        description: 'High-resolution polar altimetry color shading from 75°S to 90°S (~30m/pixel).',
        projection: 'EQ',
        crs: 'urn:ogc:def:crs:EPSG::104903',
        format: 'image/png',
        tileMatrixSet: 'default028mm',
        minZoom: 0,
        maxZoom: 9,
        resolutionMpp: 30,
        wmtsEndpoint: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLA_ClrShade_SPole75_30mp_v04_EQ/1.0.0/',
        tileUrlTemplate: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLA_ClrShade_SPole75_30mp_v04_EQ/1.0.0/default/default028mm/{z}/{y}/{x}.png',
        bounds: { west: -180, south: -90, east: 180, north: -75 },
        instrument: 'Lunar Orbiter Laser Altimeter (LOLA)',
        mission: 'Lunar Reconnaissance Orbiter (LRO)',
        attribution: 'NASA / GSFC / Barker et al. (PGDA)',
        isElevationOrShade: true,
      },
    ];
  },

  /**
   * Time-series ephemeris, illumination, and radiative-equilibrium thermal temperature calculation
   */
  async getSiteSeries(params: {
    site: { latitudeDeg: number; longitudeDeg: number; elevationMeters?: number };
    startTimeUtc: string;
    endTimeUtc: string;
    stepSeconds?: number;
    include?: Array<'moon' | 'sunlight' | 'temperature'>;
    thermal?: { nightTemperatureK?: number; bondAlbedo?: number; emissivity?: number };
  }): Promise<SiteSeriesResponse> {
    return apiFetch<SiteSeriesResponse>('/series/site', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site: {
          latitudeDeg: params.site.latitudeDeg,
          longitudeDeg: params.site.longitudeDeg,
          elevationMeters: params.site.elevationMeters ?? 0,
        },
        startTimeUtc: params.startTimeUtc,
        endTimeUtc: params.endTimeUtc,
        stepSeconds: params.stepSeconds ?? 3600,
        include: params.include ?? ['sunlight', 'temperature'],
        thermal: params.thermal ?? { nightTemperatureK: 40 },
      }),
    });
  },
};

export interface SiteSeriesResponse {
  siteCoords: { latitudeDeg: number; longitudeDeg: number; elevationMeters?: number };
  interval: {
    startUtc: string;
    endUtc: string;
    stepSeconds: number;
    sampleCount: number;
  };
  included: string[];
  series: Array<{
    epochUtc: string;
    sunlight?: {
      sunAzimuthDeg: number;
      sunElevationDeg: number;
      terrainHorizonDeg: number;
      clearanceDeg: number;
      incidenceAngleDeg: number;
      illuminationStatus: string;
      isDirectlyIlluminated: boolean;
    };
    temperature?: {
      surfaceTemperatureK: number;
      surfaceTemperatureC: number;
      solarFluxWm2: number;
      regime: 'SUNLIT' | 'NIGHT_OR_SHADOW';
    };
  }>;
  summary: {
    sunlit?: {
      litSampleCount: number;
      litPercentage: number;
      longestContinuousSunlightHours: number;
      longestContinuousDarknessHours: number;
    };
    temperature?: {
      minK: number;
      maxK: number;
      meanK: number;
      minC: number;
      maxC: number;
      meanC: number;
    };
  };
}
