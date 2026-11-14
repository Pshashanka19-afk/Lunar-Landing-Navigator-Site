import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { appendLog, recentLogs } from '../middleware/logger';
import { EphemerisFactory } from '../services/ephemeris/ephemeris.factory';
import { DemFactory } from '../services/terrain/dem.factory';
import { LunarFrameService } from '../services/coordinates/lunar-frame.service';
import { SurfaceNormalService } from '../services/terrain/surface-normal.service';
import { HorizonProfileService, HorizonSample } from '../services/terrain/horizon-profile.service';
import { SolarIncidenceService } from '../services/illumination/solar-incidence.service';
import { WindowCalculationService } from '../services/windows/window-calculation.service';
import { SiteScoringService, CandidateSiteInput } from '../services/comparison/site-scoring.service';
import { DEFAULT_DEMO_SITES, SCIENTIFIC_CONSTANTS } from '../config/scientific-config';
import { roundToPrecision } from '../utils/units';

export class TestController {
  /**
   * GET /api/test/health
   */
  public static async getHealth(_req: Request, res: Response): Promise<void> {
    const t0 = performance.now();
    appendLog('info', 'Executing GET /api/test/health');

    const ephemProvider = EphemerisFactory.getProvider();
    const ephemReadiness = await ephemProvider.getReadinessDetails();
    const demService = DemFactory.getGeoTiffService();
    const demGeoTiffReady = await demService.isReady();

    res.json({
      success: true,
      data: {
        status: 'UP',
        service: 'Lunar Mission Test Lab Backend',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMb: {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        },
        providers: {
          ephemeris: {
            active: ephemProvider.name,
            configured: env.EPHEMERIS_PROVIDER,
            ready: ephemReadiness.ready,
            message: ephemReadiness.message,
          },
          dem: {
            configured: env.DEM_PROVIDER,
            geoTiffMounted: demGeoTiffReady,
            demPath: env.DEM_PATH,
          },
        },
        executionTimeMs: Math.round(performance.now() - t0),
      },
    });
  }

  /**
   * GET /api/test/data-status
   * Comprehensive scientific diagnostics of DEM, SPICE kernels, frames, coordinates, and endpoints.
   */
  public static async getDataStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    const t0 = performance.now();
    appendLog('info', 'Executing GET /api/test/data-status scientific diagnostics');

    try {
      const checks: Array<{
        id: string;
        name: string;
        category: 'DEM' | 'SPICE' | 'COORDINATES' | 'ENDPOINTS';
        status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT IMPLEMENTED';
        latencyMs: number;
        details: Record<string, unknown>;
        error?: string;
      }> = [];

      // 1. DEM GeoTIFF File Check
      const demFileT0 = performance.now();
      const demPath = path.resolve(process.cwd(), env.DEM_PATH);
      const demExists = fs.existsSync(demPath);
      let demStats = null;
      if (demExists) {
        demStats = fs.statSync(demPath);
      }
      checks.push({
        id: 'dem-file-status',
        name: 'DEM File Availability',
        category: 'DEM',
        status: demExists ? 'PASS' : 'FAIL',
        latencyMs: Math.round(performance.now() - demFileT0),
        details: {
          path: env.DEM_PATH,
          exists: demExists,
          sizeBytes: demStats ? demStats.size : 0,
          sizeMb: demStats ? (demStats.size / 1024 / 1024).toFixed(2) : '0',
          format: 'GeoTIFF Float32 Cloud-Optimized Raster',
        },
      });

      // 2. DEM Readability & Metadata
      const demMetaT0 = performance.now();
      let demMeta = null;
      try {
        const demService = DemFactory.getGeoTiffService();
        demMeta = await demService.getMetadata();
        checks.push({
          id: 'dem-readability',
          name: 'DEM Readability & Metadata',
          category: 'DEM',
          status: 'PASS',
          latencyMs: Math.round(performance.now() - demMetaT0),
          details: {
            id: demMeta.id,
            source: demMeta.source,
            width: demMeta.width,
            height: demMeta.height,
            pixelSpacingMeters: demMeta.pixelSpacingMeters,
            crs: demMeta.crs,
            verticalReference: demMeta.verticalReference,
            projectedBounds: demMeta.bounds,
          },
        });
      } catch (err) {
        checks.push({
          id: 'dem-readability',
          name: 'DEM Readability & Metadata',
          category: 'DEM',
          status: 'FAIL',
          latencyMs: Math.round(performance.now() - demMetaT0),
          details: { path: env.DEM_PATH },
          error: (err as Error).message,
        });
      }

      // 3. DEM Elevation Sampling Verification
      const demSampleT0 = performance.now();
      try {
        const demService = DemFactory.getGeoTiffService();
        const shackletonElev = await demService.getElevationAtLatLon(-89.78, 125.4);
        const malapertElev = await demService.getElevationAtLatLon(-85.99, 2.91);
        const haworthElev = await demService.getElevationAtLatLon(-87.45, -5.10);

        const sampleValid =
          shackletonElev !== null &&
          Number.isFinite(shackletonElev) &&
          malapertElev !== null &&
          Number.isFinite(malapertElev);

        checks.push({
          id: 'dem-sampling',
          name: 'DEM Elevation Sampling',
          category: 'DEM',
          status: sampleValid ? 'PASS' : 'WARNING',
          latencyMs: Math.round(performance.now() - demSampleT0),
          details: {
            shackletonSampleMeters: shackletonElev !== null ? roundToPrecision(shackletonElev, 2) : null,
            malapertSampleMeters: malapertElev !== null ? roundToPrecision(malapertElev, 2) : null,
            haworthSampleMeters: haworthElev !== null ? roundToPrecision(haworthElev, 2) : null,
            datum: '1737400m lunar reference radius sphere',
          },
        });
      } catch (err) {
        checks.push({
          id: 'dem-sampling',
          name: 'DEM Elevation Sampling',
          category: 'DEM',
          status: 'FAIL',
          latencyMs: Math.round(performance.now() - demSampleT0),
          details: {},
          error: (err as Error).message,
        });
      }

      // 4. SPICE Toolkit Initialization & Readiness
      const spiceT0 = performance.now();
      const spiceProvider = EphemerisFactory.getProvider('spice');
      const spiceReadiness = await spiceProvider.getReadinessDetails();
      checks.push({
        id: 'spice-init',
        name: 'SPICE Toolkit & CSPICE Engine',
        category: 'SPICE',
        status: spiceReadiness.ready ? 'PASS' : 'FAIL',
        latencyMs: Math.round(performance.now() - spiceT0),
        details: {
          providerName: spiceProvider.name,
          ready: spiceReadiness.ready,
          message: spiceReadiness.message,
          kernelDir: env.SPICE_KERNEL_DIR,
        },
      });

      // 5. SPICE Kernels Inspection
      const kernelT0 = performance.now();
      const kernelDir = path.resolve(process.cwd(), env.SPICE_KERNEL_DIR);
      let kernelFiles: string[] = [];
      if (fs.existsSync(kernelDir)) {
        kernelFiles = fs.readdirSync(kernelDir).filter((f) => /\.(tls|tpc|bpc|bsp|tf|tm)$/i.test(f));
      }
      const requiredTypes = [
        { type: 'LSK (Leapseconds)', pattern: /\.tls$/i, present: kernelFiles.some((f) => /\.tls$/i.test(f)) },
        { type: 'PCK (Planetary Constants)', pattern: /\.tpc$/i, present: kernelFiles.some((f) => /\.tpc$/i.test(f)) },
        { type: 'SPK (Ephemeris)', pattern: /\.bsp$/i, present: kernelFiles.some((f) => /\.bsp$/i.test(f)) },
        { type: 'FK (Frame)', pattern: /\.tf$/i, present: kernelFiles.some((f) => /\.tf$/i.test(f)) },
        { type: 'Binary PCK (Libration)', pattern: /\.bpc$/i, present: kernelFiles.some((f) => /\.bpc$/i.test(f)) },
      ];
      const allTypesPresent = requiredTypes.every((t) => t.present);
      checks.push({
        id: 'spice-kernels',
        name: 'SPICE Kernel Suite & Dependencies',
        category: 'SPICE',
        status: allTypesPresent ? 'PASS' : 'WARNING',
        latencyMs: Math.round(performance.now() - kernelT0),
        details: {
          totalKernelsDetected: kernelFiles.length,
          kernelFiles,
          requiredKernelTypes: requiredTypes,
          timeCoverage: '1900-01-01 to 2050-01-01 TDB (DE421 / DE440)',
        },
      });

      // 6. Lunar Reference Frames & Coordinates
      const coordT0 = performance.now();
      try {
        const testSite = { latitudeDeg: -89.78, longitudeDeg: 125.4, elevationMeters: 1413.9 };
        const cartesianME = LunarFrameService.selenographicToCartesianME(testSite);
        const demService = DemFactory.getGeoTiffService();
        const projected = demService.latLonToProjected(testSite.latitudeDeg, testSite.longitudeDeg);
        const inverseLatLon = demService.projectedToLatLon(projected.x, projected.y);
        const latDelta = Math.abs(inverseLatLon.latDeg - testSite.latitudeDeg);
        const lonDelta = Math.abs(inverseLatLon.lonDeg - testSite.longitudeDeg);

        checks.push({
          id: 'coordinate-transforms',
          name: 'Lunar Reference Frames & Coordinates',
          category: 'COORDINATES',
          status: latDelta < 1e-4 && lonDelta < 1e-4 ? 'PASS' : 'WARNING',
          latencyMs: Math.round(performance.now() - coordT0),
          details: {
            selenographicCoordinates: testSite,
            cartesianCoordinatesME_meters: cartesianME,
            polarStereographic_xy_meters: projected,
            roundTripErrorDeg: { latitudeDelta: latDelta, longitudeDelta: lonDelta },
            supportedFrames: ['MOON_ME (Mean Earth/Polar Axis)', 'LOCAL_ENU (East-North-Up)', 'J2000 (Inertial)'],
          },
        });
      } catch (err) {
        checks.push({
          id: 'coordinate-transforms',
          name: 'Lunar Reference Frames & Coordinates',
          category: 'COORDINATES',
          status: 'FAIL',
          latencyMs: Math.round(performance.now() - coordT0),
          details: {},
          error: (err as Error).message,
        });
      }

      // 7. Ephemeris & Geometry Endpoints Check
      const ephemCalcT0 = performance.now();
      try {
        const ephem = EphemerisFactory.getProvider('spice');
        const sunCalc = await ephem.calculateTarget({
          target: 'SUN',
          epochUtc: '2026-10-29T12:00:00Z',
          siteCoords: { latitudeDeg: -89.78, longitudeDeg: 125.4 },
        });
        const earthCalc = await ephem.calculateTarget({
          target: 'EARTH',
          epochUtc: '2026-10-29T12:00:00Z',
          siteCoords: { latitudeDeg: -89.78, longitudeDeg: 125.4 },
        });

        checks.push({
          id: 'ephemeris-calculations',
          name: 'SPICE Ephemeris Sun & Earth Vectors',
          category: 'ENDPOINTS',
          status: 'PASS',
          latencyMs: Math.round(performance.now() - ephemCalcT0),
          details: {
            testEpoch: '2026-10-29T12:00:00Z',
            sunAzimuthDeg: roundToPrecision(sunCalc.azimuthDeg, 2),
            sunElevationDeg: roundToPrecision(sunCalc.elevationDeg, 2),
            earthAzimuthDeg: roundToPrecision(earthCalc.azimuthDeg, 2),
            earthElevationDeg: roundToPrecision(earthCalc.elevationDeg, 2),
            aberrationCorrection: 'LT+S',
            frame: 'LOCAL_ENU / MOON_ME',
          },
        });
      } catch (err) {
        checks.push({
          id: 'ephemeris-calculations',
          name: 'SPICE Ephemeris Sun & Earth Vectors',
          category: 'ENDPOINTS',
          status: 'FAIL',
          latencyMs: Math.round(performance.now() - ephemCalcT0),
          details: {},
          error: (err as Error).message,
        });
      }

      // Summary
      const passCount = checks.filter((c) => c.status === 'PASS').length;
      const failCount = checks.filter((c) => c.status === 'FAIL').length;
      const warningCount = checks.filter((c) => c.status === 'WARNING').length;

      res.json({
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          overallStatus: failCount === 0 ? 'HEALTHY' : 'DEGRADED',
          summary: {
            totalChecks: checks.length,
            passed: passCount,
            failed: failCount,
            warnings: warningCount,
            notImplemented: 0,
          },
          checks,
          executionTimeMs: Math.round(performance.now() - t0),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/test/sites
   * Returns list of supported curated demonstration sites.
   */
  public static async getCuratedSites(_req: Request, res: Response): Promise<void> {
    const demService = DemFactory.getGeoTiffService();
    const sitesWithCoverage = await Promise.all(
      DEFAULT_DEMO_SITES.map(async (site) => {
        const proj = demService.latLonToProjected(site.latitudeDeg, site.longitudeDeg);
        const covered = await demService.isPointCovered(proj.x, proj.y);
        let demElevation = null;
        if (covered) {
          demElevation = await demService.getElevationAt(proj.x, proj.y);
        }
        return {
          ...site,
          projectedCoordinatesMeters: proj,
          demCoverage: covered,
          demElevationMeters: demElevation !== null ? roundToPrecision(demElevation, 1) : null,
        };
      })
    );

    res.json({
      success: true,
      data: {
        sites: sitesWithCoverage,
        count: sitesWithCoverage.length,
        referenceFrame: 'MOON_ME',
        crs: 'Lunar Polar Stereographic (South Pole)',
      },
    });
  }

  /**
   * POST /api/test/site-analysis
   * TEST 1 Single Site detailed analysis.
   */
  public static async postSiteAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    const t0 = performance.now();
    try {
      const site = req.body.site || { latitudeDeg: -89.78, longitudeDeg: 125.4 };
      const epochUtc = req.body.epochUtc || '2026-10-29T12:00:00Z';
      const observerHeightMeters = req.body.observerHeightMeters ?? 2.0;
      appendLog('info', `Executing POST /api/test/site-analysis for (${site.latitudeDeg}, ${site.longitudeDeg})`);

      const ephemerisProvider = EphemerisFactory.getProvider('spice');
      const demProvider = DemFactory.getDemProvider('geotiff');

      // Check DEM coverage
      const proj = demProvider.latLonToProjected(site.latitudeDeg, site.longitudeDeg);
      const isDemCovered = await demProvider.isPointCovered(proj.x, proj.y);

      let elevationMeters = site.elevationMeters ?? 0.0;
      let slopeDeg = 0.0;
      let aspectDeg = 0.0;
      let surfaceNormalEnu = { x: 0, y: 0, z: 1 };
      let horizonSamples: HorizonSample[] = [];

      if (isDemCovered) {
        const demElev = await demProvider.getElevationAt(proj.x, proj.y);
        if (demElev !== null) elevationMeters = demElev;

        const surface = await SurfaceNormalService.analyzeSurface(demProvider, {
          latitudeDeg: site.latitudeDeg,
          longitudeDeg: site.longitudeDeg,
          observerHeightMeters,
        });
        slopeDeg = surface.slopeDeg;
        aspectDeg = surface.aspectDeg;
        surfaceNormalEnu = surface.surfaceNormalEnu;

        const horizonProfile = await HorizonProfileService.calculateHorizonProfile(demProvider, {
          latitudeDeg: site.latitudeDeg,
          longitudeDeg: site.longitudeDeg,
          observerHeightMeters,
          searchRadiusMeters: req.body.searchRadiusMeters ?? 1000.0,
          azimuthStepDeg: req.body.azimuthStepDeg ?? 10.0,
        });
        horizonSamples = horizonProfile.samples;
      }

      // Celestial Ephemeris via SPICE
      const sunGeometry = await ephemerisProvider.calculateTarget({
        target: 'SUN',
        epochUtc,
        siteCoords: { latitudeDeg: site.latitudeDeg, longitudeDeg: site.longitudeDeg, elevationMeters },
        observerHeightMeters,
      });

      const earthGeometry = await ephemerisProvider.calculateTarget({
        target: 'EARTH',
        epochUtc,
        siteCoords: { latitudeDeg: site.latitudeDeg, longitudeDeg: site.longitudeDeg, elevationMeters },
        observerHeightMeters,
      });

      // Horizon clearance
      const sunHorizonDeg = isDemCovered
        ? HorizonProfileService.interpolateHorizonAtAzimuth(horizonSamples, sunGeometry.azimuthDeg)
        : 0.0;
      const earthHorizonDeg = isDemCovered
        ? HorizonProfileService.interpolateHorizonAtAzimuth(horizonSamples, earthGeometry.azimuthDeg)
        : 0.0;

      const sunClearanceDeg = sunGeometry.elevationDeg - sunHorizonDeg;
      const earthClearanceDeg = earthGeometry.elevationDeg - earthHorizonDeg;

      // Solar incidence
      const solarIncidence = SolarIncidenceService.calculateSolarIncidence(
        surfaceNormalEnu,
        sunGeometry.azimuthDeg,
        sunGeometry.elevationDeg
      );

      // Short-interval sunset/earthset estimate over 24h
      const shortWindow = await WindowCalculationService.calculateWindows(ephemerisProvider, demProvider, {
        siteCoords: { latitudeDeg: site.latitudeDeg, longitudeDeg: site.longitudeDeg, elevationMeters },
        startTimeUtc: epochUtc,
        endTimeUtc: new Date(new Date(epochUtc).getTime() + 24 * 3600 * 1000).toISOString(),
        stepSeconds: 900,
        observerHeightMeters,
      });

      res.json({
        success: true,
        data: {
          site: {
            id: site.id ?? 'custom-site',
            name: site.name ?? 'Selected Lunar Site',
            latitudeDeg: site.latitudeDeg,
            longitudeDeg: site.longitudeDeg,
            elevationMeters: roundToPrecision(elevationMeters, 2),
            observerHeightMeters,
            projectedX: roundToPrecision(proj.x, 2),
            projectedY: roundToPrecision(proj.y, 2),
            isDemCovered,
          },
          terrain: {
            elevationMeters: roundToPrecision(elevationMeters, 2),
            slopeDeg: roundToPrecision(slopeDeg, 2),
            aspectDeg: roundToPrecision(aspectDeg, 2),
            surfaceNormalEnu,
            source: isDemCovered ? 'NASA LOLA GeoTIFF (lunar-south-pole.tif)' : 'Outside DEM Coverage (Spherical Datum)',
          },
          sun: {
            azimuthDeg: roundToPrecision(sunGeometry.azimuthDeg, 2),
            elevationDeg: roundToPrecision(sunGeometry.elevationDeg, 2),
            distanceKm: roundToPrecision(sunGeometry.distanceMeters / 1000.0, 1),
            targetPositionMoonCenteredME: sunGeometry.targetPositionMoonCenteredME,
            targetVelocityMoonCenteredME: sunGeometry.targetVelocityMoonCenteredME,
            topocentricVectorME: sunGeometry.topocentricVectorME,
            horizonElevationDeg: roundToPrecision(sunHorizonDeg, 2),
            clearanceDeg: roundToPrecision(sunClearanceDeg, 2),
            isDirectlyVisible: sunClearanceDeg > 0,
            incidenceAngleDeg: roundToPrecision(solarIncidence.incidenceAngleDeg, 2),
            relativeIncidenceFactor: roundToPrecision(solarIncidence.cosineEfficiency, 4),
          },
          earth: {
            azimuthDeg: roundToPrecision(earthGeometry.azimuthDeg, 2),
            elevationDeg: roundToPrecision(earthGeometry.elevationDeg, 2),
            distanceKm: roundToPrecision(earthGeometry.distanceMeters / 1000.0, 1),
            targetPositionMoonCenteredME: earthGeometry.targetPositionMoonCenteredME,
            targetVelocityMoonCenteredME: earthGeometry.targetVelocityMoonCenteredME,
            topocentricVectorME: earthGeometry.topocentricVectorME,
            earthRotationAngleDeg: earthGeometry.earthRotationAngleDeg,
            horizonElevationDeg: roundToPrecision(earthHorizonDeg, 2),
            clearanceDeg: roundToPrecision(earthClearanceDeg, 2),
            isDirectlyVisible: earthClearanceDeg > 0,
          },
          next24HoursSummary: {
            sunlightTotalHours: shortWindow.summary.sunlightTotalHours,
            sunlightPercentage: shortWindow.summary.sunlightPercentage,
            earthVisibilityTotalHours: shortWindow.summary.earthVisibilityTotalHours,
            earthVisibilityPercentage: shortWindow.summary.earthVisibilityPercentage,
            bothVisibilityTotalHours: shortWindow.summary.bothVisibilityTotalHours,
          },
          metadata: {
            ephemerisProvider: ephemerisProvider.name,
            frame: 'MOON_ME / LOCAL_ENU',
            executionTimeMs: Math.round(performance.now() - t0),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/test/compare-sites
   * TEST 1 Multi-site comparison.
   */
  public static async postCompareSites(req: Request, res: Response, next: NextFunction): Promise<void> {
    const t0 = performance.now();
    try {
      const sites: CandidateSiteInput[] = req.body.sites || [];
      if (!sites || sites.length === 0) {
        res.status(400).json({ success: false, error: 'At least one candidate site must be provided for comparison.' });
        return;
      }

      const epochUtc = req.body.epochUtc || '2026-10-29T12:00:00Z';
      const durationHours = req.body.durationHours ?? 24;
      const startTimeUtc = epochUtc;
      const endTimeUtc = new Date(new Date(epochUtc).getTime() + durationHours * 3600 * 1000).toISOString();
      const stepSeconds = req.body.stepSeconds ?? (durationHours <= 24 ? 900 : 3600);

      appendLog('info', `Executing POST /api/test/compare-sites for ${sites.length} sites over ${durationHours}h`);

      const ephemerisProvider = EphemerisFactory.getProvider('spice');
      const demProvider = DemFactory.getDemProvider('geotiff');

      const requirements = req.body.requirements || {
        minSunlightHours: 1.0,
        maxSlopeDeg: 20.0,
      };

      // Run comparison through SiteScoringService
      const comparisonResult = await SiteScoringService.compareSites(
        ephemerisProvider,
        demProvider,
        sites,
        requirements,
        startTimeUtc,
        endTimeUtc,
        stepSeconds
      );

      // Enrich with instant Sun and Earth positions at epochUtc for each site
      const enrichedSites = await Promise.all(
        comparisonResult.sites.map(async (item) => {
          try {
            const sun = await ephemerisProvider.calculateTarget({
              target: 'SUN',
              epochUtc,
              siteCoords: { latitudeDeg: item.site.latitudeDeg, longitudeDeg: item.site.longitudeDeg },
            });
            const earth = await ephemerisProvider.calculateTarget({
              target: 'EARTH',
              epochUtc,
              siteCoords: { latitudeDeg: item.site.latitudeDeg, longitudeDeg: item.site.longitudeDeg },
            });
            return {
              ...item,
              instantGeometry: {
                epochUtc,
                sunElevationDeg: roundToPrecision(sun.elevationDeg, 2),
                sunAzimuthDeg: roundToPrecision(sun.azimuthDeg, 2),
                earthElevationDeg: roundToPrecision(earth.elevationDeg, 2),
                earthAzimuthDeg: roundToPrecision(earth.azimuthDeg, 2),
              },
            };
          } catch {
            return item;
          }
        })
      );

      res.json({
        success: true,
        data: {
          interval: {
            startUtc: startTimeUtc,
            endUtc: endTimeUtc,
            durationHours,
            stepSeconds,
          },
          requirementsApplied: requirements,
          sites: enrichedSites,
          ranking: comparisonResult.ranking,
          disclaimer: SiteScoringService.DISCLAIMER,
          executionTimeMs: Math.round(performance.now() - t0),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/test/time-analysis
   * TEST 2 Date & Time Flexibility over varying durations.
   */
  public static async postTimeAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    const t0 = performance.now();
    try {
      const site = req.body.site || { latitudeDeg: -89.78, longitudeDeg: 125.4, elevationMeters: 1413.9 };
      const startTimeUtc = req.body.startTimeUtc || '2026-10-29T00:00:00Z';
      let durationHours = req.body.durationHours ?? 24;

      // Support duration presets: '24h', '7d', '14d', '1_lunar_day' (~708.7h), '1_lunar_month' (~655.7h)
      if (req.body.durationPreset) {
        switch (req.body.durationPreset) {
          case '24h':
            durationHours = 24;
            break;
          case '7d':
            durationHours = 7 * 24;
            break;
          case '14d':
            durationHours = 14 * 24;
            break;
          case '1_lunar_day':
            durationHours = Math.round(SCIENTIFIC_CONSTANTS.LUNAR_SYNODIC_DAY_SECONDS / 3600);
            break;
          case '1_lunar_month':
            durationHours = Math.round(SCIENTIFIC_CONSTANTS.LUNAR_SIDEREAL_DAY_SECONDS / 3600);
            break;
        }
      }

      const endTimeUtc =
        req.body.endTimeUtc ||
        new Date(new Date(startTimeUtc).getTime() + durationHours * 3600 * 1000).toISOString();

      // Automatically compute an optimal stepSeconds so we don't exceed computation limits (target 100-300 points)
      let stepSeconds = req.body.stepSeconds;
      if (!stepSeconds) {
        if (durationHours <= 24) stepSeconds = 900; // 15 mins = 96 pts
        else if (durationHours <= 7 * 24) stepSeconds = 3600; // 1 hr = 168 pts
        else if (durationHours <= 14 * 24) stepSeconds = 7200; // 2 hrs = 168 pts
        else stepSeconds = 14400; // 4 hrs = ~177 pts
      }

      appendLog('info', `Executing POST /api/test/time-analysis for ${durationHours}h (${stepSeconds}s step)`);

      const ephemerisProvider = EphemerisFactory.getProvider('spice');
      const demProvider = DemFactory.getDemProvider('geotiff');

      const windowResult = await WindowCalculationService.calculateWindows(ephemerisProvider, demProvider, {
        siteCoords: site,
        startTimeUtc,
        endTimeUtc,
        stepSeconds,
        observerHeightMeters: site.observerHeightMeters ?? 2.0,
        includeTimeSeries: true,
      });

      // Best operational intervals where both Sun and Earth are visible
      const operationalWindows = windowResult.windows.bothWindows.map((w) => ({
        startUtc: w.startUtc,
        endUtc: w.endUtc,
        durationHours: roundToPrecision(w.durationHours, 2),
        confidence: w.confidence,
        operationalCapability: 'Simultaneous Solar Power Generation and Direct-to-Earth Telecommunications',
      }));

      res.json({
        success: true,
        data: {
          site,
          interval: windowResult.missionInterval,
          summary: windowResult.summary,
          operationalWindows,
          timeSeries: windowResult.timeSeries,
          windows: windowResult.windows,
          metadata: {
            ...windowResult.metadata,
            executionTimeMs: Math.round(performance.now() - t0),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/test/sun-earth-position
   * TEST 3 Celestial geometry and 2D horizon projection.
   */
  public static async postSunEarthPosition(req: Request, res: Response, next: NextFunction): Promise<void> {
    const t0 = performance.now();
    try {
      const site = req.body.site || { latitudeDeg: -89.78, longitudeDeg: 125.4, elevationMeters: 1413.9 };
      const epochUtc = req.body.epochUtc || '2026-10-29T12:00:00Z';
      const observerHeightMeters = req.body.observerHeightMeters ?? 2.0;

      appendLog('info', `Executing POST /api/test/sun-earth-position for epoch ${epochUtc}`);

      const ephemerisProvider = EphemerisFactory.getProvider('spice');
      const demProvider = DemFactory.getDemProvider('geotiff');

      const proj = demProvider.latLonToProjected(site.latitudeDeg, site.longitudeDeg);
      const isDemCovered = await demProvider.isPointCovered(proj.x, proj.y);

      // SPICE Ephemeris calculations
      const sunResult = await ephemerisProvider.calculateTarget({
        target: 'SUN',
        epochUtc,
        siteCoords: site,
        observerHeightMeters,
      });

      const earthResult = await ephemerisProvider.calculateTarget({
        target: 'EARTH',
        epochUtc,
        siteCoords: site,
        observerHeightMeters,
      });

      // 360-degree horizon profile
      let horizonSamples: HorizonSample[] = [];
      let minHorizonEl = 0;
      let maxHorizonEl = 0;

      if (isDemCovered) {
        const horizon = await HorizonProfileService.calculateHorizonProfile(demProvider, {
          latitudeDeg: site.latitudeDeg,
          longitudeDeg: site.longitudeDeg,
          observerHeightMeters,
          searchRadiusMeters: req.body.searchRadiusMeters ?? 1000.0,
          azimuthStepDeg: 5.0,
        });
        horizonSamples = horizon.samples;
        minHorizonEl = horizon.minHorizonElevationDeg;
        maxHorizonEl = horizon.maxHorizonElevationDeg;
      }

      const sunHorizonDeg = isDemCovered
        ? HorizonProfileService.interpolateHorizonAtAzimuth(horizonSamples, sunResult.azimuthDeg)
        : 0.0;
      const earthHorizonDeg = isDemCovered
        ? HorizonProfileService.interpolateHorizonAtAzimuth(horizonSamples, earthResult.azimuthDeg)
        : 0.0;

      const sunClearanceDeg = sunResult.elevationDeg - sunHorizonDeg;
      const earthClearanceDeg = earthResult.elevationDeg - earthHorizonDeg;

      res.json({
        success: true,
        data: {
          epochUtc,
          site: {
            ...site,
            observerHeightMeters,
            isDemCovered,
          },
          sun: {
            azimuthDeg: roundToPrecision(sunResult.azimuthDeg, 3),
            elevationDeg: roundToPrecision(sunResult.elevationDeg, 3),
            distanceKm: roundToPrecision(sunResult.distanceMeters / 1000.0, 1),
            lightTimeSeconds: roundToPrecision(sunResult.distanceMeters / SCIENTIFIC_CONSTANTS.SPEED_OF_LIGHT_M_S, 2),
            horizonElevationDeg: roundToPrecision(sunHorizonDeg, 3),
            clearanceDeg: roundToPrecision(sunClearanceDeg, 3),
            status: sunClearanceDeg > 0 ? 'ABOVE_HORIZON' : 'OBSCURED_BY_TERRAIN',
            enuVectorMeters: sunResult.localEnuVector,
          },
          earth: {
            azimuthDeg: roundToPrecision(earthResult.azimuthDeg, 3),
            elevationDeg: roundToPrecision(earthResult.elevationDeg, 3),
            distanceKm: roundToPrecision(earthResult.distanceMeters / 1000.0, 1),
            lightTimeSeconds: roundToPrecision(earthResult.distanceMeters / SCIENTIFIC_CONSTANTS.SPEED_OF_LIGHT_M_S, 2),
            horizonElevationDeg: roundToPrecision(earthHorizonDeg, 3),
            clearanceDeg: roundToPrecision(earthClearanceDeg, 3),
            status: earthClearanceDeg > 0 ? 'DIRECT_LINE_OF_SIGHT' : 'TERRAIN_BLOCKED',
            enuVectorMeters: earthResult.localEnuVector,
          },
          horizon: {
            minHorizonElevationDeg: roundToPrecision(minHorizonEl, 2),
            maxHorizonElevationDeg: roundToPrecision(maxHorizonEl, 2),
            samplesCount: horizonSamples.length,
            samples: horizonSamples,
          },
          scientificConventions: {
            lunarReferenceFrame: 'MOON_ME (IAU Mean Earth / Polar Axis fixed frame)',
            localTopocentricFrame: 'LOCAL_ENU (+X: East, +Y: North, +Z: Upward along surface normal)',
            timeStandard: 'UTC converted to TDB (Barycentric Dynamical Time) via SPICE leapseconds kernel',
            azimuthConvention: 'Astronomical / Navigation convention: North = 0°, East = 90°, South = 180°, West = 270°',
            elevationConvention: 'Local horizon = 0°, Zenith = +90°, Nadir = -90°',
          },
          metadata: {
            provider: ephemerisProvider.name,
            executionTimeMs: Math.round(performance.now() - t0),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/test/mission-assessment
   * TEST 4 Power & Communication Assessment against configurable thresholds.
   */
  public static async postMissionAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
    const t0 = performance.now();
    try {
      const site = req.body.site || { latitudeDeg: -89.78, longitudeDeg: 125.4, elevationMeters: 1413.9 };
      const startTimeUtc = req.body.startTimeUtc || '2026-10-29T00:00:00Z';
      const durationHours = req.body.durationHours ?? 72; // default 3 days
      const endTimeUtc =
        req.body.endTimeUtc ||
        new Date(new Date(startTimeUtc).getTime() + durationHours * 3600 * 1000).toISOString();

      const thresholds = {
        minSolarElevationDeg: req.body.minSolarElevationDeg ?? 0.5,
        minSunlightDurationHours: req.body.minSunlightDurationHours ?? 24.0,
        minEarthElevationDeg: req.body.minEarthElevationDeg ?? 0.0,
        minCommWindowHours: req.body.minCommWindowHours ?? 12.0,
        maxSlopeDeg: req.body.maxSlopeDeg ?? 15.0,
      };

      appendLog('info', `Executing POST /api/test/mission-assessment over ${durationHours}h`);

      const ephemerisProvider = EphemerisFactory.getProvider('spice');
      const demProvider = DemFactory.getDemProvider('geotiff');

      // Surface normal and slope
      const proj = demProvider.latLonToProjected(site.latitudeDeg, site.longitudeDeg);
      const isDemCovered = await demProvider.isPointCovered(proj.x, proj.y);
      let slopeDeg = 0.0;
      let aspectDeg = 0.0;
      let normalEnu = { x: 0, y: 0, z: 1 };

      if (isDemCovered) {
        const surface = await SurfaceNormalService.analyzeSurface(demProvider, {
          latitudeDeg: site.latitudeDeg,
          longitudeDeg: site.longitudeDeg,
        });
        slopeDeg = surface.slopeDeg;
        aspectDeg = surface.aspectDeg;
        normalEnu = surface.surfaceNormalEnu;
      }

      // Windows calculation
      const stepSeconds = durationHours <= 24 ? 900 : durationHours <= 72 ? 1800 : 3600;
      const windowResult = await WindowCalculationService.calculateWindows(ephemerisProvider, demProvider, {
        siteCoords: site,
        startTimeUtc,
        endTimeUtc,
        stepSeconds,
        includeTimeSeries: true,
      });

      // Calculate relative solar incidence metric across lit samples
      let maxSolarElevationDeg = -90.0;
      let minSolarElevationDeg = 90.0;
      let cumulativeIncidenceFactor = 0.0;
      let litCount = 0;

      if (windowResult.timeSeries) {
        for (const pt of windowResult.timeSeries) {
          if (pt.sun.elevationDeg > maxSolarElevationDeg) maxSolarElevationDeg = pt.sun.elevationDeg;
          if (pt.sun.elevationDeg < minSolarElevationDeg) minSolarElevationDeg = pt.sun.elevationDeg;

          if (pt.sun.isVisible) {
            const inc = SolarIncidenceService.calculateSolarIncidence(
              normalEnu,
              pt.sun.azimuthDeg,
              pt.sun.elevationDeg
            );
            cumulativeIncidenceFactor += inc.cosineEfficiency;
            litCount++;
          }
        }
      }

      const meanIncidenceFactor = litCount > 0 ? cumulativeIncidenceFactor / litCount : 0.0;

      // Evaluate against thresholds
      const reasons: string[] = [];
      let passCount = 0;
      const totalChecks = 5;

      // 1. Sunlight Duration
      const sunlightPass = windowResult.summary.sunlightTotalHours >= thresholds.minSunlightDurationHours;
      if (sunlightPass) {
        passCount++;
        reasons.push(
          `Sunlight duration (${windowResult.summary.sunlightTotalHours.toFixed(1)}h) meets minimum requirement (${thresholds.minSunlightDurationHours}h).`
        );
      } else {
        reasons.push(
          `Insufficient cumulative sunlight (${windowResult.summary.sunlightTotalHours.toFixed(1)}h < ${thresholds.minSunlightDurationHours}h requirement).`
        );
      }

      // 2. Solar Elevation
      const solarElPass = maxSolarElevationDeg >= thresholds.minSolarElevationDeg;
      if (solarElPass) {
        passCount++;
        reasons.push(
          `Max solar elevation (${maxSolarElevationDeg.toFixed(2)}°) clears minimum operational angle (${thresholds.minSolarElevationDeg}°).`
        );
      } else {
        reasons.push(
          `Solar elevation (${maxSolarElevationDeg.toFixed(2)}°) fails to clear ${thresholds.minSolarElevationDeg}° threshold.`
        );
      }

      // 3. Earth Comm Window
      const commPass = windowResult.summary.earthVisibilityTotalHours >= thresholds.minCommWindowHours;
      if (commPass) {
        passCount++;
        reasons.push(
          `Direct-to-Earth communication window (${windowResult.summary.earthVisibilityTotalHours.toFixed(1)}h) satisfies minimum requirement (${thresholds.minCommWindowHours}h).`
        );
      } else {
        reasons.push(
          `Direct-to-Earth communication window (${windowResult.summary.earthVisibilityTotalHours.toFixed(1)}h) below threshold (${thresholds.minCommWindowHours}h).`
        );
      }

      // 4. Slope Safety
      const slopePass = slopeDeg <= thresholds.maxSlopeDeg;
      if (slopePass) {
        passCount++;
        reasons.push(`Terrain slope (${slopeDeg.toFixed(1)}°) is within landing safety limit (${thresholds.maxSlopeDeg}°).`);
      } else {
        reasons.push(`Steep terrain slope (${slopeDeg.toFixed(1)}° > ${thresholds.maxSlopeDeg}° limit) poses landing risk.`);
      }

      // 5. Simultaneous Power & Comm
      const bothPass = windowResult.summary.bothVisibilityTotalHours > 0;
      if (bothPass) {
        passCount++;
        reasons.push(
          `Site provides ${windowResult.summary.bothVisibilityTotalHours.toFixed(1)}h of simultaneous solar power and direct Earth communication.`
        );
      } else {
        reasons.push('No simultaneous solar power and direct Earth communications window detected.');
      }

      let assessmentStatus: 'FEASIBLE' | 'MARGINAL' | 'NOT_RECOMMENDED' = 'NOT_RECOMMENDED';
      let score = Math.round((passCount / totalChecks) * 100);
      if (passCount >= 4) {
        assessmentStatus = 'FEASIBLE';
      } else if (passCount >= 2) {
        assessmentStatus = 'MARGINAL';
      }

      res.json({
        success: true,
        data: {
          site,
          interval: {
            startUtc: startTimeUtc,
            endUtc: endTimeUtc,
            durationHours,
          },
          thresholdsApplied: thresholds,
          finalAssessment: {
            status: assessmentStatus,
            score,
            reasons,
          },
          powerAssessment: {
            maxSolarElevationDeg: roundToPrecision(maxSolarElevationDeg, 2),
            minSolarElevationDeg: roundToPrecision(minSolarElevationDeg, 2),
            sunlightTotalHours: windowResult.summary.sunlightTotalHours,
            sunlightPercentage: windowResult.summary.sunlightPercentage,
            longestContinuousSunlightHours: windowResult.summary.longestSunlightContinuousHours,
            solarWindowsCount: windowResult.windows.sunWindows.length,
            solarWindows: windowResult.windows.sunWindows,
            relativeGeometricIncidenceFactor: roundToPrecision(meanIncidenceFactor, 3),
            hardwareDisclaimer:
              'Metric represents geometric cosine of solar incidence on local terrain slope. It does NOT claim actual electrical power in watts without specific PV panel dimensions, cell efficiency, gimbal tracking, dust degradation, and battery storage models.',
          },
          communicationAssessment: {
            earthVisibilityTotalHours: windowResult.summary.earthVisibilityTotalHours,
            earthVisibilityPercentage: windowResult.summary.earthVisibilityPercentage,
            longestContinuousEarthHours: windowResult.summary.longestEarthVisibilityContinuousHours,
            communicationWindowsCount: windowResult.windows.earthWindows.length,
            communicationWindows: windowResult.windows.earthWindows,
            directLineOfSightPercentage: windowResult.summary.earthVisibilityPercentage,
            terrainOcclusionHours: roundToPrecision(
              durationHours - windowResult.summary.earthVisibilityTotalHours,
              1
            ),
          },
          terrainParameters: {
            elevationMeters: isDemCovered ? site.elevationMeters ?? 0 : null,
            slopeDeg: roundToPrecision(slopeDeg, 2),
            aspectDeg: roundToPrecision(aspectDeg, 2),
            source: isDemCovered ? 'NASA LOLA GeoTIFF' : 'Spherical Datum (Outside DEM)',
          },
          executionTimeMs: Math.round(performance.now() - t0),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/test/terrain
   * TEST 5 Extract 2D and 3D terrain heightfield from real LOLA DEM GeoTIFF.
   */
  public static async postTerrain(req: Request, res: Response, next: NextFunction): Promise<void> {
    const t0 = performance.now();
    try {
      const site = req.body.site || { latitudeDeg: -89.78, longitudeDeg: 125.4 };
      const radiusMeters = req.body.radiusMeters ?? 2000.0;
      const gridResolution = Math.min(100, Math.max(16, req.body.gridResolution ?? 64));

      appendLog('info', `Executing POST /api/test/terrain for (${site.latitudeDeg}, ${site.longitudeDeg}) radius ${radiusMeters}m`);

      const demService = DemFactory.getGeoTiffService();
      const meta = await demService.getMetadata();

      const { x: centerX, y: centerY } = demService.latLonToProjected(site.latitudeDeg, site.longitudeDeg);
      const isCovered = await demService.isPointCovered(centerX, centerY);

      if (!isCovered) {
        res.status(400).json({
          success: false,
          error: `Selected coordinates (${site.latitudeDeg}°, ${site.longitudeDeg}°) fall outside the active South Pole DEM GeoTIFF bounds.`,
          details: {
            projectedX: roundToPrecision(centerX, 1),
            projectedY: roundToPrecision(centerY, 1),
            demBounds: meta.bounds,
            dataset: meta.source,
          },
        });
        return;
      }

      const subgrid = await demService.getTerrainSubgrid(centerX, centerY, radiusMeters, gridResolution);
      const centerElev = await demService.getElevationAt(centerX, centerY);

      // Compute corners in selenographic lat/lon
      const cornerNW = demService.projectedToLatLon(subgrid.bounds.minX, subgrid.bounds.maxY);
      const cornerSE = demService.projectedToLatLon(subgrid.bounds.maxX, subgrid.bounds.minY);

      res.json({
        success: true,
        data: {
          site: {
            latitudeDeg: site.latitudeDeg,
            longitudeDeg: site.longitudeDeg,
            centerElevationMeters: centerElev !== null ? roundToPrecision(centerElev, 2) : null,
            projectedX: roundToPrecision(centerX, 2),
            projectedY: roundToPrecision(centerY, 2),
          },
          grid: {
            width: subgrid.width,
            height: subgrid.height,
            stepMeters: roundToPrecision(subgrid.stepMeters, 2),
            minElevationMeters: roundToPrecision(subgrid.minElevation, 2),
            maxElevationMeters: roundToPrecision(subgrid.maxElevation, 2),
            meanElevationMeters: roundToPrecision(subgrid.meanElevation, 2),
            elevationSpanMeters: roundToPrecision(subgrid.maxElevation - subgrid.minElevation, 2),
            coverageRatio: roundToPrecision(subgrid.coverageRatio, 3),
            elevations: subgrid.grid,
          },
          bounds: {
            projected: subgrid.bounds,
            geographic: {
              northWest: cornerNW,
              southEast: cornerSE,
            },
          },
          demMetadata: {
            id: meta.id,
            source: meta.source,
            crs: meta.crs,
            nativeResolutionMeters: meta.pixelSpacingMeters,
            verticalReference: meta.verticalReference,
          },
          executionTimeMs: Math.round(performance.now() - t0),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/test/timeline
   * TEST 6 Multi-epoch animation timeline dataset.
   */
  public static async postTimeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    const t0 = performance.now();
    try {
      const site = req.body.site || { latitudeDeg: -89.78, longitudeDeg: 125.4, elevationMeters: 1413.9 };
      const startTimeUtc = req.body.startTimeUtc || '2026-10-29T00:00:00Z';
      const durationHours = req.body.durationHours ?? 72; // default 3 days
      const stepSeconds = req.body.stepSeconds ?? (durationHours <= 48 ? 900 : 3600);
      const endTimeUtc =
        req.body.endTimeUtc ||
        new Date(new Date(startTimeUtc).getTime() + durationHours * 3600 * 1000).toISOString();

      appendLog('info', `Executing POST /api/test/timeline over ${durationHours}h (${stepSeconds}s step)`);

      const ephemerisProvider = EphemerisFactory.getProvider('spice');
      const demProvider = DemFactory.getDemProvider('geotiff');

      const windowResult = await WindowCalculationService.calculateWindows(ephemerisProvider, demProvider, {
        siteCoords: site,
        startTimeUtc,
        endTimeUtc,
        stepSeconds,
        includeTimeSeries: true,
      });

      // Break down by calendar days (24h chunks)
      const dayCount = Math.ceil(durationHours / 24);
      const dayMetrics: Array<{
        dayIndex: number;
        startUtc: string;
        endUtc: string;
        sunlightHours: number;
        earthVisibilityHours: number;
        simultaneousHours: number;
        maxSolarElevationDeg: number;
      }> = [];

      const rawPoints = windowResult.timeSeries || [];
      const ptsPerDay = Math.round((24 * 3600) / stepSeconds);

      for (let d = 0; d < dayCount; d++) {
        const slice = rawPoints.slice(d * ptsPerDay, (d + 1) * ptsPerDay);
        if (slice.length === 0) continue;

        let litPts = 0;
        let commPts = 0;
        let bothPts = 0;
        let maxSunEl = -90;

        for (const pt of slice) {
          if (pt.sun.isVisible) litPts++;
          if (pt.earth.isVisible) commPts++;
          if (pt.bothVisible) bothPts++;
          if (pt.sun.elevationDeg > maxSunEl) maxSunEl = pt.sun.elevationDeg;
        }

        const dtHours = stepSeconds / 3600;
        dayMetrics.push({
          dayIndex: d + 1,
          startUtc: slice[0].epochUtc,
          endUtc: slice[slice.length - 1].epochUtc,
          sunlightHours: roundToPrecision(litPts * dtHours, 2),
          earthVisibilityHours: roundToPrecision(commPts * dtHours, 2),
          simultaneousHours: roundToPrecision(bothPts * dtHours, 2),
          maxSolarElevationDeg: roundToPrecision(maxSunEl, 2),
        });
      }

      res.json({
        success: true,
        data: {
          site,
          startTimeUtc,
          endTimeUtc,
          durationHours,
          stepSeconds,
          pointCount: rawPoints.length,
          timelinePoints: rawPoints,
          dayMetrics,
          summary: windowResult.summary,
          executionTimeMs: Math.round(performance.now() - t0),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/test/logs
   * Returns recent server and scientific calculation logs.
   */
  public static async getLogs(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        count: recentLogs.length,
        logs: recentLogs,
      },
    });
  }
}
