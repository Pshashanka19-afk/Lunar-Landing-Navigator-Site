import { Request, Response, NextFunction } from 'express';
import { validateSiteRequestSchema } from '../schemas/site.schema';
import { siteComparisonRequestSchema } from '../schemas/comparison.schema';
import { LunarFrameService } from '../services/coordinates/lunar-frame.service';
import { DEFAULT_DEMO_SITES } from '../config/scientific-config';
import { SiteScoringService } from '../services/comparison/site-scoring.service';
import { EphemerisFactory } from '../services/ephemeris/ephemeris.factory';
import { DemFactory } from '../services/terrain/dem.factory';

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

      const comparison = await SiteScoringService.compareSites(
        ephemerisProvider,
        demProvider,
        candidateSites,
        parsed.requirements,
        parsed.startTimeUtc,
        parsed.endTimeUtc,
        parsed.stepSeconds
      );

      res.json({
        success: true,
        data: comparison,
      });
    } catch (err) {
      next(err);
    }
  }
}
