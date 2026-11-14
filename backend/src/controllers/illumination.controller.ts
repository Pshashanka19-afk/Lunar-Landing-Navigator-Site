import { Request, Response, NextFunction } from 'express';
import { instantIlluminationRequestSchema } from '../schemas/illumination.schema';
import { EphemerisFactory } from '../services/ephemeris/ephemeris.factory';
import { DemFactory } from '../services/terrain/dem.factory';
import { IlluminationService } from '../services/illumination/illumination.service';

export class IlluminationController {
  public static async getInstantIllumination(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = instantIlluminationRequestSchema.parse(req.body);
      const ephemerisProvider = EphemerisFactory.getProvider(parsed.ephemerisProvider);
      const demProvider = DemFactory.getDemProvider(parsed.demProvider);

      const result = await IlluminationService.calculateInstantIllumination(
        ephemerisProvider,
        demProvider,
        {
          siteCoords: parsed.site,
          epochUtc: parsed.epochUtc,
          observerHeightMeters: parsed.site.observerHeightMeters,
          searchRadiusMeters: parsed.searchRadiusMeters,
          azimuthStepDeg: parsed.azimuthStepDeg,
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
