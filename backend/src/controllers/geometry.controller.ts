import { Request, Response, NextFunction } from 'express';
import { instantaneousGeometryRequestSchema } from '../schemas/geometry.schema';
import { EphemerisFactory } from '../services/ephemeris/ephemeris.factory';

export class GeometryController {
  public static async getSunGeometry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = instantaneousGeometryRequestSchema.parse(req.body);
      const provider = EphemerisFactory.getProvider(parsed.ephemerisProvider);

      const result = await provider.calculateTarget({
        target: 'SUN',
        epochUtc: parsed.epochUtc,
        siteCoords: parsed.site,
        observerHeightMeters: parsed.observerHeightMeters,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getEarthGeometry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = instantaneousGeometryRequestSchema.parse(req.body);
      const provider = EphemerisFactory.getProvider(parsed.ephemerisProvider);

      const result = await provider.calculateTarget({
        target: 'EARTH',
        epochUtc: parsed.epochUtc,
        siteCoords: parsed.site,
        observerHeightMeters: parsed.observerHeightMeters,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getSkyGeometry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = instantaneousGeometryRequestSchema.parse(req.body);
      const provider = EphemerisFactory.getProvider(parsed.ephemerisProvider);

      const [sun, earth] = await Promise.all([
        provider.calculateTarget({
          target: 'SUN',
          epochUtc: parsed.epochUtc,
          siteCoords: parsed.site,
          observerHeightMeters: parsed.observerHeightMeters,
        }),
        provider.calculateTarget({
          target: 'EARTH',
          epochUtc: parsed.epochUtc,
          siteCoords: parsed.site,
          observerHeightMeters: parsed.observerHeightMeters,
        }),
      ]);

      res.json({
        success: true,
        data: {
          site: parsed.site,
          epochUtc: parsed.epochUtc,
          sun,
          earth,
          units: {
            angles: 'degrees',
            distance: 'meters',
          },
          frame: 'LOCAL_ENU',
          referenceFrame: 'MOON_ME',
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
