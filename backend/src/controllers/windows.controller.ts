import { Request, Response, NextFunction } from 'express';
import { windowCalculationRequestSchema } from '../schemas/windows.schema';
import { EphemerisFactory } from '../services/ephemeris/ephemeris.factory';
import { DemFactory } from '../services/terrain/dem.factory';
import { WindowCalculationService } from '../services/windows/window-calculation.service';

export class WindowsController {
  public static async calculateWindows(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = windowCalculationRequestSchema.parse(req.body);
      const ephemerisProvider = EphemerisFactory.getProvider(parsed.ephemerisProvider);
      const demProvider = DemFactory.getDemProvider(parsed.demProvider);

      const result = await WindowCalculationService.calculateWindows(
        ephemerisProvider,
        demProvider,
        {
          siteCoords: parsed.site,
          startTimeUtc: parsed.startTimeUtc,
          endTimeUtc: parsed.endTimeUtc,
          stepSeconds: parsed.stepSeconds,
          boundaryToleranceSeconds: parsed.boundaryToleranceSeconds,
          observerHeightMeters: parsed.site.observerHeightMeters,
          solarMarginDeg: parsed.solarMarginDeg,
          earthMarginDeg: parsed.earthMarginDeg,
          searchRadiusMeters: parsed.searchRadiusMeters,
          azimuthStepDeg: parsed.azimuthStepDeg,
          includeTimeSeries: parsed.includeTimeSeries,
        }
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
