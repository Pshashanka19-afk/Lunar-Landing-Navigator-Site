import { Request, Response, NextFunction } from 'express';
import { siteSeriesRequestSchema } from '../schemas/series.schema';
import { EphemerisFactory } from '../services/ephemeris/ephemeris.factory';
import { DemFactory } from '../services/terrain/dem.factory';
import { SiteSeriesService } from '../services/series/site-series.service';

export class SeriesController {
  public static async getSiteSeries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = siteSeriesRequestSchema.parse(req.body);
      const ephemerisProvider = EphemerisFactory.getProvider(parsed.ephemerisProvider);
      const demProvider = DemFactory.getDemProvider(parsed.demProvider);

      const result = await SiteSeriesService.calculateSeries(ephemerisProvider, demProvider, {
        siteCoords: parsed.site,
        startTimeUtc: parsed.startTimeUtc,
        endTimeUtc: parsed.endTimeUtc,
        stepSeconds: parsed.stepSeconds,
        include: parsed.include,
        observerHeightMeters: parsed.site.observerHeightMeters,
        searchRadiusMeters: parsed.searchRadiusMeters,
        azimuthStepDeg: parsed.azimuthStepDeg,
        thermal: parsed.thermal,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
