import { Request, Response, NextFunction } from 'express';
import { validateSiteRequestSchema, siteAnalysisRequestSchema } from '../schemas/site.schema';
import { siteComparisonRequestSchema } from '../schemas/comparison.schema';
import { LunarFrameService } from '../services/coordinates/lunar-frame.service';
import { DEFAULT_DEMO_SITES } from '../config/scientific-config';
import { SiteScoringService } from '../services/comparison/site-scoring.service';
import { EphemerisFactory } from '../services/ephemeris/ephemeris.factory';
import { DemFactory } from '../services/terrain/dem.factory';
import { SurfaceNormalService } from '../services/terrain/surface-normal.service';
import { HorizonProfileService, HorizonSample } from '../services/terrain/horizon-profile.service';
import { SolarIncidenceService } from '../services/illumination/solar-incidence.service';
import { WindowCalculationService } from '../services/windows/window-calculation.service';
import { roundToPrecision } from '../utils/units';

export class SitesController {
  public static async validateSite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = validateSiteRequestSchema.parse(req.body);
      const site = parsed.site;

      LunarFrameService.validateCoordinates(site);
      const cartesianME = LunarFrameService.selenographicToCartesianME(site);

      res.json({
        success: true,
        data: {
          valid: true,
          site: {
            id: site.id ?? 'custom-site',
            name: site.name ?? 'Custom Lunar Landing Site',
            latitudeDeg: site.latitudeDeg,
            longitudeDeg: site.longitudeDeg,
            elevationMeters: site.elevationMeters ?? 0.0,
          },
          cartesianCoordinatesME: cartesianME,
          frame: 'MOON_ME',
          units: {
            angles: 'degrees',
            distance: 'meters',
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getDefaultSites(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        demonstrationSites: DEFAULT_DEMO_SITES,
        count: DEFAULT_DEMO_SITES.length,
        referenceFrame: 'MOON_ME',
      },
    });
  }

  public static async getCandidateSites(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      count: DEFAULT_DEMO_SITES.length,
      candidateSites: DEFAULT_DEMO_SITES,
      dataSource: 'NASA Artemis III Architecture & LRO LOLA/LROC Science Data',
      referenceFrame: 'MOON_ME',
    });
  }

  public static async getSiteById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const site = DEFAULT_DEMO_SITES.find((s) => s.id === id);
      if (!site) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SITE_NOT_FOUND',
            message: `Candidate landing site with ID '${id}' not found.`,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: site,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getSiteAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    const t0 = performance.now();
    try {
      const parsed = siteAnalysisRequestSchema.parse(req.body);
      const site = parsed.site;
      const epochUtc = parsed.epochUtc;
      const observerHeightMeters = parsed.observerHeightMeters;

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
          searchRadiusMeters: parsed.searchRadiusMeters,
          azimuthStepDeg: parsed.azimuthStepDeg,
        });
        horizonSamples = horizonProfile.samples;
      }

      // Celestial Ephemeris via NASA SPICE DE440
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

      // Solar incidence angle
      const solarIncidence = SolarIncidenceService.calculateSolarIncidence(
        surfaceNormalEnu,
        sunGeometry.azimuthDeg,
        sunGeometry.elevationDeg
      );

      // Short-interval window estimate over 24h
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

  public static async compareSites(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = siteComparisonRequestSchema.parse(req.body);
      const ephemerisProvider = EphemerisFactory.getProvider(parsed.ephemerisProvider);
      const demProvider = DemFactory.getDemProvider(parsed.demProvider);

      const candidateSites = parsed.sites.map((s, index) => ({
        id: s.id ?? `site-${index + 1}`,
        name: s.name ?? `Candidate Site ${index + 1}`,
        latitudeDeg: s.latitudeDeg,
        longitudeDeg: s.longitudeDeg,
        elevationMeters: s.elevationMeters,
      }));

      let comparison;
      try {
        comparison = await SiteScoringService.compareSites(
          ephemerisProvider,
          demProvider,
          candidateSites,
          parsed.requirements,
          parsed.startTimeUtc,
          parsed.endTimeUtc,
          parsed.stepSeconds
        );
      } catch (err: any) {
        if (
          (!parsed.demProvider || parsed.demProvider === 'geotiff') &&
          err?.message &&
          (err.message.includes('outside DEM coverage') || err.message.includes('NoData'))
        ) {
          const fallbackDem = DemFactory.getDemProvider('synthetic');
          comparison = await SiteScoringService.compareSites(
            ephemerisProvider,
            fallbackDem,
            candidateSites,
            parsed.requirements,
            parsed.startTimeUtc,
            parsed.endTimeUtc,
            parsed.stepSeconds
          );
        } else {
          throw err;
        }
      }

      res.json({
        success: true,
        data: comparison,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Authority endpoint: evaluates instant scientific solar illumination for a specific NASA candidate site
   * or coordinates using NASA JPL SPICE DE440 ephemeris and LOLA terrain obstruction.
   */
  public static async evaluateIllumination(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        siteId,
        latitude,
        latitudeDeg,
        longitude,
        longitudeDeg,
        elevationMeters: reqElev,
        timestamp,
        epochUtc,
        observerHeightMeters: reqObsHeight,
      } = req.body || {};

      const targetTime = timestamp || epochUtc || new Date().toISOString();
      const observerHeight = typeof reqObsHeight === 'number' && reqObsHeight >= 0 ? reqObsHeight : 2.0;

      // 1. Resolve site from verified database or fallback coordinates
      const site = DEFAULT_DEMO_SITES.find((s) => s.id === siteId);
      const lat = typeof latitudeDeg === 'number' ? latitudeDeg : (typeof latitude === 'number' ? latitude : site?.latitudeDeg);
      const lon = typeof longitudeDeg === 'number' ? longitudeDeg : (typeof longitude === 'number' ? longitude : site?.longitudeDeg);
      let elev = typeof reqElev === 'number' ? reqElev : (site?.elevationMeters ?? 0.0);
      const name = site?.name || 'Selected Lunar Location';
      const id = site?.id || siteId || 'custom-site';

      if (typeof lat !== 'number' || typeof lon !== 'number') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_COORDINATES',
            message: 'A valid siteId or numeric latitude and longitude must be provided.',
          },
        });
        return;
      }

      LunarFrameService.validateCoordinates({ latitudeDeg: lat, longitudeDeg: lon });

      const ephemerisProvider = EphemerisFactory.getProvider('spice');
      const demProvider = DemFactory.getDemProvider('geotiff');

      // Check DEM coverage
      const proj = demProvider.latLonToProjected(lat, lon);
      const isDemCovered = await demProvider.isPointCovered(proj.x, proj.y);

      let slopeDeg = 0.0;
      let aspectDeg = 0.0;
      let surfaceNormalEnu = { x: 0, y: 0, z: 1 };
      let horizonSamples: HorizonSample[] = [];

      if (isDemCovered) {
        const demElev = await demProvider.getElevationAt(proj.x, proj.y);
        if (demElev !== null) elev = demElev;

        const surface = await SurfaceNormalService.analyzeSurface(demProvider, {
          latitudeDeg: lat,
          longitudeDeg: lon,
          observerHeightMeters: observerHeight,
        });
        slopeDeg = surface.slopeDeg;
        aspectDeg = surface.aspectDeg;
        surfaceNormalEnu = surface.surfaceNormalEnu;

        const horizonProfile = await HorizonProfileService.calculateHorizonProfile(demProvider, {
          latitudeDeg: lat,
          longitudeDeg: lon,
          observerHeightMeters: observerHeight,
          searchRadiusMeters: 1000.0,
          azimuthStepDeg: 5.0,
        });
        horizonSamples = horizonProfile.samples;
      }

      // SPICE DE440 Sun Ephemeris
      const sunGeometry = await ephemerisProvider.calculateTarget({
        target: 'SUN',
        epochUtc: targetTime,
        siteCoords: { latitudeDeg: lat, longitudeDeg: lon, elevationMeters: elev },
        observerHeightMeters: observerHeight,
      });

      // Horizon clearance
      const horizonElevationDeg = isDemCovered
        ? HorizonProfileService.interpolateHorizonAtAzimuth(horizonSamples, sunGeometry.azimuthDeg)
        : 0.0;
      const sunClearanceDeg = sunGeometry.elevationDeg - horizonElevationDeg;

      // Solar incidence
      const solarIncidence = SolarIncidenceService.calculateSolarIncidence(
        surfaceNormalEnu,
        sunGeometry.azimuthDeg,
        sunGeometry.elevationDeg
      );

      // Decision
      const sunClearsHorizon = sunClearanceDeg > 0;
      const surfaceFacesSun = solarIncidence.isFacingSun;
      const isIlluminated = sunClearsHorizon && surfaceFacesSun;

      let illuminationStatus: string;
      if (isIlluminated) {
        illuminationStatus = 'ILLUMINATED';
      } else if (!sunClearsHorizon && !surfaceFacesSun) {
        illuminationStatus = 'BLOCKED_AND_SELF_SHADOWED';
      } else if (!sunClearsHorizon) {
        illuminationStatus = 'SHADOWED_BY_TERRAIN';
      } else {
        illuminationStatus = 'SELF_SHADOWED';
      }

      // Window estimate for sunrise / sunset and continuous sunlight hours
      let continuousSunlightHours = 0;
      let sunriseUtc: string | null = null;
      let sunsetUtc: string | null = null;

      try {
        const windowRes = await WindowCalculationService.calculateWindows(ephemerisProvider, demProvider, {
          siteCoords: { latitudeDeg: lat, longitudeDeg: lon, elevationMeters: elev },
          startTimeUtc: targetTime,
          endTimeUtc: new Date(new Date(targetTime).getTime() + 48 * 3600 * 1000).toISOString(),
          stepSeconds: 900,
          observerHeightMeters: observerHeight,
        });

        continuousSunlightHours = windowRes.summary.longestSunlightContinuousHours;
        const sunWindows = windowRes.windows.sunWindows;
        if (sunWindows && sunWindows.length > 0) {
          sunriseUtc = sunWindows[0].startUtc;
          sunsetUtc = sunWindows[0].endUtc;
        }
      } catch {
        // Fallback gracefully without window estimation
      }

      res.json({
        success: true,
        data: {
          siteId: id,
          siteName: name,
          siteType: site?.siteType || 'CANDIDATE_REGION',
          latitude: roundToPrecision(lat, 4),
          longitude: roundToPrecision(lon, 4),
          elevationMeters: roundToPrecision(elev, 1),
          slopeDeg: roundToPrecision(slopeDeg, 1),
          aspectDeg: roundToPrecision(aspectDeg, 1),
          timestamp: targetTime,
          dataSource: 'NASA JPL SPICE DE440 & NASA LOLA Polar DEM',
          isIlluminated,
          illuminationStatus,
          solarElevationDeg: roundToPrecision(sunGeometry.elevationDeg, 2),
          solarAzimuthDeg: roundToPrecision(sunGeometry.azimuthDeg, 2),
          horizonElevationDeg: roundToPrecision(horizonElevationDeg, 2),
          horizonClearanceDeg: roundToPrecision(sunClearanceDeg, 2),
          incidenceAngleDeg: roundToPrecision(solarIncidence.incidenceAngleDeg, 2),
          relativeIncidenceFactor: roundToPrecision(solarIncidence.cosineEfficiency, 4),
          continuousSunlightHours: roundToPrecision(continuousSunlightHours, 1),
          sunriseUtc,
          sunsetUtc,
          isDemCovered,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
